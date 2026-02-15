import React from "react";

interface PatternSynthesisProps {
  structural_summary: string;
  operate_best: string[];
  lose_energy: string[];
}

export default function PatternSynthesis({
  structural_summary,
  operate_best,
  lose_energy,
}: PatternSynthesisProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold mb-3">Pattern Synthesis</h2>
        <p className="text-gray-700">{structural_summary}</p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-3">Where You Operate Best</h3>
        <ul className="space-y-2">
          {operate_best.map((item) => (
            <li key={item} className="flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-3">Where You Lose Energy</h3>
        <ul className="space-y-2">
          {lose_energy.map((item) => (
            <li key={item} className="flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
