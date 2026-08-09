const COPY = {
  "zh-CN": {
    eyebrow: "臭臭监督官上线", headline: "休息一下吧", hint: "看看远处，放松眼睛和肩膀",
    locked: "30 秒后可以结束休息", end: "结束休息"
  },
  en: {
    eyebrow: "CHOUCHOU IS ON DUTY", headline: "Time for a break", hint: "Look into the distance and relax your eyes and shoulders",
    locked: "You can finish after 30 seconds", end: "Finish break"
  }
};

let currentState;
const endButton = document.querySelector("#end-break");
function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function render(state) {
  currentState = state;
  const text = COPY[state.language] || COPY["zh-CN"];
  document.documentElement.lang = state.language;
  document.querySelector("#eyebrow").textContent = text.eyebrow;
  document.querySelector("#headline").textContent = text.headline;
  document.querySelector("#hint").textContent = text.hint;
  document.querySelector("#countdown").textContent = formatTime(state.remainingSeconds);
  endButton.disabled = !state.canEnd;
  endButton.textContent = state.canEnd ? text.end : text.locked;
}
endButton.addEventListener("click", async () => {
  if (currentState?.canEnd) await window.chouchou.endBreak();
});
window.chouchou.onBreakState(render);
