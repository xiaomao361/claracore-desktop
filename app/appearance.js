function createClaraCoreAppearance({ desktop, onSystemPreferenceChange }) {
  let currentTheme = localStorage.getItem("claracore.theme") || "system";
  let currentMotion = localStorage.getItem("claracore.motion") || "system";
  let currentCloseBehavior = localStorage.getItem("claracore.window.closeBehavior") || "hide";

  function resolvedTheme() {
    if (currentTheme === "light" || currentTheme === "dark") return currentTheme;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function resolvedMotion() {
    if (currentMotion === "on" || currentMotion === "off") return currentMotion;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "off" : "on";
  }

  function getPreferences() {
    return {
      theme: currentTheme,
      resolvedTheme: resolvedTheme(),
      motion: currentMotion,
      resolvedMotion: resolvedMotion(),
      closeBehavior: currentCloseBehavior
    };
  }

  function applyTheme() {
    document.body.dataset.theme = resolvedTheme();
    document.body.dataset.themePreference = currentTheme;
    document.body.dataset.motion = resolvedMotion();
    document.body.dataset.motionPreference = currentMotion;
  }

  function setTheme(theme) {
    currentTheme = ["system", "light", "dark"].includes(theme) ? theme : "system";
    localStorage.setItem("claracore.theme", currentTheme);
    applyTheme();
  }

  function setMotion(motion) {
    currentMotion = ["system", "on", "off"].includes(motion) ? motion : "system";
    localStorage.setItem("claracore.motion", currentMotion);
    applyTheme();
  }

  function setWindowCloseBehavior(closeBehavior) {
    currentCloseBehavior = closeBehavior === "quit" ? "quit" : "hide";
    localStorage.setItem("claracore.window.closeBehavior", currentCloseBehavior);
    const result = desktop?.setWindowPreferences?.({ closeBehavior: currentCloseBehavior });
    if (result?.catch) result.catch(console.error);
  }

  function bindSystemPreferenceListeners() {
    window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener("change", () => {
      if (currentTheme === "system") {
        applyTheme();
        onSystemPreferenceChange?.();
      }
    });
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener("change", () => {
      if (currentMotion === "system") {
        applyTheme();
        onSystemPreferenceChange?.();
      }
    });
  }

  function initialize() {
    applyTheme();
    setWindowCloseBehavior(currentCloseBehavior);
    bindSystemPreferenceListeners();
  }

  return {
    applyTheme,
    getPreferences,
    initialize,
    setMotion,
    setTheme,
    setWindowCloseBehavior
  };
}

window.createClaraCoreAppearance = createClaraCoreAppearance;
