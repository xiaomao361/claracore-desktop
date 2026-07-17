function createClaraCoreHomeVision({ canvas, container, fallback }) {
  const QUIET_INTERVAL = 1000 / 12;
  const ACTIVE_INTERVAL = 1000 / 24;
  const MAX_PIXELS = 720000;
  const HORIZON_LAYERS = 3;
  const state = {
    active: false,
    running: false,
    destroyed: false,
    model: null,
    frameRequest: 0,
    frameTimer: 0,
    frameCount: 0,
    lastFrameAt: 0,
    width: 0,
    height: 0,
    scale: 1,
    resizeObserver: null,
    motionObserver: null,
    arrivalUntil: 0
  };
  let context = null;

  try {
    context = canvas?.getContext?.("2d") || null;
  } catch (_error) {
    context = null;
  }

  function prefersReducedMotion() {
    return document.body?.dataset.motionPreference === "off" || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  function shouldAnimate() {
    return Boolean(state.active && !state.destroyed && !document.hidden && context && !prefersReducedMotion());
  }

  function cancelSchedule() {
    if (state.frameRequest) cancelAnimationFrame(state.frameRequest);
    if (state.frameTimer) clearTimeout(state.frameTimer);
    state.frameRequest = 0;
    state.frameTimer = 0;
    state.running = false;
  }

  function resize() {
    if (!canvas || !container || !context) return false;
    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));
    const pixelScale = Math.min(window.devicePixelRatio || 1, 1.35, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
    const targetWidth = Math.max(1, Math.floor(width * pixelScale));
    const targetHeight = Math.max(1, Math.floor(height * pixelScale));
    if (targetWidth === canvas.width && targetHeight === canvas.height) return false;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    state.width = width;
    state.height = height;
    state.scale = pixelScale;
    context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    return true;
  }

  function toRgba(hex, alpha) {
    const normalized = String(hex || "#3f856f").replace("#", "");
    const value = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized.padEnd(6, "0").slice(0, 6);
    const number = Number.parseInt(value, 16);
    return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${alpha})`;
  }

  function horizonY(height, narrow) {
    return height * (narrow ? 0.49 : 0.52);
  }

  function agentPosition(index, width, height) {
    const narrow = width < 720;
    const xRatios = narrow ? [0.71, 0.48, 0.88] : [0.64, 0.81, 0.92];
    return {
      x: width * (xRatios[index] || xRatios[0]),
      y: horizonY(height, narrow)
    };
  }

  function drawWave(y, amplitude, phase, color, width, lineWidth) {
    const segment = width / 4;
    context.beginPath();
    context.moveTo(0, y + Math.sin(phase) * amplitude * 0.32);
    context.bezierCurveTo(
      segment * 0.72,
      y - amplitude,
      segment * 1.4,
      y + amplitude,
      segment * 2,
      y + Math.sin(phase + 1.2) * amplitude * 0.28
    );
    context.bezierCurveTo(
      segment * 2.65,
      y - amplitude * 0.85,
      segment * 3.25,
      y + amplitude * 0.78,
      width,
      y + Math.sin(phase + 2.4) * amplitude * 0.3
    );
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  }

  function drawAgentSignal(agent, index, time, width, height, dark, reduced) {
    const point = agentPosition(index, width, height);
    const isArrival = agent.arrival && time < state.arrivalUntil;
    const active = agent.presence === "active";
    const alpha = agent.presence === "fading" ? 0.18 : active ? 0.34 : 0.25;
    const glowRadius = active ? 112 : 82;
    const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius);
    glow.addColorStop(0, toRgba(agent.color, alpha));
    glow.addColorStop(1, toRgba(agent.color, 0));
    context.fillStyle = glow;
    context.fillRect(point.x - glowRadius, point.y - glowRadius, glowRadius * 2, glowRadius * 2);

    if (isArrival) {
      const progress = Math.max(0, Math.min(1, 1 - (state.arrivalUntil - time) / 1400));
      context.beginPath();
      context.arc(point.x, point.y, 16 + progress * 38, 0, Math.PI * 2);
      context.strokeStyle = toRgba(agent.color, 0.28 * (1 - progress));
      context.lineWidth = 1;
      context.stroke();
    } else if (!reduced && active) {
      const radius = 22 + Math.sin(time * 0.0018) * 3;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.strokeStyle = toRgba(agent.color, dark ? 0.22 : 0.17);
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function draw(time = performance.now()) {
    if (!context || !state.model) return;
    resize();
    const width = state.width;
    const height = state.height;
    const narrow = width < 720;
    const dark = document.body?.dataset.theme === "dark" || document.body?.dataset.themePreference === "dark";
    const reduced = prefersReducedMotion();
    const activity = state.model.core.state === "active" ? 1 : state.model.core.state === "recent" ? 0.55 : 0.18;
    const motionTime = reduced ? 0 : time;
    const y = horizonY(height, narrow);
    context.clearRect(0, 0, width, height);

    const wash = context.createLinearGradient(0, 0, width, 0);
    wash.addColorStop(0, dark ? "rgba(57,112,92,0)" : "rgba(107,157,137,0)");
    wash.addColorStop(0.5, dark ? "rgba(57,112,92,.06)" : "rgba(107,157,137,.035)");
    wash.addColorStop(0.78, toRgba(state.model.core.dominantColor, dark ? 0.12 : 0.07));
    wash.addColorStop(1, toRgba(state.model.core.dominantColor, 0));
    context.fillStyle = wash;
    context.fillRect(0, y - height * 0.18, width, height * 0.36);

    const phase = motionTime * (0.00008 + activity * 0.00005);
    drawWave(y - 15, Math.max(22, height * 0.055), phase, dark ? "rgba(149,187,172,.13)" : "rgba(77,126,107,.14)", width, 0.8);
    drawWave(y + 14, Math.max(18, height * 0.045), phase + 1.6, dark ? "rgba(149,187,172,.09)" : "rgba(77,126,107,.1)", width, 0.7);
    drawWave(y + 34, Math.max(14, height * 0.035), phase + 3.1, dark ? "rgba(149,187,172,.06)" : "rgba(77,126,107,.07)", width, 0.6);

    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.strokeStyle = dark ? "rgba(111,183,156,.86)" : "rgba(47,118,95,.82)";
    context.lineWidth = 1.2;
    context.stroke();

    (state.model.agents || []).slice(0, 3).forEach((agent, index) =>
      drawAgentSignal(agent, index, motionTime, width, height, dark, reduced)
    );
    state.frameCount += 1;
    state.lastFrameAt = time;
  }

  function schedule() {
    cancelSchedule();
    if (!shouldAnimate()) {
      draw();
      return;
    }
    state.running = true;
    const interval = state.model?.core?.state === "active" ? ACTIVE_INTERVAL : QUIET_INTERVAL;
    state.frameTimer = window.setTimeout(() => {
      state.frameTimer = 0;
      state.frameRequest = requestAnimationFrame((time) => {
        state.frameRequest = 0;
        draw(time);
        schedule();
      });
    }, interval);
  }

  function setModel(model) {
    state.model = model;
    if ((model?.agents || []).some((agent) => agent.arrival)) state.arrivalUntil = performance.now() + 1400;
    draw();
    if (state.active) schedule();
  }

  function setActive(active) {
    state.active = Boolean(active);
    if (state.active) schedule();
    else cancelSchedule();
  }

  function syncMotion() {
    if (!state.active) return;
    schedule();
  }

  function debugState() {
    return {
      active: state.active,
      running: state.running,
      scheduled: Number(Boolean(state.frameTimer)) + Number(Boolean(state.frameRequest)),
      frameCount: state.frameCount,
      particleCount: 0,
      horizonLayers: HORIZON_LAYERS,
      visualMode: "shared-horizon",
      atmosphereCachePixels: 0,
      agentCount: state.model?.agents?.length || 0,
      reducedMotion: prefersReducedMotion(),
      canvasPixels: canvas ? canvas.width * canvas.height : 0,
      arrivalActive: state.arrivalUntil > performance.now()
    };
  }

  if (!context) {
    if (canvas) canvas.hidden = true;
    if (fallback) fallback.hidden = false;
  } else {
    state.resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
    });
    state.resizeObserver.observe(container);
    document.addEventListener("visibilitychange", syncMotion);
    state.motionObserver = new MutationObserver(syncMotion);
    state.motionObserver.observe(document.body, { attributes: true, attributeFilter: ["data-motion-preference", "data-theme", "data-theme-preference"] });
  }

  return { setModel, setActive, debugState };
}

window.createClaraCoreHomeVision = createClaraCoreHomeVision;
