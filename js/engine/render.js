// Canvas rendering. Ink/chalk texture comes from drawing each stroke twice
// with a small, seeded jitter — seeded so it doesn't crawl on every repaint.
function seededJitter(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function inkStroke(ctx, x1, y1, x2, y2, seed, width) {
  const jx = (seededJitter(seed) - 0.5) * 3;
  const jy = (seededJitter(seed + 1) - 0.5) * 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2 + jx, (y1 + y2) / 2 + jy, x2, y2);
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = width * 0.6;
  ctx.beginPath();
  ctx.moveTo(x1 + (seededJitter(seed + 2) - 0.5) * 2, y1 + (seededJitter(seed + 3) - 0.5) * 2);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawRing(ctx, cx, cy, r, complete) {
  ctx.strokeStyle = "#14120f";
  ctx.lineWidth = 2;
  ctx.setLineDash(complete ? [] : [10, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSigil(ctx, cx, cy, r, sigilId) {
  ctx.strokeStyle = "#14120f";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const s = r;
  ctx.save();
  ctx.translate(cx, cy);
  switch (sigilId) {
    case "fire":
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      }
      ctx.stroke();
      break;
    case "water":
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(-s, i * s * 0.5);
        ctx.quadraticCurveTo(0, i * s * 0.5 - s * 0.4, s, i * s * 0.5);
      }
      ctx.stroke();
      break;
    case "wind":
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      for (let t = 0; t <= 1; t += 0.05) {
        const a = t * Math.PI * 3;
        const rad = s * t;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.stroke();
      break;
    case "earth":
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.stroke();
      break;
    case "light":
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        ctx.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3);
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      }
      ctx.stroke();
      break;
    default:
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawSign(ctx, cx, cy, ringR, instance, index) {
  const ax = cx + Math.cos(instance.angle) * ringR;
  const ay = cy + Math.sin(instance.angle) * ringR;
  const extent = ringR * 0.55 * instance.length;
  const dirSign = instance.inverted ? -1 : 1;
  ctx.strokeStyle = "#14120f";
  ctx.lineCap = "round";
  const seed = index * 7.3 + instance.angle * 3;

  switch (instance.archetypeId) {
    case "column": {
      const bx = ax + Math.cos(instance.angle) * extent * dirSign;
      const by = ay + Math.sin(instance.angle) * extent * dirSign;
      inkStroke(ctx, ax, ay, bx, by, seed, 3);
      const headAngle = Math.atan2(by - ay, bx - ax);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(headAngle - 0.4) * 8, by - Math.sin(headAngle - 0.4) * 8);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(headAngle + 0.4) * 8, by - Math.sin(headAngle + 0.4) * 8);
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "levitation": {
      const perp = instance.angle + Math.PI / 2;
      for (let i = -1; i <= 1; i += 2) {
        const bx = ax + Math.cos(instance.angle) * extent + Math.cos(perp) * i * 5;
        const by = ay + Math.sin(instance.angle) * extent + Math.sin(perp) * i * 5;
        inkStroke(ctx, ax + Math.cos(perp) * i * 5, ay + Math.sin(perp) * i * 5, bx, by, seed + i, 2);
      }
      break;
    }
    case "dispersion": {
      for (let i = -1; i <= 1; i++) {
        const a = instance.angle + i * 0.3;
        const bx = ax + Math.cos(a) * extent;
        const by = ay + Math.sin(a) * extent;
        inkStroke(ctx, ax, ay, bx, by, seed + i, 2);
      }
      break;
    }
    case "crushing": {
      const perp = instance.angle + Math.PI / 2;
      const bx1 = ax + Math.cos(perp) * extent * 0.4;
      const by1 = ay + Math.sin(perp) * extent * 0.4;
      const bx2 = ax - Math.cos(perp) * extent * 0.4;
      const by2 = ay - Math.sin(perp) * extent * 0.4;
      inkStroke(ctx, bx1, by1, bx2, by2, seed, 4);
      break;
    }
  }
}

function drawScene(ctx, size, state) {
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * 0.32;

  drawRing(ctx, cx, cy, ringR, state.ringComplete);
  if (state.sigilId) drawSigil(ctx, cx, cy, ringR * 0.28, state.sigilId);
  state.signs.forEach((instance, i) => drawSign(ctx, cx, cy, ringR, instance, i));
}

function castEffect(canvas, size, params, sigil, sceneState, duration = 900) {
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const count = 26;
  const style = sigil ? sigil.particle : { shape: "spark", jitter: 0.4, trail: 0.2 };
  const particles = Array.from({ length: count }, (_, i) => {
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
    ctx.strokeStyle = "#14120f";
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
