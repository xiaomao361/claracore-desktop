const fs = require("fs");
const path = require("path");
const { CHANNEL_NAMES } = require("../../electron/ipc-contracts");

const appRoot = path.resolve(__dirname, "..", "..");
const files = ["electron/preload.js", "electron/ipc-handlers.js", "electron/main.js"];
const used = new Set();

for (const file of files) {
  const source = fs.readFileSync(path.join(appRoot, file), "utf8");
  if (source.includes('"claracore:')) throw new Error(`${file} contains a raw ClaraCore IPC channel.`);
  for (const match of source.matchAll(/ipcChannel\("([A-Za-z]+)"\)/g)) used.add(match[1]);
}

const declared = new Set(CHANNEL_NAMES);
const undeclared = [...used].filter((name) => !declared.has(name));
const unused = [...declared].filter((name) => !used.has(name));
if (undeclared.length || unused.length) {
  throw new Error(`IPC contract mismatch: ${JSON.stringify({ undeclared, unused })}`);
}

console.log(`IPC contract lint: ok (${declared.size} channels)`);
