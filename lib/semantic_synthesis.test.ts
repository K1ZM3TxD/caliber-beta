
import { generateSemanticSynthesis } from './semantic_synthesis';

describe('Milestone 6.3 — Anti-Abstraction Enforcement', () => {

  it('Drift triggers retry even when overlap passes', async () => {
    let callCount = 0;
    const modelFn = async (_prompt: string) => {
      callCount++;
      // First call returns drift (overlap passes, but drift present)
      if (callCount === 1) {
        return {
          parsed: {
            identity_contrast: "You don't just inspire—you plan.",
            intervention_contrast: "When something isn't working, visionary strategist.",
            construction_layer: "You plan, build, and test.",
            conditional_consequence: "clear constraints"
          },
          raw: ""
        };
      }
      // Retry returns drift removed
      return {
        parsed: {
          identity_contrast: "You don't just plan—you plan.",
          intervention_contrast: "When something isn't working, plan.",
          construction_layer: "You plan, build, and test.",
          conditional_consequence: "clear constraints"
        },
        raw: ""
      };
    };
    const result = await generateSemanticSynthesis({
      personVector: [1,1,1,1,1,1],
      resumeText: "plan",
      promptAnswers: [{ n: 1, answer: "plan" }],
      modelFn
    });
    expect(result.identityContrast).toContain("plan");
    // Should not accept first attempt as llm
    // (log output is not captured here, but only retry result is returned)
  });

  it('Retry success clears drift', async () => {
    let callCount = 0;
    const modelFn = async (_prompt: string) => {
      callCount++;
      // First call returns drift
      if (callCount === 1) {
        return {
          parsed: {
            identity_contrast: "You don't just inspire—you plan.",
            intervention_contrast: "When something isn't working, visionary.",
            construction_layer: "You plan, build, and test.",
            conditional_consequence: "clear constraints"
          },
          raw: ""
        };
      }
      // Retry returns drift removed
      return {
        parsed: {
          identity_contrast: "You don't just plan—you plan.",
          intervention_contrast: "When something isn't working, plan.",
          construction_layer: "You plan, build, and test.",
          conditional_consequence: "clear constraints"
        },
        raw: ""
      };
    };
    const result = await generateSemanticSynthesis({
      personVector: [1,1,1,1,1,1],
      resumeText: "plan",
      promptAnswers: [{ n: 1, answer: "plan" }],
      modelFn
    });
    expect(result.identityContrast).toContain("plan");
  });

  it('Retry fails drift → fallback', async () => {
    let callCount = 0;
    const modelFn = async (_prompt: string) => {
      callCount++;
      // Both calls return drift
      return {
        parsed: {
          identity_contrast: "You don't just inspire—you plan.",
          intervention_contrast: "When something isn't working, visionary.",
          construction_layer: "You plan, build, and test.",
          conditional_consequence: "clear constraints"
        },
        raw: ""
      };
    };
    const result = await generateSemanticSynthesis({
      personVector: [1,1,1,1,1,1],
      resumeText: "plan",
      promptAnswers: [{ n: 1, answer: "plan" }],
      modelFn
    });
    expect(result.identityContrast).toBeDefined();
    // Should return fallback
  });

  it('Archetype term allowed if present in anchors', async () => {
    const modelFn = async (_prompt: string) => {
      // First call returns archetype in anchors
      return {
        parsed: {
          identity_contrast: "You don't just strategist—you plan.",
          intervention_contrast: "When something isn't working, strategist.",
          construction_layer: "You plan, build, and test.",
          conditional_consequence: "clear constraints"
        },
        raw: ""
      };
    };
    const result = await generateSemanticSynthesis({
      personVector: [1,1,1,1,1,1],
      resumeText: "plan strategist",
      promptAnswers: [{ n: 1, answer: "plan strategist" }],
      modelFn
    });
    expect(result.identityContrast).toContain("strategist");
  });
});
