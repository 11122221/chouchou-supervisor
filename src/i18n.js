const TEXT = {
  "zh-CN": {
    appName: "臭臭监督官",
    settings: "设置",
    immediateBreak: "立即休息",
    pause30: "暂停 30 分钟",
    pause60: "暂停 1 小时",
    pauseTomorrow: "暂停到明天",
    resume: "立即恢复",
    quit: "退出",
    breakSoonTitle: "臭臭监督官提醒",
    breakSoonBody: "还有 1 分钟就要休息啦。",
    updateTitle: "发现新版本",
    updateBody: "臭臭监督官有新版本可下载。"
  },
  en: {
    appName: "Chouchou Supervisor",
    settings: "Settings",
    immediateBreak: "Take a break now",
    pause30: "Pause for 30 minutes",
    pause60: "Pause for 1 hour",
    pauseTomorrow: "Pause until tomorrow",
    resume: "Resume now",
    quit: "Quit",
    breakSoonTitle: "Chouchou Supervisor",
    breakSoonBody: "Your break starts in one minute.",
    updateTitle: "Update available",
    updateBody: "A new version of Chouchou Supervisor is ready to download."
  }
};

function resolvedLanguage(setting, systemLocale = "zh-CN") {
  if (setting === "zh-CN" || setting === "en") return setting;
  return systemLocale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function translate(language, key) {
  return TEXT[language]?.[key] || TEXT["zh-CN"][key] || key;
}

module.exports = { TEXT, resolvedLanguage, translate };
