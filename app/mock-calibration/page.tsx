// app/mock-calibration/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";

type Step = "LANDING" | "RESUME" | "PROMPT1";

export default function MockCalibrationPage() {
  const [step, setStep] = useState<Step>("LANDING");
  const [responseText, setResponseText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasText = useMemo(() => responseText.trim().length > 0, [responseText]);

  const isLanding = step === "LANDING";
  const isResume = step === "RESUME";
  const isPrompt1 = step === "PROMPT1";

  const canContinue = !!selectedFile;

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-[720px] px-6">
        <div className="relative min-h-[560px]">
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              step === "PROMPT1" ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
            style={{ color: "#F2F2F2" }}
            aria-hidden={step === "PROMPT1"}
          >
            <div className="h-full w-full flex flex-col items-center justify-center text-center">
              <div className="flex flex-col items-center">
                <div
                  className={`transition-opacity duration-300 ${
                    isLanding ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                  aria-hidden={!isLanding}
                >
                  <div className="font-semibold tracking-[0.25em] text-xs sm:text-sm">
                    WELCOME TO
                  </div>
                </div>

                <div className="mt-2 font-semibold tracking-tight text-5xl sm:text-6xl">
                  Caliber
                </div>
              </div>

              <div className="mt-8 w-full flex items-center justify-center">
                <div
                  className={`w-full transition-opacity duration-300 ${
                    isLanding ? "opacity-100" : "opacity-0 pointer-events-none absolute"
                  }`}
                  aria-hidden={!isLanding}
                >
                  <div className="mx-auto w-full max-w-[600px]">
                    <p
                      className="text-base sm:text-lg leading-relaxed"
                      style={{ color: "#CFCFCF" }}
                    >
                      The alignment tool for job calibration.
                    </p>

                    <div className="mt-10">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setStep("RESUME");
                        }}
                        className={[
                          "inline-flex items-center justify-center rounded-md",
                          "px-5 py-3 text-sm sm:text-base font-medium",
                          "transition-colors duration-200",
                          "focus:outline-none focus:ring-2 focus:ring-offset-2",
                        ].join(" ")}
                        style={{
                          backgroundColor: "#F2F2F2",
                          color: "#0B0B0B",
                        }}
                      >
                        Begin Calibration
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className={`w-full transition-opacity duration-300 ${
                    isResume ? "opacity-100" : "opacity-0 pointer-events-none absolute"
                  }`}
                  aria-hidden={!isResume}
                >
                  <div className="mx-auto w-full max-w-[600px]">
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight">
                      Upload Resume
                    </div>

                    <div
                      className="mt-3 text-base sm:text-lg leading-relaxed"
                      style={{ color: "#CFCFCF" }}
                    >
                      Your experience holds the pattern.
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={onFileChange}
                    />

                    <div className="mt-8 flex justify-center">
                      <div className="w-full" style={{ maxWidth: 520 }}>
                        <div
                          className="rounded-md"
                          style={{
                            border: "1px dashed rgba(242,242,242,0.28)",
                            backgroundColor: selectedFile ? "#121212" : "#0F0F0F",
                            height: 140,
                          }}
                        >
                          <div className="h-full w-full flex flex-col items-center justify-center px-6 text-center">
                            {!selectedFile ? (
                              <>
                                <div className="text-sm sm:text-base" style={{ color: "#F2F2F2" }}>
                                  Drag & drop your resume here
                                </div>
                                <div className="mt-2 text-sm" style={{ color: "#CFCFCF" }}>
                                  or
                                </div>
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={openFilePicker}
                                    className={[
                                      "inline-flex items-center justify-center rounded-md",
                                      "px-4 py-2 text-sm font-medium",
                                      "transition-colors duration-200",
                                      "focus:outline-none focus:ring-2 focus:ring-offset-2",
                                    ].join(" ")}
                                    style={{
                                      backgroundColor: "rgba(242,242,242,0.14)",
                                      color: "#F2F2F2",
                                      border: "1px solid rgba(242,242,242,0.18)",
                                    }}
                                  >
                                    Choose file
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-sm sm:text-base font-medium">
                                  {selectedFile.name}
                                </div>
                                <div className="mt-2 text-sm" style={{ color: "#CFCFCF" }}>
                                  File selected
                                </div>
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={openFilePicker}
                                    className={[
                                      "inline-flex items-center justify-center rounded-md",
                                      "px-4 py-2 text-sm font-medium",
                                      "transition-colors duration-200",
                                      "focus:outline-none focus:ring-2 focus:ring-offset-2",
                                    ].join(" ")}
                                    style={{
                                      backgroundColor: "rgba(242,242,242,0.10)",
                                      color: "#F2F2F2",
                                      border: "1px solid rgba(242,242,242,0.16)",
                                    }}
                                  >
                                    Choose different file
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 text-xs" style={{ color: "#CFCFCF" }}>
                          PDF or DOCX
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      <button
                        type="button"
                        onClick={() => {
                          if (!canContinue) return;
                          setStep("PROMPT1");
                        }}
                        className={[
                          "inline-flex items-center justify-center rounded-md",
                          "px-5 py-3 text-sm sm:text-base font-medium",
                          "transition-all ease-in-out",
                          "focus:outline-none focus:ring-2 focus:ring-offset-2",
                        ].join(" ")}
                        style={{
                          transitionDuration: "200ms",
                          backgroundColor: canContinue ? "#F2F2F2" : "rgba(242,242,242,0.35)",
                          color: "#0B0B0B",
                          cursor: canContinue ? "pointer" : "not-allowed",
                          boxShadow: canContinue ? "0 8px 20px rgba(0,0,0,0.25)" : "none",
                          transform: canContinue ? "translateY(-1px)" : "translateY(0px)",
                          filter: canContinue ? "brightness(1)" : "brightness(0.98)",
                        }}
                        aria-disabled={!canContinue}
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-4" />
            </div>
          </div>

          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              isPrompt1 ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{ color: "#F2F2F2" }}
            aria-hidden={!isPrompt1}
          >
            <div className="h-full w-full flex flex-col items-center justify-center text-center">
              <div className="flex flex-col items-center">
                <div className="font-semibold tracking-tight text-[30px] sm:text-[32px]">
                  Caliber
                </div>
              </div>

              <div className="mt-8 w-full max-w-2xl">
                <div className="text-xs sm:text-sm font-medium" style={{ color: "#CFCFCF" }}>
                  Question 1 of 5
                </div>

                <div className="mt-3 text-2xl sm:text-3xl font-semibold leading-snug tracking-tight">
                  {CALIBRATION_PROMPTS[1]}
                </div>

                <div className="mt-7">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={7}
                    className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200"
                    style={{
                      backgroundColor: "#141414",
                      color: "#F2F2F2",
                      border: "1px solid rgba(242,242,242,0.14)",
                      boxShadow: "none",
                    }}
                    placeholder="Type your response here…"
                  />
                </div>

                <div className="mt-7">
                  <button
                    type="button"
                    className={[
                      "inline-flex items-center justify-center rounded-md",
                      "px-5 py-3 text-sm sm:text-base font-medium",
                      "transition-all ease-in-out",
                      "focus:outline-none focus:ring-2 focus:ring-offset-2",
                    ].join(" ")}
                    style={{
                      transitionDuration: "200ms",
                      backgroundColor: hasText ? "#F2F2F2" : "rgba(242,242,242,0.70)",
                      color: "#0B0B0B",
                      boxShadow: hasText ? "0 8px 20px rgba(0,0,0,0.35)" : "0 0 0 rgba(0,0,0,0)",
                      transform: hasText ? "translateY(-1px)" : "translateY(0px)",
                      filter: hasText ? "brightness(1)" : "brightness(0.98)",
                    }}
                  >
                    Submit
                  </button>
                </div>

                <div className="mt-3 text-xs" style={{ color: "rgba(207,207,207,0.0)" }}>
                  .
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}