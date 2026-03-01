// scripts/calibration_smoke.mjs
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

const BASE_URL = process.env.CALIBER_BASE_URL || "http://localhost:3000";
const FIXTURE_DIR = path.resolve("scripts/fixtures");
const PROMPT_ANSWERS = [
  // Each answer is >= 120 chars, concrete, and unique
  "In my previous role, I led a cross-functional team of 12 people, managed multiple product launches, and coordinated with engineering, design, and marketing to deliver results on time and within budget. My leadership ensured project success and team growth.",
  "I managed a product launch for a SaaS platform, overseeing requirements gathering, stakeholder alignment, and go-to-market strategy. I worked closely with sales, support, and engineering to ensure a smooth rollout and post-launch customer satisfaction.",
  "I worked with stakeholders from various departments, including finance, operations, and external partners, to define product requirements, resolve conflicts, and drive consensus. My communication and negotiation skills helped achieve shared goals.",
  "I made decisions under pressure, balancing competing priorities and limited resources. I used data-driven analysis and team input to select the best course of action, ensuring business objectives were met and risks were mitigated.",
  "I handled ambiguity by creating clear project plans, setting measurable goals, and adapting to changing circumstances. I fostered a culture of transparency and continuous improvement, enabling my team to thrive in uncertain environments."
];

