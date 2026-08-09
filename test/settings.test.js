const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_SETTINGS, canEndBreak, sanitizeSettings } = require("../src/settings");

test("sanitizes numeric ranges", () => {
  const result = sanitizeSettings({ focusMinutes: 999, breakMinutes: -3 });
  assert.equal(result.focusMinutes, 180);
  assert.equal(result.breakMinutes, 1);
});

test("falls back for invalid values", () => {
  const result = sanitizeSettings({ focusMinutes: "nope", language: "fr" });
  assert.equal(result.focusMinutes, DEFAULT_SETTINGS.focusMinutes);
  assert.equal(result.language, "system");
});

test("keeps supported options", () => {
  const result = sanitizeSettings({ focusMinutes: 25, breakMinutes: 5, closeMode: "immediate", language: "en", launchAtLogin: true });
  assert.equal(result.focusMinutes, 25);
  assert.equal(result.breakMinutes, 5);
  assert.equal(result.closeMode, "immediate");
  assert.equal(result.language, "en");
  assert.equal(result.launchAtLogin, true);
});

test("falls back to the protected close mode", () => {
  assert.equal(sanitizeSettings({ closeMode: "later" }).closeMode, "after30");
});

test("applies both reminder close modes", () => {
  assert.equal(canEndBreak("immediate", 0), true);
  assert.equal(canEndBreak("after30", 29_999), false);
  assert.equal(canEndBreak("after30", 30_000), true);
});
