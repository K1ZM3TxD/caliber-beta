'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useMemo, useState, Suspense } from 'react';
import { CalibrationResult } from '@/lib/types';

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showDebug, setShowDebug] = useState(false);

  const result = useMemo<CalibrationResult | null>(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        return JSON.parse(decodeURIComponent(data));
      } catch (error) {
        console.error('Failed to parse result data:', error);
        return null;
      }
    }
    return null;
  }, [searchParams]);

  if (!result) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">
            Loading results...
          </h2>
          <p className="text-zinc-600">
            If this persists, please return to the intake form.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Return to Intake
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">
                Calibration Results
              </h1>
              <p className="text-zinc-600">
                Your role alignment analysis
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              New Analysis
            </button>
          </div>
        </div>

        {/* Alignment Score - Prominent */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">
              Alignment Score
            </h2>
            <div className="text-6xl font-bold text-blue-600 mb-2">
              {result.alignment.score.toFixed(1)}
            </div>
            <div className="text-sm text-zinc-600">out of 10</div>
            {result.alignment.severeMismatches > 0 && (
              <div className="mt-4 text-sm text-amber-700 bg-amber-50 p-3 rounded-md">
                ⚠️ {result.alignment.severeMismatches} severe{' '}
                {result.alignment.severeMismatches === 1 ? 'mismatch' : 'mismatches'}{' '}
                detected
              </div>
            )}
          </div>
        </div>

        {/* Pattern Synthesis */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6">
            {result.patternSynthesis.titleHypothesis}
          </h2>

          <div className="space-y-6">
            {/* Pattern Summary */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-2">
                Your Pattern
              </h3>
              <p className="text-zinc-900 leading-relaxed">
                {result.patternSynthesis.patternSummary}
              </p>
            </div>

            {/* Where You Operate Best */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-2">
                Where You Operate Best
              </h3>
              <ul className="space-y-2">
                {result.patternSynthesis.operateBest.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-zinc-900">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Where You Lose Energy */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-2">
                Where You Lose Energy
              </h3>
              <ul className="space-y-2">
                {result.patternSynthesis.loseEnergy.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-red-600 mr-2">✗</span>
                    <span className="text-zinc-900">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Structural Tensions */}
            {result.patternSynthesis.structuralTensions && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wide mb-2">
                  Structural Tensions
                </h3>
                <p className="text-amber-900">
                  {result.patternSynthesis.structuralTensions}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Skill Match & Requirements */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
          <h2 className="text-xl font-bold text-zinc-900 mb-4">
            Skill Match: {result.skillMatch.score.toFixed(1)}/10
          </h2>

          <div className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <p className="text-zinc-900">
                <strong>{result.skillMatch.groundedCount}</strong>{' '}
                {result.skillMatch.groundedCount === 1 ? 'requirement matches' : 'requirements match'}{' '}
                prior scope-level execution.
              </p>
              <p className="text-zinc-900">
                <strong>{result.skillMatch.adjacentCount}</strong>{' '}
                {result.skillMatch.adjacentCount === 1 ? 'requires' : 'require'}{' '}
                adjacent capability expansion.
              </p>
              <p className="text-zinc-900">
                <strong>{result.skillMatch.newCount}</strong>{' '}
                {result.skillMatch.newCount === 1 ? 'represents' : 'represent'}{' '}
                new execution territory.
              </p>
            </div>

            {/* Progress bar visualization */}
            <div className="mt-4">
              <div className="flex h-8 rounded-md overflow-hidden">
                {result.skillMatch.total > 0 && (
                  <>
                    {result.skillMatch.groundedCount > 0 && (
                      <div
                        className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{
                          width: `${(result.skillMatch.groundedCount / result.skillMatch.total) * 100}%`,
                        }}
                      >
                        {result.skillMatch.groundedCount > 0 && result.skillMatch.groundedCount}
                      </div>
                    )}
                    {result.skillMatch.adjacentCount > 0 && (
                      <div
                        className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{
                          width: `${(result.skillMatch.adjacentCount / result.skillMatch.total) * 100}%`,
                        }}
                      >
                        {result.skillMatch.adjacentCount > 0 && result.skillMatch.adjacentCount}
                      </div>
                    )}
                    {result.skillMatch.newCount > 0 && (
                      <div
                        className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{
                          width: `${(result.skillMatch.newCount / result.skillMatch.total) * 100}%`,
                        }}
                      >
                        {result.skillMatch.newCount > 0 && result.skillMatch.newCount}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-between text-xs text-zinc-600 mt-2">
                <span>Grounded</span>
                <span>Adjacent</span>
                <span>New</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stretch Load */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
          <h2 className="text-xl font-bold text-zinc-900 mb-4">
            Stretch Load
          </h2>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-bold text-zinc-900">
              {result.stretchLoad.percentage}%
            </div>
            <div className="text-zinc-600">of role requires new capability development</div>
          </div>
        </div>

        {/* Debug Toggle */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {showDebug ? '− Hide' : '+ Show'} Debug Information
          </button>

          {showDebug && (
            <div className="mt-4 space-y-6">
              {/* Person Vector */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-2">
                  Person Vector
                </h3>
                <div className="bg-zinc-50 rounded p-3 text-xs font-mono">
                  <pre>{JSON.stringify(result.personVector, null, 2)}</pre>
                </div>
              </div>

              {/* Role Vector */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-2">
                  Role Vector
                </h3>
                <div className="bg-zinc-50 rounded p-3 text-xs font-mono">
                  <pre>{JSON.stringify(result.roleVector, null, 2)}</pre>
                </div>
              </div>

              {/* Evidence */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-2">
                  Evidence
                </h3>
                <div className="bg-zinc-50 rounded p-3 text-xs space-y-2">
                  {Object.entries(result.evidence).map(([key, values]) => (
                    <div key={key}>
                      <strong className="text-zinc-900">{key}:</strong>
                      <ul className="ml-4 mt-1 space-y-1">
                        {values.map((value: string, index: number) => (
                          <li key={index} className="text-zinc-700">• {value}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Classified Requirements */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-2">
                  Classified Requirements
                </h3>
                <div className="space-y-2">
                  {result.classifiedRequirements.map((req, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded text-xs ${
                        req.category === 'grounded' && req.scope_matched_outcome
                          ? 'bg-green-50 border border-green-200'
                          : req.category === 'adjacent' ||
                            (req.category === 'grounded' && !req.scope_matched_outcome)
                          ? 'bg-yellow-50 border border-yellow-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="font-medium text-zinc-900 mb-1">
                        {req.requirement}
                      </div>
                      <div className="text-zinc-600">
                        Category: {req.category} | Scope matched: {req.scope_matched_outcome ? 'Yes' : 'No'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">
            Loading results...
          </h2>
        </div>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
