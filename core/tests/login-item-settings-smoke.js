const {
  getLoginItemPreference,
  loginItemIsSupported,
  setLoginItemPreference,
  shouldStartHiddenAtLogin
} = require("../../electron/login-item-settings");

function createApp({ packaged = true, openAtLogin = false, wasOpenedAtLogin = false } = {}) {
  let currentOpenAtLogin = openAtLogin;
  const writes = [];
  return {
    isPackaged: packaged,
    getLoginItemSettings() {
      return { openAtLogin: currentOpenAtLogin, wasOpenedAtLogin };
    },
    setLoginItemSettings(settings) {
      writes.push(settings);
      currentOpenAtLogin = Boolean(settings.openAtLogin);
    },
    writes
  };
}

const macApp = createApp();
if (!loginItemIsSupported(macApp, "darwin")) throw new Error("Packaged macOS app should support login items.");
if (getLoginItemPreference(macApp, "darwin").launchAtLogin) throw new Error("Login item should start disabled.");

const enabled = setLoginItemPreference(macApp, true, "darwin");
if (!enabled.launchAtLogin || macApp.writes.length !== 1 || macApp.writes[0].openAtLogin !== true) {
  throw new Error(`Enabling the login item failed: ${JSON.stringify({ enabled, writes: macApp.writes })}`);
}

const disabled = setLoginItemPreference(macApp, false, "darwin");
if (disabled.launchAtLogin || macApp.writes.length !== 2 || macApp.writes[1].openAtLogin !== false) {
  throw new Error(`Disabling the login item failed: ${JSON.stringify({ disabled, writes: macApp.writes })}`);
}

const developmentApp = createApp({ packaged: false });
const unavailable = setLoginItemPreference(developmentApp, true, "darwin");
if (unavailable.launchAtLoginAvailable || developmentApp.writes.length !== 0) {
  throw new Error(`Development mode must not change system login items: ${JSON.stringify({ unavailable, writes: developmentApp.writes })}`);
}

const linuxApp = createApp();
if (loginItemIsSupported(linuxApp, "linux")) throw new Error("Linux login items should be reported as unavailable.");

const loginLaunchApp = createApp({ openAtLogin: true, wasOpenedAtLogin: true });
if (!shouldStartHiddenAtLogin(loginLaunchApp, "darwin")) {
  throw new Error("An installed app opened by the macOS login item should start hidden.");
}
if (!shouldStartHiddenAtLogin(loginLaunchApp, "win32")) {
  throw new Error("An installed app opened by the Windows login item should start hidden.");
}
if (shouldStartHiddenAtLogin(loginLaunchApp, "darwin", { isTestInstance: true })) {
  throw new Error("Test instances must remain visible even if a login-item stub reports an automatic launch.");
}
if (shouldStartHiddenAtLogin(createApp({ packaged: false, wasOpenedAtLogin: true }), "darwin")) {
  throw new Error("Development mode must not infer a hidden login launch.");
}

console.log("Login item settings smoke: ok");
