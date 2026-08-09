const DEFAULT_SETTINGS = Object.freeze({
  focusMinutes: 45,
  breakMinutes: 5,
  closeMode: "after30",
  language: "system",
  launchAtLogin: false,
  updateChecks: true,
  updateRepository: "11122221/chouchou-supervisor"
});

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function sanitizeSettings(input = {}) {
  return {
    focusMinutes: clampNumber(input.focusMinutes, 1, 180, DEFAULT_SETTINGS.focusMinutes),
    breakMinutes: clampNumber(input.breakMinutes, 1, 30, DEFAULT_SETTINGS.breakMinutes),
    closeMode: ["immediate", "after30"].includes(input.closeMode)
      ? input.closeMode
      : DEFAULT_SETTINGS.closeMode,
    language: ["system", "zh-CN", "en"].includes(input.language)
      ? input.language
      : DEFAULT_SETTINGS.language,
    launchAtLogin: Boolean(input.launchAtLogin),
    updateChecks: input.updateChecks !== false,
    updateRepository:
      typeof input.updateRepository === "string" && input.updateRepository.trim()
        ? input.updateRepository.trim()
        : DEFAULT_SETTINGS.updateRepository
  };
}

function canEndBreak(closeMode, elapsedMs) {
  return closeMode === "immediate" || elapsedMs >= 30_000;
}

module.exports = { DEFAULT_SETTINGS, canEndBreak, sanitizeSettings };
