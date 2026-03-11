// lib/calibration_result_copy.test.ts
import {
  generateCalibrationResultCopy,
  computeSignalStrength,
  classifyConfidenceBand,
  type ConfidenceBand,
  type CalibrationResultCopy,
} from "./calibration_result_copy";

import chris from "../fixtures/calibration_profiles/chris.json";
import jen from "../fixtures/calibration_profiles/jen.json";
import fabio from "../fixtures/calibration_profiles/fabio.json";
import dingus from "../fixtures/calibration_profiles/dingus.json";

// ─── Helpers ────────────────────────────────────────────────────────────────

function promptsArray(profile: typeof chris): string[] {
  return [
    profile.prompt_answers.prompt_1,
    profile.prompt_answers.prompt_2,
    profile.prompt_answers.prompt_3,
    profile.prompt_answers.prompt_4,
    profile.prompt_answers.prompt_5,
  ];
}

function gen(profile: typeof chris): CalibrationResultCopy {
  return generateCalibrationResultCopy(profile.resume_text, promptsArray(profile));
}

// Thin-input synthetic control (minimal text, per caliber doctrine)
const THIN_RESUME = "Software developer. 3 years.";
const THIN_PROMPTS = ["I like coding.", "", "", "", ""];

// ─── Signal strength / band classification unit tests ───────────────────────

describe("computeSignalStrength", () => {
  it("returns 100 for very long input", () => {
    const long = "word ".repeat(500);
    expect(computeSignalStrength(long, [])).toBe(100);
  });

  it("returns 0 for empty input", () => {
    expect(computeSignalStrength("", [])).toBe(0);
  });

  it("returns a value proportional to word count", () => {
    const s = computeSignalStrength("one two three", []);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(10);
  });
});

describe("classifyConfidenceBand", () => {
  it("strong at 7.0", () => expect(classifyConfidenceBand(7.0)).toBe("strong"));
  it("strong at 9.9", () => expect(classifyConfidenceBand(9.9)).toBe("strong"));
  it("moderate at 4.0", () => expect(classifyConfidenceBand(4.0)).toBe("moderate"));
  it("moderate at 6.9", () => expect(classifyConfidenceBand(6.9)).toBe("moderate"));
  it("weak at 3.9", () => expect(classifyConfidenceBand(3.9)).toBe("weak"));
  it("weak at 0", () => expect(classifyConfidenceBand(0)).toBe("weak"));
});

// ─── Fixture-based integration tests ────────────────────────────────────────

