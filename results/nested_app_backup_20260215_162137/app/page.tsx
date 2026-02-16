export default function IntakePage() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-3xl font-semibold">Caliber — Intake</h1>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block font-medium">Resume</span>
            <textarea className="min-h-[150px] w-full border p-3" />
          </label>

          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="block">
              <span className="mb-2 block font-medium">Prompt Answer {n}</span>
              <textarea className="min-h-[100px] w-full border p-3" />
            </label>
          ))}

          <label className="block">
            <span className="mb-2 block font-medium">Job Description</span>
            <textarea className="min-h-[150px] w-full border p-3" />
          </label>

          <button className="bg-black px-6 py-3 text-white" type="button">
            Calibrate
          </button>
        </div>
      </div>
    </main>
  );
}