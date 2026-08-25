function loginItemIsSupported(app, platform = process.platform) {
  return Boolean(
    app?.isPackaged &&
    (platform === "darwin" || platform === "win32") &&
    typeof app.getLoginItemSettings === "function" &&
    typeof app.setLoginItemSettings === "function"
  );
}

function getLoginItemPreference(app, platform = process.platform) {
  const available = loginItemIsSupported(app, platform);
  if (!available) return { launchAtLogin: false, launchAtLoginAvailable: false };

  const settings = app.getLoginItemSettings();
  return {
    launchAtLogin: Boolean(settings?.openAtLogin),
    launchAtLoginAvailable: true
  };
}

function setLoginItemPreference(app, enabled, platform = process.platform) {
  if (!loginItemIsSupported(app, platform)) {
    return getLoginItemPreference(app, platform);
  }

  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  return getLoginItemPreference(app, platform);
}

function shouldStartHiddenAtLogin(app, platform = process.platform, options = {}) {
  if (options.isTestInstance || !loginItemIsSupported(app, platform)) return false;
  return Boolean(app.getLoginItemSettings()?.wasOpenedAtLogin);
}

module.exports = {
  getLoginItemPreference,
  loginItemIsSupported,
  setLoginItemPreference,
  shouldStartHiddenAtLogin
};