function printProgress(idx, total, event) {
  console.log(`START step ${idx}/${total}: ${event}`);
}
function printSummary(status, ok, state, hasResult) {
  console.log(`DONE step: status=${status} ok=${ok} state=${state} hasResult=${!!hasResult}`);
}
function printFail(event, status, code, message, json) {
  console.error(`-> FAIL at event=${event} status=${status} code=${code} message="${message}"`);
  console.error(JSON.stringify(json, null, 2));
}
function runId() {
  return `run_${Date.now()}_${Math.floor(Math.random()*10000)}`;
}
async function main() {
  const id = runId();
  console.log(`Calibration smoke test: ${id}`);
  // Load fixtures
  const resume = await fs.readFile(path.join(FIXTURE_DIR, "resume.txt"), "utf8");
  const jobGood = await fs.readFile(path.join(FIXTURE_DIR, "job_good.txt"), "utf8");
  const jobThin = await fs.readFile(path.join(FIXTURE_DIR, "job_thin.txt"), "utf8");

  let idx = 1;
  let total = 10;
  let session = null;
  // 1. CREATE_SESSION
  printProgress(idx++, total, "CREATE_SESSION");
  let res = await fetch(`${BASE_URL}/api/calibration`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: { type: "CREATE_SESSION" } })
  });
  let json = await res.json();
  if (!res.ok || !json.ok) return printFail("CREATE_SESSION", res.status, json?.error?.code, json?.error?.message, json), process.exit(1);
  session = json.session;
  printSummary(res.status, json.ok, session?.state, session?.result);

  // 2. SUBMIT_RESUME
  printProgress(idx++, total, "SUBMIT_RESUME");
  const form = new FormData();
  form.append("sessionId", session.sessionId);
  // Use supported MIME type for .txt
  const resumeFile = new File([resume], "resume.txt", { type: "text/plain" });
  form.append("file", resumeFile);
  console.log(`Uploading resume: filename=resume.txt mime=text/plain`);
  res = await fetch(`${BASE_URL}/api/calibration/resume-upload`, { method: "POST", body: form });
  json = await res.json();
  if (!res.ok || !json.ok) return printFail("SUBMIT_RESUME", res.status, json?.error?.code, json?.error?.message, json), process.exit(1);
  session = json.session;
  printSummary(res.status, json.ok, session?.state, session?.result);

  // 3-7. SUBMIT_PROMPT_ANSWER x5
  for (let i = 0; i < 5; ++i) {
    printProgress(idx++, total, "SUBMIT_PROMPT_ANSWER");
    res = await fetch(`${BASE_URL}/api/calibration`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "SUBMIT_PROMPT_ANSWER", sessionId: session.sessionId, answer: PROMPT_ANSWERS[i] } })
    });
    json = await res.json();
    if (!res.ok || !json.ok) {
      printFail("SUBMIT_PROMPT_ANSWER", res.status, json?.error?.code, json?.error?.message, json);
      console.error(`Last known session.state: ${session?.state}`);
      process.exit(1);
    }
    session = json.session;
    printSummary(res.status, json.ok, session?.state, session?.result);
  }

  // Advance out of CONSOLIDATION_PENDING before SUBMIT_JOB_TEXT
  let advanceAttempts = 0;
  const maxAdvance = 40;
  while (["CONSOLIDATION_PENDING", "CONSOLIDATION_RITUAL"].includes(String(session?.state)) && advanceAttempts < maxAdvance) {
    if (String(session?.state) === "CONSOLIDATION_RITUAL") {
      await new Promise(r => setTimeout(r, 550));
    }
    printProgress(`ADVANCE-${advanceAttempts+1}`, maxAdvance, `ADVANCE (out of ${session?.state})`);
    res = await fetch(`${BASE_URL}/api/calibration`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "ADVANCE", sessionId: session.sessionId } })
    });
    json = await res.json();
    if (!res.ok || !json.ok) {
      printFail(`ADVANCE (out of ${session?.state})`, res.status, json?.error?.code, json?.error?.message, json);
      console.error(`Last known session.state: ${session?.state}`);
      process.exit(1);
    }
    session = json.session;
    printSummary(res.status, json.ok, session?.state, session?.result);
    advanceAttempts++;
    if (String(session?.state) === "PATTERN_SYNTHESIS") break;
  }
  if (["CONSOLIDATION_PENDING", "CONSOLIDATION_RITUAL"].includes(String(session?.state))) {
    console.error(`ERROR: Still in ${session?.state} after max ADVANCE attempts.`);
    process.exit(1);
  }

  // ADVANCE to TITLE_HYPOTHESIS (<=3 tries)
  let titleTries = 0;
  while (String(session?.state) !== "TITLE_HYPOTHESIS" && titleTries < 3) {
    printProgress(`ADVANCE-TITLE_HYPOTHESIS-${titleTries+1}`, 3, "ADVANCE to TITLE_HYPOTHESIS");
    res = await fetch(`${BASE_URL}/api/calibration`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "ADVANCE", sessionId: session.sessionId } })
    });
    json = await res.json();
    if (!res.ok || !json.ok) {
      printFail("ADVANCE to TITLE_HYPOTHESIS", res.status, json?.error?.code, json?.error?.message, json);
      console.error(`Last known session.state: ${session?.state}`);
      process.exit(1);
    }
    session = json.session;
    printSummary(res.status, json.ok, session?.state, session?.result);
    titleTries++;
  }
  if (String(session?.state) !== "TITLE_HYPOTHESIS") {
    console.error("ERROR: Did not reach TITLE_HYPOTHESIS after ADVANCE attempts.");
    process.exit(1);
  }

  // ADVANCE to TITLE_DIALOGUE (<=3 tries)
  let dialogueTries = 0;
  while (String(session?.state) !== "TITLE_DIALOGUE" && dialogueTries < 3) {
    printProgress(`ADVANCE-TITLE_DIALOGUE-${dialogueTries+1}`, 3, "ADVANCE to TITLE_DIALOGUE");
    res = await fetch(`${BASE_URL}/api/calibration`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { type: "ADVANCE", sessionId: session.sessionId } })
    });
    json = await res.json();
    if (!res.ok || !json.ok) {
      printFail("ADVANCE to TITLE_DIALOGUE", res.status, json?.error?.code, json?.error?.message, json);
      console.error(`Last known session.state: ${session?.state}`);
      process.exit(1);
    }
    session = json.session;
    printSummary(res.status, json.ok, session?.state, session?.result);
    dialogueTries++;
  }
  if (String(session?.state) !== "TITLE_DIALOGUE") {
    console.error("ERROR: Did not reach TITLE_DIALOGUE after ADVANCE attempts.");
    process.exit(1);
  }

  // 8. SUBMIT_JOB_TEXT (job_good.txt)
  printProgress(idx++, total, "SUBMIT_JOB_TEXT");
  res = await fetch(`${BASE_URL}/api/calibration`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: { type: "SUBMIT_JOB_TEXT", sessionId: session.sessionId, jobText: jobGood } })
  });
  json = await res.json();
  if (!res.ok || !json.ok) return printFail("SUBMIT_JOB_TEXT", res.status, json?.error?.code, json?.error?.message, json), process.exit(1);
  session = json.session;
  printSummary(res.status, json.ok, session?.state, session?.result);

  // 9. ADVANCE (to ALIGNMENT_OUTPUT)
  printProgress(idx++, total, "ADVANCE");
  res = await fetch(`${BASE_URL}/api/calibration`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: { type: "ADVANCE", sessionId: session.sessionId } })
  });
  json = await res.json();
  if (!res.ok || !json.ok) return printFail("ADVANCE", res.status, json?.error?.code, json?.error?.message, json), process.exit(1);
  session = json.session;
  printSummary(res.status, json.ok, session?.state, session?.result);

  // 10. COMPUTE_ALIGNMENT_OUTPUT
  printProgress(idx++, total, "COMPUTE_ALIGNMENT_OUTPUT");
  res = await fetch(`${BASE_URL}/api/calibration`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: { type: "COMPUTE_ALIGNMENT_OUTPUT", sessionId: session.sessionId } })
  });
  json = await res.json();
  if (!res.ok || !json.ok) return printFail("COMPUTE_ALIGNMENT_OUTPUT", res.status, json?.error?.code, json?.error?.message, json), process.exit(1);
  session = json.session;
  printSummary(res.status, json.ok, session?.state, session?.result);

  // Assert result
  if (String(session?.state) !== "TERMINAL_COMPLETE" && !session?.result) {
    console.error(`Expected result after COMPUTE_ALIGNMENT_OUTPUT, got state=${session?.state} hasResult=${!!session?.result}`);
    console.error(JSON.stringify(session, null, 2));
    process.exit(1);
  }

  console.log("Smoke test completed successfully.");
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
