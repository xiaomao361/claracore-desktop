(() => {
  const button = document.getElementById("language");
  if (!button) return;
  const titles = {
    en: "ClaraCore — Keep the thread. Across conversations.",
    zh: "ClaraCore — 跨越对话，接着往下走。"
  };
  const descriptions = {
    en: "A local memory and continuity workspace for your AI agents. Keep confirmed facts, shared goals, and source material on your device.",
    zh: "供 AI 智能体使用的本地记忆与连续性工作区。把确认过的事实、共同目标和有来源的资料留在自己的电脑上。"
  };
  function setLanguage(language) {
    const lang = language === "zh" ? "zh" : "en";
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    for (const element of document.querySelectorAll("[data-en]")) {
      element.textContent = element.dataset[lang];
    }
    for (const element of document.querySelectorAll("[data-alt-en]")) {
      element.alt = element.dataset[lang === "zh" ? "altZh" : "altEn"];
    }
    for (const element of document.querySelectorAll("[data-label-en]")) {
      element.setAttribute("aria-label", element.dataset[lang === "zh" ? "labelZh" : "labelEn"]);
    }
    document.title = titles[lang];
    document.querySelector('meta[name="description"]').content = descriptions[lang];
    button.textContent = lang === "zh" ? "English" : "中文";
    button.lang = lang === "zh" ? "en" : "zh-CN";
    button.setAttribute("aria-label", lang === "zh" ? "Switch to English" : "切换至中文");
  }
  const initial = new URLSearchParams(window.location.search).get("lang");
  setLanguage(initial === "zh" ? "zh" : "en");
  button.hidden = false;
  button.addEventListener("click", () => {
    setLanguage(document.documentElement.lang === "zh-CN" ? "en" : "zh");
  });
})();
