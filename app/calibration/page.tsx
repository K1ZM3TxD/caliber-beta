  // PATTERN_SYNTHESIS (freeze-gated screen)
  if (state === 'PATTERN_SYNTHESIS') {
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>

        <div className="mt-10 mx-auto w-full max-w-[680px] text-center">
          <div className="text-[24px] font-semibold leading-tight">Calibration Core Mode</div>
          <div className="mt-6 text-[16px] leading-relaxed opacity-90">
            Pattern Summary is temporarily frozen while anchor extraction + overlap + gap surfaces are validated.
          </div>

          <div className="mt-10 flex items-center justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B]"
            >
              Restart
            </button>
          </div>
        </div>
      </Stage>
    );
  }