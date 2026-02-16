// lib/job_ingest.ts
export type RoleVectorLevel = 0 | 1 | 2;

export type JobIngestDimensionKey =
  | "structuralMaturity"
  | "authorityScope"
  | "revenueOrientation"
  | "roleAmbiguity"
  | "breadthVsDepth"
  | "stakeholderDensity";

export type JobIngestDimensionEvidence = { level: RoleVectorLevel; evidence: string[] };

export type JobIngestObject = {
  jobText: string;
  normalizedText: string;
  roleVector: number[]; // length 6
  dimensionEvidence: {
    structuralMaturity: JobIngestDimensionEvidence;
    authorityScope: JobIngestDimensionEvidence;
    revenueOrientation: JobIngestDimensionEvidence;
    roleAmbiguity: JobIngestDimensionEvidence;
    breadthVsDepth: JobIngestDimensionEvidence;
    stakeholderDensity: JobIngestDimensionEvidence;
  };
};

export type JobIngestError = {
  name: "JobIngestError";
  code: "MISSING_JOB_TEXT" | "UNABLE_TO_EXTRACT_ANY_SIGNAL" | "INCOMPLETE_DIMENSION_COVERAGE";
  detail: string;
  meta?: Record<string, any>;
};

function makeError(err: JobIngestError): JobIngestError {
  return err;
}

function normalizeJobText(raw: string): { jobText: string; normalizedText: string; normalizedLower: string } {
  const jobText = typeof raw === "string" ? raw : "";
  const trimmed = jobText.trim();

  // Deterministic minimum gating: no guessing on short / empty.
  // "short" is intentionally strict to avoid optimistic inference.
  const MIN_CHARS = 40;
  if (trimmed.length === 0) {
    throw makeError({
      name: "JobIngestError",
      code: "MISSING_JOB_TEXT",
      detail: "Missing job text",
    });
  }
  if (trimmed.length < MIN_CHARS) {
    throw makeError({
      name: "JobIngestError",
      code: "MISSING_JOB_TEXT",
      detail: `Job text too short (min ${MIN_CHARS} characters required)`,
      meta: { minChars: MIN_CHARS, providedChars: trimmed.length },
    });
  }

  const normalizedText = trimmed.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  const normalizedLower = normalizedText.toLowerCase();

  return { jobText, normalizedText, normalizedLower };
}

type RuleSet = {
  level: RoleVectorLevel;
  // regex run on ORIGINAL normalizedText (not lowercased), but typically case-insensitive.
  patterns: RegExp[];
};

type DimensionRules = {
  key: JobIngestDimensionKey;
  rulesByLevel: RuleSet[]; // can include multiple rule sets per level
};

function uniqueStrings(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const v = x.trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function extractEvidence(normalizedText: string, patterns: RegExp[], maxSnippets: number): string[] {
  const evidence: string[] = [];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    // Ensure we don't get stuck on non-global regex
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const safe = new RegExp(re.source, flags);

    while ((match = safe.exec(normalizedText)) !== null) {
      const snippet = (match[0] ?? "").trim();
      if (snippet) evidence.push(snippet);
      if (evidence.length >= maxSnippets) return uniqueStrings(evidence).slice(0, maxSnippets);
      // Safety for zero-width matches
      if (match.index === safe.lastIndex) safe.lastIndex++;
    }
  }
  return uniqueStrings(evidence).slice(0, maxSnippets);
}

/**
 * Deterministic encoding:
 * - For each dimension, pick the HIGHEST level (2 > 1 > 0) for which any evidence matches.
 * - Evidence = matched snippets for the chosen level only.
 * - If no evidence for a dimension => deterministic failure.
 */
function encodeDimension(normalizedText: string, dimension: DimensionRules): JobIngestDimensionEvidence | null {
  const MAX_SNIPPETS = 6;

  // Evaluate in descending order so conflicts resolve deterministically (highest level wins).
  const descending: RoleVectorLevel[] = [2, 1, 0];

  for (const lvl of descending) {
    const ruleSets = dimension.rulesByLevel.filter((rs) => rs.level === lvl);
    const patterns = ruleSets.flatMap((rs) => rs.patterns);
    if (patterns.length === 0) continue;

    const evidence = extractEvidence(normalizedText, patterns, MAX_SNIPPETS);
    if (evidence.length > 0) {
      return { level: lvl, evidence };
    }
  }

  return null;
}

