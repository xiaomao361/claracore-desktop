const RESOURCE_WARN_MEMORY_PERCENT = 85;
const RESOURCE_WARN_DISK_PERCENT = 90;

function systemMemorySnapshot(input = {}) {
  const multiplier = input.unit === "kilobytes" ? 1024 : 1;
  const total = Math.max(0, Number(input.total || 0) * multiplier);
  const rawFree = Math.max(0, Number(input.free || 0) * multiplier);
  const reclaimable = input.platform === "darwin"
    ? Math.max(0, Number(input.fileBacked || 0) * multiplier)
      + Math.max(0, Number(input.purgeable || 0) * multiplier)
    : 0;
  const available = Math.min(total, rawFree + reclaimable);
  const used = Math.max(0, total - available);
  return {
    total,
    free: available,
    rawFree,
    reclaimable,
    used,
    percent: total > 0 ? Math.round((used / total) * 100) : null,
    source: input.source || "os"
  };
}

function isResourceWarning({ diskPercent, memoryPercent }) {
  return (
    (Number.isFinite(memoryPercent) && memoryPercent >= RESOURCE_WARN_MEMORY_PERCENT) ||
    (Number.isFinite(diskPercent) && diskPercent >= RESOURCE_WARN_DISK_PERCENT)
  );
}

function shouldCollectGatewayProcessSample({ diskPercent, isGatewayMode, memoryPercent }) {
  if (isGatewayMode) return true;
  return isResourceWarning({ diskPercent, memoryPercent });
}

function deferredGatewayProcessSample() {
  return {
    rssBytes: 0,
    rssText: "-",
    processCount: 0,
    source: "deferred-until-warning"
  };
}

module.exports = {
  RESOURCE_WARN_DISK_PERCENT,
  RESOURCE_WARN_MEMORY_PERCENT,
  deferredGatewayProcessSample,
  isResourceWarning,
  systemMemorySnapshot,
  shouldCollectGatewayProcessSample
};
