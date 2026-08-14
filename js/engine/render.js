// Canvas rendering. Signs are drawn from the actual points the user's stroke
// recorded — nothing synthetic — smoothed with a standard quadratic-through-
// midpoints pass and a soft shadow for ink bleed instead of faking texture
// with random jitter.
function strokePath(ctx, points, width) {
  if (points.length < 2) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = "#14120f";
  ctx.shadowColor = "rgba(20, 18, 15, 0.35)";
  ctx.shadowBlur = width * 0.7;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawArrowhead(ctx, tipX, tipY, fromX, fromY, size) {
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(angle - 0.4) * size, tipY - Math.sin(angle - 0.4) * size);
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(angle + 0.4) * size, tipY - Math.sin(angle + 0.4) * size);
  ctx.stroke();
}

function drawRing(ctx, cx, cy, r, complete) {
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#14120f";
  ctx.lineWidth = 2;
  ctx.setLineDash(complete ? [] : [10, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Procedural glyph paths, in local coordinates (unit radius). Kept as point
// lists so they render through the same ink-stroke renderer as hand-drawn
// signs instead of looking mechanically distinct.
const SIGIL_PATHS = {
  fire: (s) =>
    [0, 1, 2].map((i) => {
      const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
      return [
        { x: 0, y: 0 },
        { x: Math.cos(a) * s, y: Math.sin(a) * s },
      ];
    }),
  water: (s) =>
    [-1, 0, 1].map((i) => [
      { x: -s, y: i * s * 0.5 },
      { x: -s * 0.3, y: i * s * 0.5 - s * 0.4 },
      { x: s * 0.3, y: i * s * 0.5 - s * 0.4 },
      { x: s, y: i * s * 0.5 },
    ]),
  wind: (s) => {
    const pts = [];
    for (let t = 0; t <= 1; t += 0.05) {
      const a = t * Math.PI * 3;
      const rad = s * t;
      pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
    }
    return [pts];
  },
  earth: (s) => [
    [
      { x: 0, y: -s },
      { x: s, y: 0 },
      { x: 0, y: s },
      { x: -s, y: 0 },
      { x: 0, y: -s },
    ],
  ],
  light: (s) =>
    Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 8;
      return [
        { x: Math.cos(a) * s * 0.3, y: Math.sin(a) * s * 0.3 },
        { x: Math.cos(a) * s, y: Math.sin(a) * s },
      ];
    }),
};

function drawSigil(ctx, cx, cy, r, sigilId) {
  const build = SIGIL_PATHS[sigilId];
  if (!build) return;
  ctx.save();
  ctx.translate(cx, cy);
  build(r).forEach((sub) => strokePath(ctx, sub, 2.5));
  ctx.restore();
}

function drawSign(ctx, cx, cy, instance) {
  if (!instance.path || instance.path.length < 2) return;
  const local = instance.path.map((p) => ({ x: p.x, y: p.y }));
  ctx.save();
  ctx.translate(cx, cy);
  const width = 2 + instance.length * 2.5;
  strokePath(ctx, local, width);

  if (instance.archetypeId === "column" || instance.archetypeId === "pulling") {
    const tip = local[local.length - 1];
    const prev = local[Math.max(0, local.length - 2)];
    drawArrowhead(ctx, tip.x, tip.y, prev.x, prev.y, 7 + instance.length * 3);
  }
  ctx.restore();
}

function drawScene(ctx, size, state) {
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * RING_RATIO;

  drawRing(ctx, cx, cy, ringR, state.ringComplete);
  if (state.sigilId) drawSigil(ctx, cx, cy, ringR * 0.28, state.sigilId);
  state.signs.forEach((instance) => drawSign(ctx, cx, cy, instance));

  if (state.livePath && state.livePath.length > 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.55;
    strokePath(ctx, state.livePath, 3);
    ctx.restore();
  }
}

function castEffect(canvas, size, params, sigil, sceneState, duration = 900) {
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const count = 26;
  const style = sigil ? sigil.particle : { shape: "spark" };
  const particles = Array.from({ length: count }, () => {
    const spread = params.spreadRatio * Math.PI * 2 + 0.3;
    const baseAngle = params.hasDirection ? params.direction : Math.random() * Math.PI * 2;
    const angle = params.hasDirection
      ? baseAngle + (Math.random() - 0.5) * spread * 0.6
      : Math.random() * Math.PI * 2;
    const speed = (0.4 + Math.random() * 0.6) * (0.5 + params.intensity);
    return { angle, speed, offset: Math.random() * 0.4 };
  });

  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    drawScene(ctx, size, sceneState);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#14120f";
    particles.forEach((p) => {
      const pt = Math.max(0, t - p.offset) / (1 - p.offset);
      if (pt <= 0) return;
      const dist = pt * size * 0.4 * p.speed;
      const x = cx + Math.cos(p.angle) * dist;
      const y = cy + Math.sin(p.angle) * dist;
      ctx.globalAlpha = 1 - pt;
      if (style.shape === "beam") {
        ctx.fillRect(x - 1, y - 6, 2, 12);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    if (t < 1) requestAnimationFrame(frame);
    else drawScene(ctx, size, sceneState);
  }
  requestAnimationFrame(frame);
}
