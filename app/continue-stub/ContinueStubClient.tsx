"use client";

export default function ContinueStubClient() {
  return (
    <main style={{ padding: 32, textAlign: "center" }}>
      <h1>Continue (stub)</h1>
      <p>This is a placeholder for the next phase (LLM dialogue).</p>
      <button style={{ marginTop: 24 }} onClick={() => window.location.href = "/"}>Back to start</button>
    </main>
  );
}
