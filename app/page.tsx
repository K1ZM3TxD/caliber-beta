'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function IntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resume, setResume] = useState('');
  const [promptAnswers, setPromptAnswers] = useState(['', '', '', '', '']);
  const [jobDescription, setJobDescription] = useState('');

  const prompts = [
    'Describe a project where you had the most impact. What made it significant?',
    'Tell me about a time when you had to navigate organizational complexity.',
    'What type of work energizes you the most?',
    'Describe a situation where you felt misaligned with your role.',
    'What does "operating at your best" look like for you?',
  ];

  const handlePromptAnswerChange = (index: number, value: string) => {
    const newAnswers = [...promptAnswers];
    newAnswers[index] = value;
    setPromptAnswers(newAnswers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/calibrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume,
          promptAnswers,
          jobDescription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calibrate');
      }

      const result = await response.json();

      // Navigate to results page with data
      router.push(
        `/results?data=${encodeURIComponent(JSON.stringify(result))}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            Caliber Beta
          </h1>
          <p className="text-zinc-600 mb-8">
            Role calibration tool - analyze alignment between your background and a role
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Resume Input */}
            <div>
              <label
                htmlFor="resume"
                className="block text-sm font-medium text-zinc-900 mb-2"
              >
                Resume / Professional Background
              </label>
              <textarea
                id="resume"
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                required
                rows={8}
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Paste your resume or describe your professional background..."
              />
            </div>

            {/* Prompt Answers */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900">
                Context Questions
              </h2>
              {prompts.map((prompt, index) => (
                <div key={index}>
                  <label
                    htmlFor={`prompt-${index}`}
                    className="block text-sm font-medium text-zinc-900 mb-2"
                  >
                    {index + 1}. {prompt}
                  </label>
                  <textarea
                    id={`prompt-${index}`}
                    value={promptAnswers[index]}
                    onChange={(e) =>
                      handlePromptAnswerChange(index, e.target.value)
                    }
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your answer..."
                  />
                </div>
              ))}
            </div>

            {/* Job Description Input */}
            <div>
              <label
                htmlFor="jobDescription"
                className="block text-sm font-medium text-zinc-900 mb-2"
              >
                Job Description
              </label>
              <textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                required
                rows={8}
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Paste the job description you want to analyze..."
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Calibrating...' : 'Calibrate'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
