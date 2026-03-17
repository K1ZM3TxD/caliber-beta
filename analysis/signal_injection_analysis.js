#!/usr/bin/env node
/**
 * Signal Injection Telemetry Analysis
 *
 * Reads TelemetryEvent rows from Neon (Prisma) and compares scoring outcomes
 * between signal_on and signal_off conditions for the same jobs.
 *
 * Usage:  node analysis/signal_injection_analysis.js
 *
 * Outputs:
 *   analysis/signal_injection_telemetry_summary.json
 *   analysis/signal_injection_telemetry_report.md
 */

const { PrismaClient } = require("@prisma/client");

const STRONG_MATCH_THRESHOLD = 7.0;

async function main() {
  const prisma = new PrismaClient();

  try {
    const allEvents = await prisma.telemetryEvent.findMany({
      orderBy: { timestamp: "asc" },
    });

    // ── Condition tagging ──────────────────────────────────────
    function condition(row) {
      if (row.sessionId && row.sessionId.includes("::signal_on")) return "signal_on";
      if (row.sessionId && row.sessionId.includes("::signal_off")) return "signal_off";
      // Fall back to signalPreference field
      if (row.signalPreference === "yes") return "signal_on";
      if (row.signalPreference === "no") return "signal_off";
      return "untagged";
    }

    const onEvents = allEvents.filter((r) => condition(r) === "signal_on");
    const offEvents = allEvents.filter((r) => condition(r) === "signal_off");
    const untagged = allEvents.filter((r) => condition(r) === "untagged");

    // ── Job identity key ───────────────────────────────────────
    // Prefer canonical jobUrl; fall back to normalized title+company composite.
    function jobKey(row) {
      // Try to extract LinkedIn job ID from URL
      if (row.jobUrl) {
        const m = row.jobUrl.match(/currentJobId=(\d+)/);
        if (m) return "li:" + m[1];
        const m2 = row.jobUrl.match(/\/jobs\/view\/(\d+)/);
        if (m2) return "li:" + m2[1];
      }
      // Composite fallback: normalized title + company
      const title = (row.jobTitle || "").trim().toLowerCase();
      const company = (row.company || "").trim().toLowerCase();
      if (title && company) return "composite:" + title + "|" + company;
      return null; // unmatchable
    }

    // ── Build per-condition score maps ─────────────────────────
    // For job_score_rendered: use latest score per job within each condition.
    // Also include strong_match_viewed and job_opened WITH scores as secondary.
    function buildScoreMap(events) {
      const map = new Map(); // jobKey -> { score, jobTitle, company, jobUrl, timestamp, event }
      // Prefer job_score_rendered; then strong_match_viewed; then job_opened
      const priority = { job_score_rendered: 3, strong_match_viewed: 2, job_opened: 1 };
      for (const row of events) {
        if (row.score === null || row.score === undefined) continue;
        const key = jobKey(row);
        if (!key) continue;
        const p = priority[row.event] || 0;
        const existing = map.get(key);
        if (!existing || p > (priority[existing.event] || 0) ||
            (p === (priority[existing.event] || 0) && row.timestamp > existing.timestamp)) {
          map.set(key, {
            score: row.score,
            jobTitle: row.jobTitle,
            company: row.company,
            jobUrl: row.jobUrl,
            timestamp: row.timestamp,
            event: row.event,
          });
        }
      }
      return map;
    }

    const onScores = buildScoreMap(onEvents);
    const offScores = buildScoreMap(offEvents);

    // ── Match same-job pairs ───────────────────────────────────
    const pairs = [];
    for (const [key, onData] of onScores) {
      const offData = offScores.get(key);
      if (offData) {
        pairs.push({
          key,
          jobTitle: onData.jobTitle || offData.jobTitle,
          company: onData.company || offData.company,
          jobUrl: onData.jobUrl || offData.jobUrl,
          signal_on_score: onData.score,
          signal_off_score: offData.score,
          delta: Math.round((onData.score - offData.score) * 100) / 100,
          on_event: onData.event,
          off_event: offData.event,
        });
      }
    }

    // ── Compute statistics ─────────────────────────────────────
    const deltas = pairs.map((p) => p.delta);
    deltas.sort((a, b) => a - b);

    const mean = deltas.length > 0 ? deltas.reduce((s, d) => s + d, 0) / deltas.length : 0;
    const median = deltas.length > 0 ? deltas[Math.floor(deltas.length / 2)] : 0;
    const min = deltas.length > 0 ? deltas[0] : 0;
    const max = deltas.length > 0 ? deltas[deltas.length - 1] : 0;

    const improved = pairs.filter((p) => p.delta > 0).length;
    const unchanged = pairs.filter((p) => p.delta === 0).length;
    const worsened = pairs.filter((p) => p.delta < 0).length;

    // Strong match counts per condition (all scored jobs, not just matched pairs)
    const onStrong = [...onScores.values()].filter((d) => d.score >= STRONG_MATCH_THRESHOLD).length;
    const offStrong = [...offScores.values()].filter((d) => d.score >= STRONG_MATCH_THRESHOLD).length;
    const onTotal = onScores.size;
    const offTotal = offScores.size;

    // Threshold crossings: jobs that are strong_match in signal_on but NOT in signal_off
    const thresholdCrossings = pairs.filter(
      (p) => p.signal_on_score >= STRONG_MATCH_THRESHOLD && p.signal_off_score < STRONG_MATCH_THRESHOLD
    ).length;
    const thresholdDrops = pairs.filter(
      (p) => p.signal_on_score < STRONG_MATCH_THRESHOLD && p.signal_off_score >= STRONG_MATCH_THRESHOLD
    ).length;

    // Top deltas
    const sortedByDelta = [...pairs].sort((a, b) => b.delta - a.delta);
    const top10Positive = sortedByDelta.filter((p) => p.delta > 0).slice(0, 10);
    const top10Negative = sortedByDelta.filter((p) => p.delta < 0).slice(-10).reverse();

    // ── TTSM (secondary) ──────────────────────────────────────
    // Time from search_surface_opened to first strong_match_viewed on same surface+session
    function computeTTSM(events) {
      const surfaceOpened = new Map(); // surfaceKey::sessionBase -> earliest timestamp
      const firstStrong = new Map();
      
      for (const row of events) {
        const sessionBase = row.sessionId ? row.sessionId.split("::")[0] : null;
        if (!sessionBase || !row.surfaceKey) continue;
        const sk = row.surfaceKey + "::" + sessionBase;
        
        if (row.event === "search_surface_opened") {
          if (!surfaceOpened.has(sk) || row.timestamp < surfaceOpened.get(sk)) {
            surfaceOpened.set(sk, row.timestamp);
          }
        }
        if (row.event === "strong_match_viewed") {
          if (!firstStrong.has(sk) || row.timestamp < firstStrong.get(sk)) {
            firstStrong.set(sk, row.timestamp);
          }
        }
      }
      
      const ttsms = [];
      for (const [sk, openTime] of surfaceOpened) {
        const strongTime = firstStrong.get(sk);
        if (strongTime && strongTime >= openTime) {
          ttsms.push((strongTime.getTime() - openTime.getTime()) / 1000);
        }
      }
      return ttsms;
    }

    const onTTSM = computeTTSM(onEvents);
    const offTTSM = computeTTSM(offEvents);
    const avgTTSM_on = onTTSM.length > 0 ? onTTSM.reduce((s, t) => s + t, 0) / onTTSM.length : null;
    const avgTTSM_off = offTTSM.length > 0 ? offTTSM.reduce((s, t) => s + t, 0) / offTTSM.length : null;

    // ── Build summary JSON ─────────────────────────────────────
    const summary = {
      generated: new Date().toISOString(),
      dataSource: "TelemetryEvent (Neon/Postgres via Prisma)",
      totalEvents: allEvents.length,
      conditions: {
        signal_on: { events: onEvents.length, scoredJobs: onTotal, strongMatches: onStrong },
        signal_off: { events: offEvents.length, scoredJobs: offTotal, strongMatches: offStrong },
        untagged: { events: untagged.length },
      },
      matching: {
        matchedPairs: pairs.length,
        jobKeyMethod: "LinkedIn job ID from URL (preferred) or normalized title|company composite",
        duplicateRule: "Latest job_score_rendered per job; fallback to strong_match_viewed then job_opened",
      },
      deltas: {
        mean: Math.round(mean * 100) / 100,
        median: Math.round(median * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        improved,
        unchanged,
        worsened,
      },
      strongMatchThreshold: STRONG_MATCH_THRESHOLD,
      thresholdCrossings: {
        gainedBySignalOn: thresholdCrossings,
        lostBySignalOn: thresholdDrops,
      },
      top10PositiveDeltas: top10Positive.map((p) => ({
        jobTitle: p.jobTitle,
        company: p.company,
        signal_on: p.signal_on_score,
        signal_off: p.signal_off_score,
        delta: p.delta,
      })),
      top10NegativeDeltas: top10Negative.map((p) => ({
        jobTitle: p.jobTitle,
        company: p.company,
        signal_on: p.signal_on_score,
        signal_off: p.signal_off_score,
        delta: p.delta,
      })),
      ttsm: {
        signal_on: { surfaces: onTTSM.length, avgSeconds: avgTTSM_on ? Math.round(avgTTSM_on * 10) / 10 : null, values: onTTSM.map((t) => Math.round(t * 10) / 10) },
        signal_off: { surfaces: offTTSM.length, avgSeconds: avgTTSM_off ? Math.round(avgTTSM_off * 10) / 10 : null, values: offTTSM.map((t) => Math.round(t * 10) / 10) },
      },
      allPairs: pairs.map((p) => ({
        key: p.key,
        jobTitle: p.jobTitle,
        company: p.company,
        signal_on: p.signal_on_score,
        signal_off: p.signal_off_score,
        delta: p.delta,
      })),
    };

    // ── Write summary JSON ─────────────────────────────────────
    const fs = require("fs");
    const path = require("path");
    const outDir = path.join(__dirname);
    fs.writeFileSync(
      path.join(outDir, "signal_injection_telemetry_summary.json"),
      JSON.stringify(summary, null, 2)
    );

    // ── Build markdown report ──────────────────────────────────
    let md = "";

    // Conclusions
    md += "# Signal Injection Telemetry Analysis\n\n";
    md += `> Generated: ${summary.generated}\n\n`;

    md += "## Executive Summary\n\n";
    if (pairs.length === 0) {
      md += "**No matched job pairs found across signal_on and signal_off conditions.**\n\n";
      if (offEvents.length < 5) {
        md += `The signal_off condition has only **${offEvents.length}** events (${offTotal} scored jobs). `;
        md += "This is insufficient for a meaningful comparison. ";
        md += "The 50/50 experiment requires a dedicated signal_off scoring run on the same search surfaces.\n\n";
      }
      md += "**Verdict:** Results are not available. A signal_off comparison run is needed before conclusions can be drawn.\n\n";
    } else {
      const direction = mean > 0.3 ? "positive" : mean < -0.3 ? "negative" : "negligible";
      md += `Signal injection produced a **${direction}** mean score shift of **${summary.deltas.mean}** `;
      md += `across **${pairs.length}** matched job pairs.\n\n`;
      md += `- **${improved}** jobs scored higher with signals, **${worsened}** scored lower, **${unchanged}** unchanged.\n`;
      md += `- Strong-match yield: **${onStrong}/${onTotal}** (signal_on) vs **${offStrong}/${offTotal}** (signal_off).\n`;
      md += `- **${thresholdCrossings}** jobs crossed the ${STRONG_MATCH_THRESHOLD}+ threshold only because of signal injection.\n`;
      md += `- **${thresholdDrops}** jobs dropped below threshold with signal injection.\n\n`;
      
      if (pairs.length < 20) {
        md += "**Trustworthiness:** Limited — small matched-pair sample. Results are directional, not statistically conclusive.\n\n";
      } else {
        md += "**Trustworthiness:** Moderate — sufficient sample for directional conclusions.\n\n";
      }
    }

    // Data overview
    md += "## Data Overview\n\n";
    md += "| Metric | signal_on | signal_off | untagged |\n";
    md += "|--------|-----------|------------|----------|\n";
    md += `| Total events | ${onEvents.length} | ${offEvents.length} | ${untagged.length} |\n`;
    md += `| Scored jobs (unique) | ${onTotal} | ${offTotal} | — |\n`;
    md += `| Strong matches (≥${STRONG_MATCH_THRESHOLD}) | ${onStrong} | ${offStrong} | — |\n`;
    md += `| Strong match rate | ${onTotal > 0 ? Math.round((onStrong / onTotal) * 100) : 0}% | ${offTotal > 0 ? Math.round((offStrong / offTotal) * 100) : 0}% | — |\n`;
    md += "\n";

    md += "### Matching Methodology\n\n";
    md += "- **Job identity:** LinkedIn job ID extracted from URL (`currentJobId` or `/jobs/view/{id}`). Fallback: normalized `title|company` composite key.\n";
    md += "- **Duplicate rule:** If multiple score events exist for the same job within a condition, the latest `job_score_rendered` is used. Fallback priority: `strong_match_viewed` > `job_opened`.\n";
    md += `- **Matched pairs:** ${pairs.length} jobs scored in both conditions.\n\n`;

    // Delta statistics
    if (pairs.length > 0) {
      md += "## Score Delta Statistics\n\n";
      md += "Delta = signal_on_score − signal_off_score\n\n";
      md += "| Statistic | Value |\n";
      md += "|-----------|-------|\n";
      md += `| Mean delta | ${summary.deltas.mean} |\n`;
      md += `| Median delta | ${summary.deltas.median} |\n`;
      md += `| Min delta | ${summary.deltas.min} |\n`;
      md += `| Max delta | ${summary.deltas.max} |\n`;
      md += `| Jobs improved | ${improved} |\n`;
      md += `| Jobs unchanged | ${unchanged} |\n`;
      md += `| Jobs worsened | ${worsened} |\n`;
      md += `| Threshold crossings (gained) | ${thresholdCrossings} |\n`;
      md += `| Threshold crossings (lost) | ${thresholdDrops} |\n`;
      md += "\n";

      // Top positive deltas
      if (top10Positive.length > 0) {
        md += "### Top Positive Deltas (signal injection helped most)\n\n";
        md += "| Job Title | Company | signal_on | signal_off | Delta |\n";
        md += "|-----------|---------|-----------|------------|-------|\n";
        for (const p of top10Positive) {
          md += `| ${p.jobTitle || "—"} | ${p.company || "—"} | ${p.signal_on_score} | ${p.signal_off_score} | +${p.delta} |\n`;
        }
        md += "\n";
      }

      // Top negative deltas
      if (top10Negative.length > 0) {
        md += "### Top Negative Deltas (signal injection reduced score)\n\n";
        md += "| Job Title | Company | signal_on | signal_off | Delta |\n";
        md += "|-----------|---------|-----------|------------|-------|\n";
        for (const p of top10Negative) {
          md += `| ${p.jobTitle || "—"} | ${p.company || "—"} | ${p.signal_on_score} | ${p.signal_off_score} | ${p.delta} |\n`;
        }
        md += "\n";
      }

      // All pairs
      md += "### All Matched Pairs\n\n";
      md += "| Job Title | Company | signal_on | signal_off | Delta |\n";
      md += "|-----------|---------|-----------|------------|-------|\n";
      const sortedPairs = [...pairs].sort((a, b) => b.delta - a.delta);
      for (const p of sortedPairs) {
        const sign = p.delta > 0 ? "+" : "";
        md += `| ${p.jobTitle || "—"} | ${p.company || "—"} | ${p.signal_on_score} | ${p.signal_off_score} | ${sign}${p.delta} |\n`;
      }
      md += "\n";
    }

    // TTSM
    md += "## Secondary: Time-to-Strong-Match (TTSM)\n\n";
    if (onTTSM.length === 0 && offTTSM.length === 0) {
      md += "Insufficient sequencing data to compute TTSM (no matched search_surface_opened → strong_match_viewed pairs).\n\n";
    } else {
      md += "TTSM = elapsed seconds from `search_surface_opened` to first `strong_match_viewed` on the same surface/session.\n\n";
      md += "| Condition | Surfaces | Avg TTSM (s) | Values |\n";
      md += "|-----------|----------|-------------|--------|\n";
      md += `| signal_on | ${onTTSM.length} | ${avgTTSM_on !== null ? avgTTSM_on.toFixed(1) : "—"} | ${onTTSM.map((t) => t.toFixed(1)).join(", ") || "—"} |\n`;
      md += `| signal_off | ${offTTSM.length} | ${avgTTSM_off !== null ? avgTTSM_off.toFixed(1) : "—"} | ${offTTSM.map((t) => t.toFixed(1)).join(", ") || "—"} |\n`;
      md += "\n";
      md += "*TTSM is secondary and depends on user browsing speed; sample sizes may be too small for conclusions.*\n\n";
    }

    // Assumptions
    md += "## Assumptions & Limitations\n\n";
    md += "1. Condition is determined by `sessionId` suffix (`::signal_on`/`::signal_off`) with fallback to `signalPreference` field.\n";
    md += "2. Job matching uses LinkedIn job ID when available; otherwise normalized title+company composite. Composite matching may produce false matches if two companies post identically-titled jobs.\n";
    md += "3. If a condition has very few scored jobs, statistical conclusions are unreliable.\n";
    md += "4. Score differences may include natural LinkedIn DOM extraction variance (different text extracted at different times).\n";
    md += "5. `job_score_rendered` is the primary score source (prescan badge scores). `strong_match_viewed` scores (sidecard full-text scores) are used only when no `job_score_rendered` event exists for a job.\n";
    md += "\n---\n*Analysis script: `analysis/signal_injection_analysis.js`*\n";

    fs.writeFileSync(path.join(outDir, "signal_injection_telemetry_report.md"), md);

    // ── Console summary ────────────────────────────────────────
    console.log("=== Signal Injection Telemetry Analysis ===");
    console.log(`Total events: ${allEvents.length}`);
    console.log(`signal_on: ${onEvents.length} events, ${onTotal} scored jobs, ${onStrong} strong matches`);
    console.log(`signal_off: ${offEvents.length} events, ${offTotal} scored jobs, ${offStrong} strong matches`);
    console.log(`untagged: ${untagged.length} events`);
    console.log(`Matched pairs: ${pairs.length}`);
    if (pairs.length > 0) {
      console.log(`Mean delta: ${summary.deltas.mean}`);
      console.log(`Median delta: ${summary.deltas.median}`);
      console.log(`Improved: ${improved}, Unchanged: ${unchanged}, Worsened: ${worsened}`);
      console.log(`Threshold crossings gained: ${thresholdCrossings}, lost: ${thresholdDrops}`);
    }
    console.log(`\nOutputs written to:`);
    console.log(`  analysis/signal_injection_telemetry_summary.json`);
    console.log(`  analysis/signal_injection_telemetry_report.md`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
