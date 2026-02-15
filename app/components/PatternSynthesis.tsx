/**
 * Pattern Synthesis Component - Milestone 2.3
 * Renders pattern synthesis output with minimal styling
 */

import React from "react";

export interface PatternSynthesisProps {
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
      <div>
        <h2 className="mb-2 text-xl font-semibold">Pattern Synthesis</h2>
        <p className="text-gray-700">{structural_summary}</p>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Where You Operate Best</h3>
        <ul className="space-y-2">
          {operate_best.map((item, index) => (
            <li key={index} className="flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Where You Lose Energy</h3>
        <ul className="space-y-2">
          {lose_energy.map((item, index) => (
            <li key={index} className="flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
