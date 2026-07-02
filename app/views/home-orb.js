function createClaraCoreHomeOrb({ canvas, fallback }) {
  const ctx = canvas?.getContext?.("2d", { alpha: true });
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const state = {
    animationFrame: 0,
    lastFrameTime: 0,
    snapshot: null,
    orbState: "quiet",
    visible: true,
    particles: [],
    signals: [],
    particleSignature: ""
  };

  const palette = {
    quiet: { core: [35, 126, 108], alt: [64, 150, 210], warning: [164, 110, 34], error: [186, 57, 48] },
    active: { core: [30, 156, 136], alt: [0, 163, 255], warning: [164, 110, 34], error: [186, 57, 48] },
    warning: { core: [169, 110, 23], alt: [30, 156, 136], warning: [206, 145, 46], error: [186, 57, 48] },
    error: { core: [186, 57, 48], alt: [169, 110, 23], warning: [206, 145, 46], error: [220, 72, 62] }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function seeded(index, salt = 0) {
    const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  function motionDisabled() {
    return Boolean(reduceMotion?.matches || document.body?.dataset?.motion === "off");
  }

  function metricsFromSnapshot(snapshot) {
    const memoryStats = snapshot?.memoryStats || {};
    const traces = snapshot?.gatewayTraces || [];
    const innerLifeCounts = snapshot?.innerLife?.counts || {};
    const activeLines = (snapshot?.sharedLine?.lines || []).filter((line) => line.status !== "archived").length;
    const gatewayErrors = traces.filter((trace) => trace.status === "error").length;
    return {
      memories: Number(memoryStats.activeCount ?? memoryStats.totalCount ?? 0),
      pendingVectors: Number(memoryStats.pendingEmbeddingCount ?? 0),
      failedVectors: Number(memoryStats.failedEmbeddingCount ?? 0),
      gatewayCalls: traces.length,
      gatewayErrors,
      pendingShares: Number(innerLifeCounts.pending_shares_count ?? 0),
      activeSessions: Number(innerLifeCounts.active_sessions_count ?? 0),
      activeLines,
      hasCurrentLine: Boolean(snapshot?.sharedLine?.currentPosition?.summary)
    };
  }

  function ensureParticles(metrics) {
    const count = clamp(30 + Math.floor(Math.sqrt(metrics.memories || 0) * 3.4) + metrics.activeLines * 4, 34, 74);
    const signature = `${count}:${metrics.activeLines}:${metrics.pendingShares}:${metrics.failedVectors}`;
    if (signature === state.particleSignature) return;
    state.particleSignature = signature;
    state.particles = Array.from({ length: count }, (_, index) => {
      const layer = seeded(index, 8) > 0.72 ? 1 : 0;
      return {
        angle: seeded(index, 1) * Math.PI * 2,
        radius: 0.18 + seeded(index, 2) * (layer ? 0.74 : 0.54),
        speed: 0.035 + seeded(index, 3) * 0.075,
        size: 0.8 + seeded(index, 4) * 2.2,
        phase: seeded(index, 5) * Math.PI * 2,
        layer,
        agent: seeded(index, 6)
      };
    });
  }

  function ensureSignals(metrics) {
    const count = clamp(metrics.gatewayCalls ? 2 + Math.floor(metrics.gatewayCalls / 5) : 1, 1, 5);
    state.signals = Array.from({ length: count }, (_, index) => ({
      angle: seeded(index, 21) * Math.PI * 2,
      offset: seeded(index, 22),
      speed: 0.11 + seeded(index, 23) * 0.08,
      error: index < metrics.gatewayErrors
    }));
  }

  function resizeCanvas() {
    if (!canvas) return { width: 0, height: 0, ratio: 1 };
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
    }
    return { width, height, ratio };
  }

  function draw(timestamp) {
    state.animationFrame = 0;
    if (!ctx || !state.snapshot || document.hidden || motionDisabled() || !state.visible) return;
    if (timestamp - state.lastFrameTime < 50) {
      start();
      return;
    }
    state.lastFrameTime = timestamp;

    const { width, height, ratio } = resizeCanvas();
    if (width < 2 || height < 2) return;

    const metrics = metricsFromSnapshot(state.snapshot);
    ensureParticles(metrics);
    ensureSignals(metrics);

    const tone = palette[state.orbState] || palette.quiet;
    const time = timestamp / 1000;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const field = Math.min(width, height);
    const radius = field * 0.43;
    const activity =
      state.orbState === "error" ? 1.18 :
      state.orbState === "warning" ? 1.04 :
      state.orbState === "active" ? 0.96 : 0.72;
    const breath = 1 + Math.sin(time * (0.75 + activity * 0.12)) * 0.035 * activity;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";

    const backdrop = ctx.createLinearGradient(0, 0, width, height);
    backdrop.addColorStop(0, "rgba(3, 14, 12, 0.34)");
    backdrop.addColorStop(0.54, "rgba(0, 0, 0, 0.08)");
    backdrop.addColorStop(1, "rgba(3, 10, 16, 0.36)");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.08);
    halo.addColorStop(0, rgba(tone.core, 0.32));
    halo.addColorStop(0.22, rgba(tone.alt, 0.13));
    halo.addColorStop(0.58, rgba(tone.core, 0.045));
    halo.addColorStop(1, rgba(tone.core, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 2.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    drawNebula(ctx, cx, cy, radius, time, tone, activity);
    drawShell(ctx, cx, cy, radius * breath, time, tone, metrics, activity);
    drawParticles(ctx, cx, cy, radius, time, tone, metrics, activity);
    drawSignals(ctx, cx, cy, radius, time, tone, activity);
    drawCore(ctx, cx, cy, radius * breath, time, tone, metrics, activity);

    start();
  }

  function drawShell(context, cx, cy, radius, time, tone, metrics, activity) {
    context.save();
    context.translate(cx, cy);
    context.rotate(time * 0.08);
    context.lineWidth = 1.1;
    context.strokeStyle = rgba(tone.core, 0.26);
    context.setLineDash([4, 15]);
    context.beginPath();
    context.ellipse(0, 0, radius * 1.16, radius * 0.54, -0.28, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([2, 16]);
    context.strokeStyle = rgba(tone.alt, 0.2);
    context.beginPath();
    context.ellipse(0, 0, radius * 0.98, radius * 0.38, 0.72, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);

    context.strokeStyle = rgba([220, 255, 244], 0.07);
    context.lineWidth = 0.7;
    context.beginPath();
    context.arc(0, 0, radius * 1.05, 0, Math.PI * 2);
    context.stroke();

    if (metrics.hasCurrentLine || metrics.activeLines) {
      context.strokeStyle = rgba(tone.alt, 0.34);
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(0, 0, radius * 0.72, -0.4, Math.PI * 1.18);
      context.stroke();
    }

    if (metrics.pendingShares) {
      context.strokeStyle = rgba(tone.warning, 0.28 + Math.sin(time * 2.1) * 0.07);
      context.lineWidth = 1.7;
      context.beginPath();
      context.arc(0, 0, radius * (0.86 + Math.sin(time * 1.3) * 0.018), 0, Math.PI * 2);
      context.stroke();
    }

    if (metrics.failedVectors || metrics.gatewayErrors) {
      context.strokeStyle = rgba(tone.error, 0.34 + Math.sin(time * 3.4) * 0.1);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, radius * (1.08 + Math.sin(time * 2.8) * 0.018), -0.2, Math.PI * 1.34);
      context.stroke();
    }
    context.restore();
  }

  function drawNebula(context, cx, cy, radius, time, tone, activity) {
    context.save();
    context.translate(cx, cy);
    context.rotate(time * 0.035);
    for (let arm = 0; arm < 3; arm += 1) {
      const base = arm * Math.PI * 2 / 3;
      const gradient = context.createLinearGradient(
        Math.cos(base) * radius * 0.22,
        Math.sin(base) * radius * 0.12,
        Math.cos(base + 0.85) * radius * 1.22,
        Math.sin(base + 0.85) * radius * 0.72
      );
      gradient.addColorStop(0, rgba(tone.core, 0.02));
      gradient.addColorStop(0.48, rgba(tone.alt, 0.12 * activity));
      gradient.addColorStop(1, rgba(tone.core, 0));
      context.strokeStyle = gradient;
      context.lineWidth = radius * 0.18;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(Math.cos(base) * radius * 0.18, Math.sin(base) * radius * 0.1);
      context.quadraticCurveTo(
        Math.cos(base + 0.52) * radius * 0.78,
        Math.sin(base + 0.52) * radius * 0.44,
        Math.cos(base + 1.06) * radius * 1.24,
        Math.sin(base + 1.06) * radius * 0.72
      );
      context.stroke();
    }
    context.restore();
  }

  function drawParticles(context, cx, cy, radius, time, tone, metrics, activity) {
    for (let index = 0; index < state.particles.length; index += 1) {
      const particle = state.particles[index];
      const spiral = particle.radius * 2.25;
      const orbit = particle.angle + spiral + time * particle.speed * activity * (particle.layer ? -1 : 1);
      const wave = Math.sin(time * 0.9 + particle.phase) * 0.045;
      const px = cx + Math.cos(orbit) * radius * (particle.radius + wave);
      const py = cy + Math.sin(orbit) * radius * (particle.radius * 0.68 + wave);
      const depth = 0.58 + Math.sin(orbit + particle.phase) * 0.28;
      const rgb = particle.agent > 0.74 ? tone.alt : tone.core;
      const alpha = (0.28 + depth * 0.36) * (particle.layer ? 0.72 : 1);
      context.fillStyle = rgba(rgb, alpha);
      context.shadowColor = rgba(rgb, 0.38);
      context.shadowBlur = 10;
      context.beginPath();
      context.arc(px, py, particle.size * (0.75 + depth * 0.45), 0, Math.PI * 2);
      context.fill();
    }
    context.shadowBlur = 0;
  }

  function drawSignals(context, cx, cy, radius, time, tone, activity) {
    for (const signal of state.signals) {
      const progress = (time * signal.speed * activity + signal.offset) % 1;
      const angle = signal.angle + Math.sin(time * 0.3 + signal.offset) * 0.32;
      const startR = radius * (1.08 - progress * 0.54);
      const endR = Math.max(radius * 0.22, startR - radius * 0.18);
      const rgb = signal.error ? tone.error : tone.alt;
      const alpha = (1 - progress) * 0.34 + 0.07;
      context.strokeStyle = rgba(rgb, alpha);
      context.lineWidth = signal.error ? 2.2 : 1.45;
      context.shadowColor = rgba(rgb, 0.28);
      context.shadowBlur = signal.error ? 12 : 8;
      context.beginPath();
      context.moveTo(cx + Math.cos(angle) * startR, cy + Math.sin(angle) * startR * 0.76);
      context.quadraticCurveTo(
        cx + Math.cos(angle + 0.7) * radius * 0.58,
        cy + Math.sin(angle + 0.7) * radius * 0.42,
        cx + Math.cos(angle + 1.12) * endR,
        cy + Math.sin(angle + 1.12) * endR * 0.72
      );
      context.stroke();
    }
    context.shadowBlur = 0;
  }

  function drawCore(context, cx, cy, radius, time, tone, metrics, activity) {
    const coreRadius = radius * (0.2 + Math.min(metrics.activeSessions + metrics.gatewayCalls, 12) * 0.002);
    const pulse = 1 + Math.sin(time * (1.1 + activity * 0.25)) * 0.045;
    const glow = context.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 6.2);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.94)");
    glow.addColorStop(0.1, rgba([200, 255, 238], 0.68));
    glow.addColorStop(0.22, rgba(tone.core, 0.46));
    glow.addColorStop(0.52, rgba(tone.alt, 0.16));
    glow.addColorStop(1, rgba(tone.core, 0));
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, coreRadius * 6.2 * pulse, 0, Math.PI * 2);
    context.fill();

    const innerCore = context.createRadialGradient(cx - coreRadius * 0.22, cy - coreRadius * 0.28, 0, cx, cy, coreRadius * 1.35);
    innerCore.addColorStop(0, "rgba(255, 255, 255, 0.96)");
    innerCore.addColorStop(0.38, rgba([205, 255, 238], 0.9));
    innerCore.addColorStop(0.74, rgba(tone.core, 0.78));
    innerCore.addColorStop(1, rgba(tone.alt, 0.2));
    context.fillStyle = innerCore;
    context.shadowColor = rgba(tone.core, 0.68);
    context.shadowBlur = 24;
    context.beginPath();
    context.arc(cx, cy, coreRadius * 1.08 * pulse, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = rgba([235, 255, 248], 0.62);
    context.lineWidth = 1.1;
    context.beginPath();
    context.arc(cx, cy, coreRadius * 1.42 * pulse, 0.25, Math.PI * 1.62);
    context.stroke();

    context.strokeStyle = rgba(tone.alt, 0.24);
    context.lineWidth = 1;
    for (let ray = 0; ray < 9; ray += 1) {
      const angle = ray / 9 * Math.PI * 2 + time * 0.16;
      context.beginPath();
      context.moveTo(cx + Math.cos(angle) * coreRadius * 1.36, cy + Math.sin(angle) * coreRadius * 1.36);
      context.lineTo(cx + Math.cos(angle) * coreRadius * (1.84 + (ray % 3) * 0.18), cy + Math.sin(angle) * coreRadius * (1.84 + (ray % 3) * 0.18));
      context.stroke();
    }
    context.shadowBlur = 0;
  }

  function start() {
    if (!ctx || state.animationFrame || document.hidden || motionDisabled() || !state.visible) return;
    state.animationFrame = window.requestAnimationFrame(draw);
  }

  function stop() {
    if (!state.animationFrame) return;
    window.cancelAnimationFrame(state.animationFrame);
    state.animationFrame = 0;
  }

  function render(snapshot, orbState) {
    state.snapshot = snapshot;
    state.orbState = orbState || "quiet";
    if (fallback) fallback.dataset.canvasReady = ctx ? "1" : "0";
    if (!ctx || motionDisabled()) {
      stop();
      return;
    }
    start();
  }

  if (canvas && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      state.visible = entries.some((entry) => entry.isIntersecting);
      if (state.visible) start();
      else stop();
    });
    observer.observe(canvas);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  reduceMotion?.addEventListener?.("change", () => {
    if (reduceMotion.matches) stop();
    else start();
  });
  window.addEventListener("resize", () => {
    state.particleSignature = "";
    start();
  });

  return { render };
}

window.createClaraCoreHomeOrb = createClaraCoreHomeOrb;
