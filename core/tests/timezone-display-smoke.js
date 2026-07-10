const path = require("path");

process.env.TZ = "Asia/Shanghai";
global.window = {};

require(path.resolve(__dirname, "..", "..", "app", "utils.js"));

const { formatLocalDateTime, getSystemTimeZone } = global.window.ClaraCoreUtils;

if (getSystemTimeZone() !== "Asia/Shanghai") {
  throw new Error(`Expected Asia/Shanghai, received ${getSystemTimeZone()}`);
}

const sqliteUtc = formatLocalDateTime("2026-07-10 06:35:10");
const explicitUtc = formatLocalDateTime("2026-07-10T06:35:10Z");
if (!sqliteUtc.includes("14:35:10") || !explicitUtc.includes("14:35:10")) {
  throw new Error(`UTC timestamps were not displayed in system time: ${JSON.stringify({ sqliteUtc, explicitUtc })}`);
}

const offsetTime = formatLocalDateTime("2026-07-10T14:35:10+08:00");
if (!offsetTime.includes("14:35:10")) {
  throw new Error(`Offset-aware timestamp changed unexpectedly: ${offsetTime}`);
}

console.log(JSON.stringify({ ok: true, timeZone: getSystemTimeZone(), sqliteUtc, explicitUtc, offsetTime }, null, 2));
