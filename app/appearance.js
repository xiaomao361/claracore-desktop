function createClaraCoreAppearance({ desktop, onSystemPreferenceChange, preferences = {} }) {
  let currentTheme = ["system", "light", "dark"].includes(preferences.theme) ? preferences.theme : "system";
  let currentMotion = ["system", "on", "off"].includes(preferences.motion) ? preferences.motion : "system";
  let currentCloseBehavior = preferences.closeBehavior === "quit" ? "quit" : "hide";

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

  function persist(updates) {
    const result = desktop?.saveUiPreferences?.(updates);
    if (result?.catch) result.catch(console.error);
  }

  function setTheme(theme) {
    currentTheme = ["system", "light", "dark"].includes(theme) ? theme : "system";
    applyTheme();
    persist({ theme: currentTheme });
  }

  function setMotion(motion) {
    currentMotion = ["system", "on", "off"].includes(motion) ? motion : "system";
    applyTheme();
    persist({ motion: currentMotion });
  }

  function setWindowCloseBehavior(closeBehavior, options = {}) {
    currentCloseBehavior = closeBehavior === "quit" ? "quit" : "hide";
    const result = desktop?.setWindowPreferences?.({ closeBehavior: currentCloseBehavior });
    if (result?.catch) result.catch(console.error);
    if (options.persist !== false) persist({ closeBehavior: currentCloseBehavior });
  }

  function applyPreferences(nextPreferences = {}) {
    if (["system", "light", "dark"].includes(nextPreferences.theme)) {
      currentTheme = nextPreferences.theme;
    }
    if (["system", "on", "off"].includes(nextPreferences.motion)) {
      currentMotion = nextPreferences.motion;
    }
    if (nextPreferences.closeBehavior === "quit" || nextPreferences.closeBehavior === "hide") {
      currentCloseBehavior = nextPreferences.closeBehavior;
    }
    applyTheme();
    setWindowCloseBehavior(currentCloseBehavior, { persist: false });
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
    applyPreferences({ theme: currentTheme, motion: currentMotion, closeBehavior: currentCloseBehavior });
    bindSystemPreferenceListeners();
  }

  return {
    applyPreferences,
    applyTheme,
    getPreferences,
    initialize,
    setMotion,
    setTheme,
    setWindowCloseBehavior
  };
}

window.createClaraCoreAppearance = createClaraCoreAppearance;
