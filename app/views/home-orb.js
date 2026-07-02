function createClaraCoreHomeOrb({ canvas, fallback }) {
  const ctx = canvas?.getContext?.("2d", { alpha: true });
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const state = {
    snapshot: null,
    orbState: "active",
    visible: true,
    drawQueued: false
  };

  const palette = {
    quiet: { core: [35, 126, 108], alt: [64, 150, 210], warm: [164, 110, 34], error: [186, 57, 48] },
    active: { core: [30, 156, 136], alt: [0, 163, 255], warm: [164, 110, 34], error: [186, 57, 48] },
    warning: { core: [169, 110, 23], alt: [30, 156, 136], warm: [206, 145, 46], error: [186, 57, 48] },
    error: { core: [186, 57, 48], alt: [169, 110, 23], warm: [206, 145, 46], error: [220, 72, 62] }
  };

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

  function resizeCanvas() {
    if (!canvas) return { width: 0, height: 0, ratio: 1 };
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const nextWidth = Math.floor(width * ratio);
    const nextHeight = Math.floor(height * ratio);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    return { width, height, ratio };
  }

  function point(cx, cy, rx, ry, angle, rotate = 0) {
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    const cos = Math.cos(rotate);
    const sin = Math.sin(rotate);
    return {
      x: cx + x * cos - y * sin,
      y: cy + x * sin + y * cos
    };
  }

  function drawOrbit(context, cx, cy, rx, ry, rotate, color, alpha, width, dash = []) {
    context.save();
    context.translate(cx, cy);
    context.rotate(rotate);
    context.strokeStyle = rgba(color, alpha);
    context.lineWidth = width;
    context.setLineDash(dash);
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function draw() {
    state.drawQueued = false;
    if (!ctx || !state.visible || motionDisabled()) return;

    const { width, height, ratio } = resizeCanvas();
    if (width < 2 || height < 2) return;

    const tone = palette[state.orbState] || palette.active;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const radiusX = width * 0.37;
    const radiusY = height * 0.34;
    const coreRadius = Math.min(width, height) * 0.055;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(radiusX, radiusY) * 1.35);
    wash.addColorStop(0, rgba([232, 255, 249], 0.36));
    wash.addColorStop(0.38, rgba(tone.core, 0.11));
    wash.addColorStop(0.78, rgba(tone.alt, 0.04));
    wash.addColorStop(1, rgba(tone.core, 0));
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX * 1.12, radiusY * 1.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    drawOrbit(ctx, cx, cy, radiusX * 0.98, radiusY * 0.42, -0.16, tone.core, 0.26, 1.25);
    drawOrbit(ctx, cx, cy, radiusX * 0.72, radiusY * 0.58, 0.62, tone.alt, 0.2, 1);
    drawOrbit(ctx, cx, cy, radiusX * 0.5, radiusY * 0.28, -0.72, tone.core, 0.18, 0.9);
    drawOrbit(ctx, cx, cy, radiusX * 1.1, radiusY * 0.78, 0.04, tone.core, 0.1, 0.8, [4, 12]);
    drawOrbit(ctx, cx, cy, radiusX * 0.82, radiusY * 0.94, -0.34, tone.alt, 0.09, 0.75, [3, 14]);

    for (let index = 0; index < 42; index += 1) {
      const angle = seeded(index, 1) * Math.PI * 2;
      const band = 0.28 + seeded(index, 2) * 0.78;
      const rotate = -0.38 + seeded(index, 3) * 0.78;
      const warm = seeded(index, 4) > 0.82;
      const bright = seeded(index, 5) > 0.9;
      const p = point(cx, cy, radiusX * band, radiusY * band * (0.36 + seeded(index, 6) * 0.48), angle, rotate);
      const rgb = warm ? tone.warm : bright ? tone.alt : tone.core;
      const size = 0.9 + seeded(index, 7) * (bright ? 2.2 : 1.4);
      ctx.fillStyle = rgba(rgb, bright ? 0.72 : 0.46);
      ctx.shadowColor = rgba(rgb, bright ? 0.34 : 0.18);
      ctx.shadowBlur = bright ? 8 : 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      if (bright || warm) {
        ctx.strokeStyle = rgba(rgb, 0.28);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 2.25, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 6.4);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.92)");
    glow.addColorStop(0.24, rgba([205, 255, 242], 0.7));
    glow.addColorStop(0.48, rgba(tone.core, 0.32));
    glow.addColorStop(1, rgba(tone.core, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius * 6.4, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(cx - coreRadius * 0.25, cy - coreRadius * 0.25, 0, cx, cy, coreRadius * 1.5);
    core.addColorStop(0, "rgba(255, 255, 255, 0.96)");
    core.addColorStop(0.48, rgba([206, 255, 244], 0.92));
    core.addColorStop(1, rgba(tone.core, 0.82));
    ctx.fillStyle = core;
    ctx.shadowColor = rgba(tone.core, 0.45);
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
  }

  function queueDraw() {
    if (!ctx || state.drawQueued || motionDisabled()) return;
    state.drawQueued = true;
    window.requestAnimationFrame(draw);
  }

  function render(snapshot, orbState) {
    state.snapshot = snapshot;
    state.orbState = orbState || "active";
    if (fallback) fallback.dataset.canvasReady = ctx ? "1" : "0";
    queueDraw();
  }

  if (canvas && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      state.visible = entries.some((entry) => entry.isIntersecting);
      if (state.visible) queueDraw();
    });
    observer.observe(canvas);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) queueDraw();
  });
  reduceMotion?.addEventListener?.("change", queueDraw);
  window.addEventListener("resize", queueDraw);

  if (fallback) {
    fallback.dataset.canvasReady = ctx ? "1" : "0";
    fallback.dataset.orbState ||= "active";
  }
  queueDraw();

  return { render };
}

window.createClaraCoreHomeOrb = createClaraCoreHomeOrb;
