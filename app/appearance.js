function createClaraCoreAppearance({ desktop, onSystemPreferenceChange, preferences = {} }) {
  let currentTheme = ["system", "light", "dark"].includes(preferences.theme) ? preferences.theme : "system";
  let currentCloseBehavior = preferences.closeBehavior === "quit" ? "quit" : "hide";

  function resolvedTheme() {
    if (currentTheme === "light" || currentTheme === "dark") return currentTheme;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function resolvedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "off" : "on";
  }

  function getPreferences() {
    return {
      theme: currentTheme,
      resolvedTheme: resolvedTheme(),
      closeBehavior: currentCloseBehavior
    };
  }

  function applyTheme() {
    document.body.dataset.theme = resolvedTheme();
    document.body.dataset.themePreference = currentTheme;
    document.body.dataset.motion = resolvedMotion();
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
      applyTheme();
      onSystemPreferenceChange?.();
    });
  }

  function initialize() {
    applyPreferences({ theme: currentTheme, closeBehavior: currentCloseBehavior });
    bindSystemPreferenceListeners();
  }

  return {
    applyPreferences,
    applyTheme,
    getPreferences,
    initialize,
    setTheme,
    setWindowCloseBehavior
  };
}

window.createClaraCoreAppearance = createClaraCoreAppearance;
