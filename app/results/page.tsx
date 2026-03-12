import HeroSurface from "../components/HeroSurface";

export default function ResultsPage() {
  return (
    <main className="fixed inset-0 w-screen h-[100svh] text-[#F2F2F2] flex items-center justify-center">
      <HeroSurface variant="elevated">
        <div className="w-full max-w-[720px] px-6 text-center">
          <h1 className="text-4xl font-semibold">Results</h1>
        </div>
      </HeroSurface>
    </main>
  );
}
