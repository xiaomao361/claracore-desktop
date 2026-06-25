const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ClaraCoreDesktop", {
  getRuntimeSnapshot() {
    return ipcRenderer.invoke("claracore:getRuntimeSnapshot");
  },
  getResourceSnapshot() {
    return ipcRenderer.invoke("claracore:getResourceSnapshot");
  },
  openPath(targetPath) {
    return ipcRenderer.invoke("claracore:openPath", targetPath);
  },
  openExternal(targetUrl) {
    return ipcRenderer.invoke("claracore:openExternal", targetUrl);
  },
  copyText(value) {
    return ipcRenderer.invoke("claracore:copyText", value);
  },
  setLanguage(language) {
    return ipcRenderer.invoke("claracore:setLanguage", language);
  }
});
