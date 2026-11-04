(function (global) {
  const MAX_PAST_POSITIONS = 3;
  const PRESETS = {
    hero: {
      width: 540,
      height: 320,
      spine: [[0, 292], [70, 272], [110, 190], [190, 168], [270, 146], [320, 196], [398, 132]],
      back: "M0 292C70 272 110 190 190 168C270 146 320 196 398 132C350 222 270 206 202 214C130 222 70 290 0 292Z",
      front: "M0 292C60 292 120 236 196 196C270 158 340 188 398 132C372 178 300 178 226 176C150 174 70 250 0 292Z",
      edge: "M0 292C70 272 110 190 190 168C270 146 320 196 398 132",
      link: "M414 121C448 100 472 88 493 70",
      current: { x: 398, y: 132, r: 16, halo: 30, labelY: 182 },
      next: { x: 500, y: 62, r: 9, labelY: 40 },
      dot: 6
    },
    wide: {
      width: 760,
      height: 150,
      spine: [[0, 130], [120, 128], [180, 70], [300, 78], [420, 86], [470, 110], [580, 58]],
      back: "M0 130C120 128 180 70 300 78C420 86 470 110 580 58C520 130 410 112 310 112C190 112 110 134 0 130Z",
      front: "M0 130C110 134 190 96 310 96C420 96 500 110 580 58C540 96 430 86 306 84C180 82 110 120 0 130Z",
      edge: "M0 130C120 128 180 70 300 78C420 86 470 110 580 58",
      link: "M594 52C630 42 665 38 692 28",
      current: { x: 580, y: 58, r: 13, halo: 24, labelY: 100 },
      next: { x: 700, y: 24, r: 8, labelY: 52 },
      dot: 5.5
    }
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function cubicAt([p0, p1, p2, p3], t) {
    const u = 1 - t;
    const blend = (axis) => (u ** 3) * p0[axis] + 3 * (u ** 2) * t * p1[axis] + 3 * u * (t ** 2) * p2[axis] + (t ** 3) * p3[axis];
    return { x: Math.round(blend(0)), y: Math.round(blend(1)) };
  }

  function spinePoint(spine, progress) {
    const inFirstSegment = progress < 0.5;
    const segment = inFirstSegment ? spine.slice(0, 4) : spine.slice(3, 7);
    return cubicAt(segment, inFirstSegment ? progress * 2 : (progress - 0.5) * 2);
  }

  function shortDate(value, withTime = false) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(raw) ? `${raw.replace(" ", "T")}Z` : raw;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {})
    });
  }

  // Past nodes are placed from the recorded positions the caller passes, so an
  // omitted history or next step never draws a position that was not recorded.
  function render({ preset = "hero", idPrefix, ariaLabel, pastLabels = [], currentLabel = "", nextLabel = "" }) {
    const shape = PRESETS[preset] || PRESETS.hero;
    const past = pastLabels.slice(-MAX_PAST_POSITIONS);
    const nodes = past.map((label, index) => {
      const point = spinePoint(shape.spine, ((index + 1) / (past.length + 1)) * 0.9);
      return `<circle class="ribbon-past" cx="${point.x}" cy="${point.y}" r="${shape.dot}"/><text class="ribbon-label" x="${point.x}" y="${point.y - 15}" text-anchor="middle">${escapeHtml(label)}</text>`;
    }).join("");
    const { current, next } = shape;
    const nextMarkup = nextLabel
      ? `<path class="ribbon-link" d="${shape.link}"/><circle class="ribbon-next" cx="${next.x}" cy="${next.y}" r="${next.r}"/><text class="ribbon-label" x="${next.x}" y="${next.labelY}" text-anchor="middle">${escapeHtml(nextLabel)}</text>`
      : "";
    return `<svg class="shared-line-ribbon" viewBox="0 0 ${shape.width} ${shape.height}" role="img" aria-label="${escapeHtml(ariaLabel)}" focusable="false"><defs><linearGradient id="${idPrefix}Back" x1="0" y1="1" x2="1" y2="0"><stop class="ribbon-back-start" offset="0"/><stop class="ribbon-back-mid" offset="0.55"/><stop class="ribbon-back-end" offset="1"/></linearGradient><linearGradient id="${idPrefix}Front" x1="0" y1="1" x2="1" y2="0"><stop class="ribbon-front-start" offset="0"/><stop class="ribbon-front-mid" offset="0.5"/><stop class="ribbon-front-end" offset="1"/></linearGradient><radialGradient id="${idPrefix}Orb" cx="0.35" cy="0.3" r="0.8"><stop class="ribbon-orb-light" offset="0"/><stop class="ribbon-orb-soft" offset="0.35"/><stop class="ribbon-orb-base" offset="0.85"/><stop class="ribbon-orb-deep" offset="1"/></radialGradient></defs><path d="${shape.back}" fill="url(#${idPrefix}Back)"/><path d="${shape.front}" fill="url(#${idPrefix}Front)"/><path class="ribbon-edge" d="${shape.edge}"/>${nodes}${nextMarkup}<circle class="ribbon-halo" cx="${current.x}" cy="${current.y}" r="${current.halo}"/><circle cx="${current.x}" cy="${current.y}" r="${current.r}" fill="url(#${idPrefix}Orb)"/><ellipse class="ribbon-glint" cx="${current.x - 6}" cy="${current.y - 7}" rx="${current.r * 0.28}" ry="${current.r * 0.19}"/><text class="ribbon-label ribbon-label-current" x="${current.x}" y="${current.labelY}" text-anchor="middle">${escapeHtml(currentLabel)}</text></svg>`;
  }

  const api = { render, shortDate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.ClaraCoreSharedLineRibbon = api;
})(typeof window !== "undefined" ? window : globalThis);
