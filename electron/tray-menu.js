const labels = {
  zh: {
    status: "运行中", show: "显示 ClaraCore", hide: "隐藏 ClaraCore", pages: "前往",
    home: "共同理解", memory: "记忆", knowledge: "知识库", "shared-line": "共同线", innerlife: "内在活动", logs: "日志",
    "agent-setup": "连接智能体", settings: "设置…", data: "打开数据文件夹", library: "打开知识库文件夹",
    quit: "退出 ClaraCore", tooltip: "ClaraCore 桌面", error: "操作未完成"
  },
  en: {
    status: "Running", show: "Show ClaraCore", hide: "Hide ClaraCore", pages: "Go to",
    home: "Shared understanding", memory: "Memory", knowledge: "Knowledge library", "shared-line": "Shared lines", innerlife: "Inner activity", logs: "Logs",
    "agent-setup": "Connect agents", settings: "Settings…", data: "Open data folder", library: "Open knowledge folder",
    quit: "Quit ClaraCore", tooltip: "ClaraCore Desktop", error: "Action failed"
  }
};
const VIEWS = new Set(["home", "memory", "knowledge", "shared-line", "innerlife", "logs", "agent-setup", "settings"]);

// Hold only the latest requested destination until the renderer has subscribed.
function createTrayNavigation({ show, send }) {
  let ready = false, pending = null;
  function deliver() {
    if (ready && pending) { const view = pending; pending = null; send(view); }
  }
  return {
    async open(view) {
      if (!VIEWS.has(view)) return;
      pending = view;
      await show();
      deliver();
    },
    loading() { ready = false; },
    ready() { ready = true; deliver(); }
  };
}
function buildTrayTemplate({ language, version, show, hide, navigate, openData, openKnowledge, quit, onError }) {
  const text = Object.prototype.hasOwnProperty.call(labels, language) ? labels[language] : labels.en;
  const action = callback => () => Promise.resolve().then(callback).catch(error => onError(text.error, error));
  const page = view => ({ label: text[view], click: action(() => navigate(view)) });
  return [
    { label: `ClaraCore ${version} · ${text.status}`, enabled: false },
    { type: "separator" },
    { label: text.show, click: action(show) },
    { label: text.hide, click: action(hide) },
    { type: "separator" },
    { label: text.pages, submenu: ["home", "memory", "knowledge", "shared-line", "innerlife", "logs"].map(page) },
    page("agent-setup"), page("settings"),
    { type: "separator" },
    { label: text.library, click: action(openKnowledge) },
    { label: text.data, click: action(openData) },
    { type: "separator" },
    { label: text.quit, click: action(quit) }
  ];
}
module.exports = { labels, createTrayNavigation, buildTrayTemplate };