describe("generateCalibrationResultCopy", () => {
  describe("Chris (strong profile)", () => {
    let result: CalibrationResultCopy;
    beforeAll(() => { result = gen(chris); });

    it("classifies as strong band", () => {
      expect(result.band).toBe("strong");
    });

    it("signal strength >= 60", () => {
      expect(result.signalStrength).toBeGreaterThanOrEqual(60);
    });

    it("produces a non-empty context sentence from pattern synthesis", () => {
      expect(result.contextSentence.length).toBeGreaterThan(20);
      // Should contain content derived from synthesis, not the fallback
      expect(result.contextSentence).not.toContain("don\u2019t have enough signal");
    });

    it("market label sentence is the standard intro", () => {
      expect(result.marketLabelSentence).toContain("closest market label");
    });

    it("produces a market title", () => {
      expect(result.marketTitle).toBeTruthy();
      expect(typeof result.marketTitle).toBe("string");
      expect(result.marketTitle!.length).toBeGreaterThan(2);
    });
  });

  describe("Jen (strong profile)", () => {
    let result: CalibrationResultCopy;
    beforeAll(() => { result = gen(jen); });

    it("classifies as strong band", () => {
      expect(result.band).toBe("strong");
    });

    it("signal strength >= 60", () => {
      expect(result.signalStrength).toBeGreaterThanOrEqual(60);
    });

    it("produces non-empty context sentence", () => {
      expect(result.contextSentence.length).toBeGreaterThan(20);
    });

    it("market label sentence is the standard intro", () => {
      expect(result.marketLabelSentence).toContain("closest market label");
    });

    it("produces a market title", () => {
      expect(result.marketTitle).toBeTruthy();
      expect(result.marketTitle!.length).toBeGreaterThan(2);
    });
  });

  describe("Fabio (strong profile)", () => {
    let result: CalibrationResultCopy;
    beforeAll(() => { result = gen(fabio); });

    it("classifies as strong band", () => {
      expect(result.band).toBe("strong");
    });

    it("signal strength >= 60", () => {
      expect(result.signalStrength).toBeGreaterThanOrEqual(60);
    });

    it("produces non-empty context sentence", () => {
      expect(result.contextSentence.length).toBeGreaterThan(20);
    });

    it("market label sentence is the standard intro", () => {
      expect(result.marketLabelSentence).toContain("closest market label");
    });

    it("produces a market title", () => {
      expect(result.marketTitle).toBeTruthy();
      expect(result.marketTitle!.length).toBeGreaterThan(2);
    });
  });

  describe("Dingus (weak profile)", () => {
    let result: CalibrationResultCopy;
    beforeAll(() => { result = gen(dingus); });

    it("classifies as weak or moderate (not strong)", () => {
      expect(["weak", "moderate"]).toContain(result.band);
    });

    it("context sentence reflects uncertainty", () => {
      // Should not contain synthesis-derived confident language
      const lc = result.contextSentence.toLowerCase();
      expect(
        lc.includes("don\u2019t have enough signal") ||
        lc.includes("fuller picture") ||
        lc.includes("more detail")
      ).toBe(true);
    });

    it("if weak band, no market title is shown", () => {
      if (result.band === "weak") {
        expect(result.marketTitle).toBeNull();
        expect(result.marketLabelSentence).toContain("more detail");
      }
    });

    it("if moderate band, market label sentence matches title presence", () => {
      if (result.band === "moderate") {
        if (result.marketTitle) {
          expect(result.marketLabelSentence).toContain("closest market label");
        } else {
          expect(result.marketLabelSentence).toContain("more detail");
        }
      }
    });
  });

  describe("Thin-input synthetic control", () => {
    let result: CalibrationResultCopy;
    beforeAll(() => { result = generateCalibrationResultCopy(THIN_RESUME, THIN_PROMPTS); });

    it("classifies as weak band", () => {
      expect(result.band).toBe("weak");
    });

    it("signal strength < 30", () => {
      expect(result.signalStrength).toBeLessThan(30);
    });

    it("context sentence indicates more input needed", () => {
      expect(result.contextSentence).toContain("enough signal");
    });

    it("does not produce a market title", () => {
      expect(result.marketTitle).toBeNull();
    });

    it("market label sentence prompts for more input", () => {
      expect(result.marketLabelSentence).toContain("more detail");
    });
  });

  // ─── Cross-profile invariants ─────────────────────────────────────────────

  describe("cross-profile invariants", () => {
    const all = [
      { name: "Chris", result: gen(chris) },
      { name: "Jen", result: gen(jen) },
      { name: "Fabio", result: gen(fabio) },
      { name: "Dingus", result: gen(dingus) },
      { name: "Thin", result: generateCalibrationResultCopy(THIN_RESUME, THIN_PROMPTS) },
    ];

    it("all results have defined band, contextSentence, marketLabelSentence", () => {
      for (const { name, result } of all) {
        expect(result.band).toBeDefined();
        expect(result.contextSentence.length).toBeGreaterThan(0);
        expect(result.marketLabelSentence.length).toBeGreaterThan(0);
        expect(typeof result.signalStrength).toBe("number");
      }
    });

    it("strong profiles all have market titles; weak profiles do not", () => {
      for (const { name, result } of all) {
        if (result.band === "strong") {
          expect(result.marketTitle).toBeTruthy();
        }
        if (result.band === "weak") {
          expect(result.marketTitle).toBeNull();
        }
      }
    });

    it("second sentence always matches title presence", () => {
      for (const { name, result } of all) {
        if (result.marketTitle) {
          expect(result.marketLabelSentence).toContain("closest market label");
        } else {
          expect(result.marketLabelSentence).toContain("more detail");
        }
      }
    });
  });
});
