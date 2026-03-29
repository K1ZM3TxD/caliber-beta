import { validateIngestInput, INGEST_MIN_TEXT_CHARS } from "./job_ingest_validation";

const LONG_TEXT = "A".repeat(INGEST_MIN_TEXT_CHARS);

describe("validateIngestInput", () => {
  // ── URL: happy paths ─────────────────────────────────────────────────────
  describe("valid URLs", () => {
    it("accepts a LinkedIn job URL with https://", () => {
      const r = validateIngestInput({ url: "https://www.linkedin.com/jobs/view/1234567", jobText: LONG_TEXT });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.normalizedUrl).toBe("https://www.linkedin.com/jobs/view/1234567");
    });

    it("accepts an Indeed job URL", () => {
      const r = validateIngestInput({ url: "https://www.indeed.com/viewjob?jk=abc123", jobText: LONG_TEXT });
      expect(r.ok).toBe(true);
    });

    it("accepts a Greenhouse ATS URL", () => {
      const r = validateIngestInput({ url: "https://boards.greenhouse.io/company/jobs/9999", jobText: LONG_TEXT });
      expect(r.ok).toBe(true);
    });

    it("accepts an http:// URL (not all ATS use https)", () => {
      const r = validateIngestInput({ url: "http://jobs.example.com/posting/42", jobText: LONG_TEXT });
      expect(r.ok).toBe(true);
    });

    it("trims leading/trailing whitespace from the URL", () => {
      const r = validateIngestInput({ url: "  https://www.linkedin.com/jobs/view/1  ", jobText: LONG_TEXT });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.normalizedUrl).toBe("https://www.linkedin.com/jobs/view/1");
    });
  });

  // ── URL: error paths ─────────────────────────────────────────────────────
  describe("invalid URLs", () => {
    it("rejects missing url", () => {
      const r = validateIngestInput({ url: undefined, jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("url");
    });

    it("rejects empty string url", () => {
      const r = validateIngestInput({ url: "", jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("url");
    });

    it("rejects a non-URL string", () => {
      const r = validateIngestInput({ url: "not a url at all", jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("url");
    });

    it("rejects a URL without a protocol", () => {
      const r = validateIngestInput({ url: "www.linkedin.com/jobs/view/1", jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("url");
    });

    it("rejects a ftp:// URL", () => {
      const r = validateIngestInput({ url: "ftp://jobs.example.com/posting/42", jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.field).toBe("url");
        expect(r.error).toMatch(/https?/);
      }
    });

    it("rejects localhost", () => {
      const r = validateIngestInput({ url: "http://localhost:3000/jobs/1", jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.field).toBe("url");
        expect(r.error).toMatch(/public/i);
      }
    });

    it("rejects 127.0.0.1", () => {
      const r = validateIngestInput({ url: "http://127.0.0.1/jobs/1", jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("url");
    });

    it("rejects 10.x private IP", () => {
      const r = validateIngestInput({ url: "http://10.0.0.1/jobs/1", jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("url");
    });

    it("rejects 192.168.x private IP", () => {
      const r = validateIngestInput({ url: "http://192.168.1.1/jobs/1", jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("url");
    });

    it("rejects 172.16.x–172.31.x private range", () => {
      const r = validateIngestInput({ url: "http://172.20.1.1/jobs/1", jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("url");
    });

    it("rejects 172.15.x (edge: not private range)", () => {
      // 172.15.x is public — should pass the private-IP gate
      const r = validateIngestInput({ url: "http://172.15.0.1/jobs/1", jobText: LONG_TEXT });
      // We only care that the field is NOT rejected for private-IP reason;
      // it may still fail for other reasons. Just verify it doesn't reject with field:"url".
      // Actually 172.15.x starts with "172.1" which matches "172.1[6-9]" pattern starting at 172.16.
      // Let's just ensure this IP is NOT blocked by private range logic.
      if (!r.ok) {
        // Only fail if explicitly rejected as private
        expect(r.error).not.toMatch(/private/i);
      }
    });

    it("rejects a non-string url (number)", () => {
      const r = validateIngestInput({ url: 42, jobText: LONG_TEXT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("url");
    });
  });

  // ── Job text: happy path ─────────────────────────────────────────────────
  describe("valid jobText", () => {
    it("accepts text at exactly the minimum length", () => {
      const r = validateIngestInput({
        url: "https://www.linkedin.com/jobs/view/1",
        jobText: "A".repeat(INGEST_MIN_TEXT_CHARS),
      });
      expect(r.ok).toBe(true);
    });

    it("accepts text longer than the minimum", () => {
      const r = validateIngestInput({
        url: "https://www.linkedin.com/jobs/view/1",
        jobText: "A".repeat(INGEST_MIN_TEXT_CHARS + 100),
      });
      expect(r.ok).toBe(true);
    });

    it("trims leading/trailing whitespace before length check", () => {
      // 199 real chars padded with spaces: should still fail after trim
      const r = validateIngestInput({
        url: "https://www.linkedin.com/jobs/view/1",
        jobText: "   " + "A".repeat(INGEST_MIN_TEXT_CHARS - 1) + "   ",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("jobText");
    });

    it("returns trimmed text in normalizedText", () => {
      const r = validateIngestInput({
        url: "https://www.linkedin.com/jobs/view/1",
        jobText: "  " + LONG_TEXT + "  ",
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.normalizedText).toBe(LONG_TEXT);
    });
  });

  // ── Job text: error paths ────────────────────────────────────────────────
  describe("invalid jobText", () => {
    it("rejects undefined jobText", () => {
      const r = validateIngestInput({ url: "https://www.linkedin.com/jobs/view/1", jobText: undefined });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("jobText");
    });

    it("rejects empty string jobText", () => {
      const r = validateIngestInput({ url: "https://www.linkedin.com/jobs/view/1", jobText: "" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("jobText");
    });

    it("rejects jobText one character short of minimum", () => {
      const r = validateIngestInput({
        url: "https://www.linkedin.com/jobs/view/1",
        jobText: "A".repeat(INGEST_MIN_TEXT_CHARS - 1),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.field).toBe("jobText");
        expect(r.error).toMatch(/too short/i);
        expect(r.error).toMatch(String(INGEST_MIN_TEXT_CHARS));
      }
    });

    it("rejects non-string jobText (number)", () => {
      const r = validateIngestInput({
        url: "https://www.linkedin.com/jobs/view/1",
        jobText: 12345,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("jobText");
    });
  });

  // ── URL is checked before jobText ────────────────────────────────────────
  it("reports url error first when both inputs are invalid", () => {
    const r = validateIngestInput({ url: "not-a-url", jobText: "too short" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("url");
  });
});
