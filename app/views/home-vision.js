function createClaraCoreHomeVision({ canvas, container, fallback }) {
  const QUIET_INTERVAL = 1000 / 12;
  const ACTIVE_INTERVAL = 1000 / 30;
  const PARTICLE_COUNT = 96;
  const MAX_PIXELS = 900000;
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
    particles: [],
    cacheKey: "",
    coreSprite: null,
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

  function deterministicParticles() {
    const particles = [];
    let seed = 0x51f15e;
    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const a = (seed / 4294967296) * Math.PI * 2;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const radius = 0.16 + (seed / 4294967296) * 0.42;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      particles.push({ angle: a, radius, speed: 0.000018 + (seed / 4294967296) * 0.000018, size: 0.65 + (index % 4) * 0.22 });
    }
    state.particles = particles;
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
    const pixelScale = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
    const targetWidth = Math.max(1, Math.floor(width * pixelScale));
    const targetHeight = Math.max(1, Math.floor(height * pixelScale));
    if (targetWidth === canvas.width && targetHeight === canvas.height) return false;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    state.width = width;
    state.height = height;
    state.scale = pixelScale;
    context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    state.cacheKey = "";
    return true;
  }

  function buildCoreSprite(color, dark) {
    const key = `${color}:${dark ? "dark" : "light"}`;
    if (state.cacheKey === key && state.coreSprite) return state.coreSprite;
    const sprite = document.createElement("canvas");
    sprite.width = 420;
    sprite.height = 420;
    const spriteContext = sprite.getContext("2d");
    const center = 210;
    const aura = spriteContext.createRadialGradient(center, center, 18, center, center, 205);
    aura.addColorStop(0, dark ? "rgba(238,247,255,.9)" : "rgba(255,255,255,.95)");
    aura.addColorStop(0.24, `${color}b8`);
    aura.addColorStop(0.56, `${color}38`);
    aura.addColorStop(1, `${color}00`);
    spriteContext.fillStyle = aura;
    spriteContext.fillRect(0, 0, 420, 420);
    spriteContext.globalCompositeOperation = "screen";
    spriteContext.lineCap = "round";
    for (let index = 0; index < 22; index += 1) {
      const angle = (index / 22) * Math.PI * 2;
      const wobble = Math.sin(index * 2.17) * 15;
      spriteContext.beginPath();
      spriteContext.moveTo(center + Math.cos(angle) * 38, center + Math.sin(angle) * 38);
      spriteContext.bezierCurveTo(
        center + Math.cos(angle + 0.5) * (88 + wobble),
        center + Math.sin(angle + 0.5) * (88 + wobble),
        center + Math.cos(angle - 0.35) * (125 - wobble),
        center + Math.sin(angle - 0.35) * (125 - wobble),
        center + Math.cos(angle) * (152 + wobble * 0.25),
        center + Math.sin(angle) * (152 + wobble * 0.25)
      );
      spriteContext.strokeStyle = index % 3 === 0 ? "rgba(255,255,255,.38)" : `${color}75`;
      spriteContext.lineWidth = index % 4 === 0 ? 2.2 : 1.1;
      spriteContext.stroke();
    }
    state.cacheKey = key;
    state.coreSprite = sprite;
    return sprite;
  }

  function drawFlow(agent, index, time, centerX, centerY, fieldRadius) {
    const orbitAngle = -1.08 + index * 1.18;
    const outerX = centerX + Math.cos(orbitAngle) * fieldRadius * 0.82;
    const outerY = centerY + Math.sin(orbitAngle) * fieldRadius * 0.68;
    const controlX = centerX + Math.cos(orbitAngle + 0.8) * fieldRadius * 0.34;
    const controlY = centerY + Math.sin(orbitAngle + 0.8) * fieldRadius * 0.34;
    context.beginPath();
    context.moveTo(outerX, outerY);
    context.quadraticCurveTo(controlX, controlY, centerX, centerY);
    context.strokeStyle = `${agent.color}${agent.presence === "fading" ? "32" : "68"}`;
    context.lineWidth = agent.presence === "active" ? 1.8 : 1.1;
    context.stroke();

    const phase = ((time * (agent.presence === "active" ? 0.00038 : 0.00018) + index * 0.27) % 1 + 1) % 1;
    const inverse = 1 - phase;
    const x = inverse * inverse * outerX + 2 * inverse * phase * controlX + phase * phase * centerX;
    const y = inverse * inverse * outerY + 2 * inverse * phase * controlY + phase * phase * centerY;
    context.beginPath();
    context.arc(x, y, agent.presence === "active" ? 3 : 2.1, 0, Math.PI * 2);
    context.fillStyle = agent.color;
    context.fill();

    context.beginPath();
    context.arc(outerX, outerY, agent.presence === "fading" ? 4.2 : 6.2, 0, Math.PI * 2);
    context.fillStyle = agent.color;
    context.globalAlpha = agent.presence === "fading" ? 0.38 : 0.88;
    context.fill();
    context.globalAlpha = 1;
    if (agent.arrival && time < state.arrivalUntil) {
      const progress = Math.max(0, Math.min(1, 1 - (state.arrivalUntil - time) / 1400));
      context.beginPath();
      context.arc(outerX, outerY, 9 + progress * 18, 0, Math.PI * 2);
      context.strokeStyle = agent.color;
      context.globalAlpha = 0.5 * (1 - progress);
      context.lineWidth = 1.2;
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  function draw(time = performance.now()) {
    if (!context || !state.model) return;
    resize();
    const width = state.width;
    const height = state.height;
    const centerX = width * 0.53;
    const centerY = height * 0.49;
    const fieldRadius = Math.min(width, height) * 0.42;
    const dark = document.body?.dataset.theme === "dark" || document.body?.dataset.themePreference === "dark";
    const reduced = prefersReducedMotion();
    const activity = state.model.core.state === "active" ? 1 : state.model.core.state === "recent" ? 0.62 : 0.28;
    const breath = reduced ? 1 : 1 + Math.sin(time * (0.00038 + activity * 0.00018)) * (0.018 + activity * 0.016);
    context.clearRect(0, 0, width, height);

    for (let index = 0; index < state.particles.length; index += 1) {
      const particle = state.particles[index];
      const angle = particle.angle + (reduced ? 0 : time * particle.speed);
      const radius = fieldRadius * particle.radius;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.76;
      context.beginPath();
      context.arc(x, y, particle.size, 0, Math.PI * 2);
      context.fillStyle = dark ? "rgba(194,218,242,.34)" : "rgba(67,92,120,.22)";
      context.fill();
    }

    (state.model.agents || []).slice(0, 3).forEach((agent, index) => drawFlow(agent, index, reduced ? 0 : time, centerX, centerY, fieldRadius));
    const sprite = buildCoreSprite(state.model.core.dominantColor, dark);
    const size = Math.min(420, fieldRadius * 1.62) * breath;
    context.drawImage(sprite, centerX - size / 2, centerY - size / 2, size, size);
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
    state.cacheKey = "";
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
      particleCount: state.particles.length,
      agentCount: state.model?.agents?.length || 0,
      reducedMotion: prefersReducedMotion(),
      canvasPixels: canvas ? canvas.width * canvas.height : 0,
      arrivalActive: state.arrivalUntil > performance.now()
    };
  }

  deterministicParticles();
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