export function ingestJob(jobDescriptionText: string): JobIngestObject {
  const { jobText, normalizedText } = normalizeJobText(jobDescriptionText);

  const dimensions: DimensionRules[] = [
    {
      key: "structuralMaturity",
      rulesByLevel: [
        {
          level: 0,
          patterns: [
            /\b(startup|early[- ]stage|seed|series [a-c])\b/i,
            /\b(0[-–]1|zero[- ]to[- ]one)\b/i,
            /\b(build(ing)? from scratch|greenfield)\b/i,
            /\b(scrappy|no (existing )?process|figure it out)\b/i,
          ],
        },
        {
          level: 1,
          patterns: [
            /\b(scale|scaling|growth stage)\b/i,
            /\b(operationaliz(e|ing)|standardiz(e|ing)|process improvement)\b/i,
            /\b(optimi(z|s)e|continuous improvement)\b/i,
            /\b(repeatable|playbook|best practices)\b/i,
            // Added (maturity signals commonly present in enterprise JDs)
            /\b(planning cycles?|quarterly planning|annual planning)\b/i,
            /\b(metrics|measurement|KPIs?|success metrics)\b/i,
            /\b(analytics|measurement framework|reporting)\b/i,
            /\b(frameworks?|operating model)\b/i,
          ],
        },
        {
          level: 2,
          patterns: [
            /\b(enterprise|global organization|global strategy)\b/i,
            /\b(governance|compliance|audit)\b/i,
            /\b(SOX|SOC ?2|ISO ?27001|HIPAA|GDPR)\b/i,
            /\b(risk management|controls)\b/i,
            // Added (explicit operating cadence / frameworks at scale)
            /\b(global (audience|marketing|go[- ]to[- ]market) strategy)\b/i,
            /\b(operating model|governance model)\b/i,
            /\b(planning cycle|planning cycles)\b/i,
          ],
        },
      ],
    },
    {
      key: "authorityScope",
      rulesByLevel: [
        {
          level: 0,
          patterns: [
            /\b(individual contributor|IC role)\b/i,
            /\b(assist|support)\b/i,
            /\b(report(s|ing)? to)\b/i,
            /\b(under (the )?direction|as assigned)\b/i,
          ],
        },
        {
          level: 1,
          patterns: [
            /\b(lead|leading)\b/i,
            /\b(owner|own|ownership)\b/i,
            /\b(manage|manager|management)\b/i,
            /\b(team lead|supervis(e|ing))\b/i,
            // Added (authority without direct reports; strategy/definition/championing)
            /\b(lead (the )?(strategy|roadmap|planning))\b/i,
            /\b(define|set|shape) (the )?(strategy|approach|framework|operating model)\b/i,
            /\b(serve as|act as) (an )?(internal )?(champion|owner)\b/i,
            /\b(represent|representing) (the )?(function|team|organization) (in|during) (planning|planning cycles?)\b/i,
            /\b(partner with (sales|product|engineering|customer success))\b/i,
            /\b(plan and execute\b/i,
          ],
        },
        {
          level: 2,
          patterns: [
            /\b(director|sr\.? director|vice president|vp|head of)\b/i,
            /\b(executive|c[- ]suite)\b/i,
            /\b(p&l|P&L)\b/i,
            /\b(strategy|strategic)\b/i,
          ],
        },
      ],
    },
    {
      key: "revenueOrientation",
      rulesByLevel: [
        {
          level: 0,
          patterns: [
            /\b(internal stakeholder|internal systems)\b/i,
            /\b(cost reduction|cost savings|efficiency)\b/i,
            /\b(back office|shared services)\b/i,
            /\b(compliance|risk)\b/i,
          ],
        },
        {
          level: 1,
          patterns: [
            /\b(customer|clients?)\b/i,
            /\b(sales|marketing|go[- ]to[- ]market|gtm)\b/i,
            /\b(pipeline|demand generation|growth)\b/i,
            /\b(retention|churn)\b/i,
            // Added (revenue-oriented marketing signals beyond quota)
            /\b(demand)\b/i,
            /\b(pipeline generation)\b/i,
            /\b(full[- ]funnel|full funnel)\b/i,
            /\b(campaign objectives|success metrics)\b/i,
            /\b(account engagement)\b/i,
          ],
        },
        {
          level: 2,
          patterns: [
            /\b(revenue|ARR|MRR|bookings)\b/i,
            /\b(quota|quota[- ]carrying)\b/i,
            /\b(monetiz(e|ation)|pricing)\b/i,
            /\b(p&l|P&L)\b/i,
          ],
        },
      ],
    },
    {
      key: "roleAmbiguity",
      rulesByLevel: [
        {
          level: 0,
          patterns: [
            /\b(key responsibilities|responsibilities include)\b/i,
            /\b(you will|you are responsible for)\b/i,
            /\b(clear (role|scope)|well[- ]defined)\b/i,
          ],
        },
        {
          level: 1,
          patterns: [
            /\b(cross[- ]functional|cross functional)\b/i,
            /\b(wear many hats|varied responsibilities)\b/i,
            /\b(ambigu(ous|ity)|evolving scope)\b/i,
            // Added (coordination / translation / planning cadence signals)
            /\b(highly collaborative)\b/i,
            /\b(define (the )?(voice|needs|opportunities))\b/i,
            /\b(translate (insights?|research|data) into (frameworks?|plans?|strategy))\b/i,
            /\b(planning cycles?|sprints?)\b/i,
          ],
        },
        {
          level: 2,
          patterns: [
            /\b(other duties as assigned)\b/i,
            /\b(figure it out|unstructured|undefined)\b/i,
            /\b(generalist|jack of all trades)\b/i,
          ],
        },
      ],
    },
    {
      key: "breadthVsDepth",
      rulesByLevel: [
        {
          level: 0,
          patterns: [
            /\b(specialist|subject matter expert|SME)\b/i,
            /\b(deep expertise|deep technical)\b/i,
            /\b(expert in|expertise in)\b/i,
          ],
        },
        {
          level: 1,
          patterns: [
            /\b(end[- ]to[- ]end|end to end)\b/i,
            /\b(full[- ]stack|full stack)\b/i,
            /\b(breadth and depth|both (breadth|strategy) and (depth|execution))\b/i,
            // Added (strategy + execution across multiple marketing artifacts)
            /\b(strategy( and)? (execution|delivery))\b/i,
            /\b(messaging|positioning)\b/i,
            /\b(content (strategy|development)|content creation)\b/i,
          ],
        },
        {
          level: 2,
          patterns: [
            /\b(generalist|multi[- ]disciplinary|multidisciplinary)\b/i,
            /\b(across (multiple|many) (areas|functions|domains))\b/i,
            /\b(variety of|wide range of)\b/i,
            // Added (explicit breadth bundle: strategy + messaging + content + campaigns + enablement + research)
            /\b(strategy\b/i,
            /\b(messaging|positioning)\b/i,
            /\b(content)\b/i,
            /\b(campaigns?)\b/i,
            /\b(enablement)\b/i,
            /\b(research|insights?)\b/i,
          ],
        },
      ],
    },
    {
      key: "stakeholderDensity",
      rulesByLevel: [
        {
          level: 0,
          patterns: [
            /\b(within the team|within your team)\b/i,
            /\b(report(s|ing)? to)\b/i,
            /\b(single (stakeholder|leader|manager))\b/i,
          ],
        },
        {
          level: 1,
          patterns: [
            /\b(cross[- ]functional|cross functional)\b/i,
            /\b(partner with|collaborate with)\b/i,
            /\b(stakeholders?)\b/i,
            /\b(multiple teams|several teams)\b/i,
          ],
        },
        {
          level: 2,
          patterns: [
            /\b(executive stakeholders|c[- ]suite|C[- ]suite)\b/i,
            /\b(board|board of directors)\b/i,
            /\b(customers? and partners?)\b/i,
            /\b(multiple departments|organization[- ]wide|org[- ]wide)\b/i,
            // Added (explicit cross-functional density across many functions)
            /\b(work across (product|marketing|sales|pr|web|events|education)\b/i,
            /\b(product\/marketing\/sales\b/i,
            /\b(marketing\/sales\/product)\b/i,
            /\b(collaborat(e|ion) (with|across))\b/i,
          ],
        },
      ],
    },
  ];

  const encoded: Partial<Record<JobIngestDimensionKey, JobIngestDimensionEvidence>> = {};
  let anySignalCount = 0;

  for (const dim of dimensions) {
    const ev = encodeDimension(normalizedText, dim);
    if (ev) {
      encoded[dim.key] = ev;
      anySignalCount += ev.evidence.length;
    }
  }

  if (anySignalCount === 0) {
    throw makeError({
      name: "JobIngestError",
      code: "UNABLE_TO_EXTRACT_ANY_SIGNAL",
      detail: "Unable to extract any structural role-demand signal from job text",
    });
  }

  const missing: JobIngestDimensionKey[] = [];
  for (const dim of dimensions) {
    if (!encoded[dim.key]) missing.push(dim.key);
  }

  if (missing.length > 0) {
    throw makeError({
      name: "JobIngestError",
      code: "INCOMPLETE_DIMENSION_COVERAGE",
      detail: "Insufficient signal to encode all six role vector dimensions",
      meta: { missingDimensions: missing },
    });
  }

  const structuralMaturity = encoded.structuralMaturity as JobIngestDimensionEvidence;
  const authorityScope = encoded.authorityScope as JobIngestDimensionEvidence;
  const revenueOrientation = encoded.revenueOrientation as JobIngestDimensionEvidence;
  const roleAmbiguity = encoded.roleAmbiguity as JobIngestDimensionEvidence;
  const breadthVsDepth = encoded.breadthVsDepth as JobIngestDimensionEvidence;
  const stakeholderDensity = encoded.stakeholderDensity as JobIngestDimensionEvidence;

  const roleVector: number[] = [
    structuralMaturity.level,
    authorityScope.level,
    revenueOrientation.level,
    roleAmbiguity.level,
    breadthVsDepth.level,
    stakeholderDensity.level,
  ];

  return {
    jobText,
    normalizedText,
    roleVector,
    dimensionEvidence: {
      structuralMaturity,
      authorityScope,
      revenueOrientation,
      roleAmbiguity,
      breadthVsDepth,
      stakeholderDensity,
    },
  };
}

export function isJobIngestError(err: unknown): err is JobIngestError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as any).name === "JobIngestError" &&
    typeof (err as any).code === "string" &&
    typeof (err as any).detail === "string"
  );
}