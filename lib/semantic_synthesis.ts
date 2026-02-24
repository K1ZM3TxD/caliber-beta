function detectDriftFlags(synthesisText, anchorTerms) {
  const praiseTerms = ["inspiring","impressive","exceptional","outstanding","remarkable","amazing","fantastic","brilliant","world-class","stellar"];
  const abstractionTerms = ["visionary","thought leader","changemaker","trailblazer","rockstar","guru","ninja","unicorn","authentic self","passion","purpose","destiny","calling"];
  const archetypeTerms = ["strategist","operator","builder","architect","executor","leader","innovator"];

  let praise_flag = false;
  let abstraction_flag = false;
  const drift_terms = new Set();

  // Check for praise terms
  praiseTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(synthesisText)) {
      praise_flag = true;
    }
  });

  // Check for abstraction or archetype drift terms
  [...abstractionTerms, ...archetypeTerms].forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(synthesisText) && !anchorTerms.map(anchor => anchor.toLowerCase()).includes(term.toLowerCase())) {
      abstraction_flag = true;
      drift_terms.add(term);
    }
  });

  return {
    praise_flag,
    abstraction_flag,
    drift_terms: Array.from(drift_terms).sort(),
  };
}

// ... existing content ... // the following section updates the log statements ... //
[{llm, praise_flag=${flags.praise_flag}, abstraction_flag=${flags.abstraction_flag}}] 
[{retry, praise_flag=${flags.praise_flag}, abstraction_flag=${flags.abstraction_flag}}] 
[{fallback, praise_flag=${flags.praise_flag}, abstraction_flag=${flags.abstraction_flag}}] 
// --- SELF-CHECK: Drift detection validation ---
if (process.env.NODE_ENV === "development" || process.env.RUN_SELF_CHECK === "true") {
  const testFlags = detectDriftFlags("inspiring visionary strategist", [])
  console.assert(testFlags.praise_flag === true, "Self-check failed: praise_flag should be true")
  console.assert(testFlags.abstraction_flag === true, "Self-check failed: abstraction_flag should be true")
  console.assert(testFlags.drift_terms.includes("inspiring"), "Self-check failed: drift_terms should include 'inspiring'")
  console.assert(testFlags.drift_terms.includes("visionary"), "Self-check failed: drift_terms should include 'visionary'")
  console.assert(testFlags.drift_terms.includes("strategist"), "Self-check failed: drift_terms should include 'strategist'")
  
  const testFlags2 = detectDriftFlags("inspiring visionary strategist", ["strategist"])
  console.assert(testFlags2.abstraction_flag === true, "Self-check failed: abstraction_flag should still be true (visionary)")
  console.assert(!testFlags2.drift_terms.includes("strategist"), "Self-check failed: drift_terms should NOT include 'strategist' when in anchors")
}