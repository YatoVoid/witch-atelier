// Canvas rendering. Signs are drawn from the actual points the user's
// stroke recorded, smoothed with a quadratic-through-midpoints pass and a
// soft shadow for ink bleed.
//
// INK is sampled from the reference artwork's dominant color
// (assets/sigils/fire.webp, rgb(108,0,0)).
const INK = "#6c0000";
const INK_RGB = "108, 0, 0";

function strokePath(ctx, points, width) {
  if (points.length < 2) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.shadowColor = `rgba(${INK_RGB}, 0.35)`;
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
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.setLineDash(complete ? [] : [10, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Sigil glyphs are drawn images, loaded lazily and cached; the redraw
// callback fires once an image finishes loading so it appears immediately.
const imageCache = {};
let onImageLoaded = null;
function setImageLoadedCallback(fn) {
  onImageLoaded = fn;
}
function getImage(src) {
  if (imageCache[src]) return imageCache[src];
  const img = new Image();
  img.src = src;
  img.onload = () => onImageLoaded && onImageLoaded();
  imageCache[src] = img;
  return img;
}

function drawSigil(ctx, cx, cy, r, sigilId) {
  const sigil = getSigil(sigilId);
  if (!sigil) return;
  const img = getImage(sigil.image);
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  }
}

// instance.paths is an array of point lists (one per stroke), each
// rendered as its own ink stroke.
function drawSign(ctx, cx, cy, instance) {
  if (!instance.paths || instance.paths.length === 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  const width = 2 + instance.length * 2.5;
  instance.paths.forEach((path) => strokePath(ctx, path, width));

  const directionalIds = ["column", "crosshair", "enlarge", "pull", "direction", "collection", "bend"];
  if (directionalIds.includes(instance.archetypeId)) {
    const spine = instance.paths.reduce((a, b) => (b.length > a.length ? b : a));
    const tip = spine[spine.length - 1];
    const prev = spine[Math.max(0, spine.length - 2)];
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

  if (state.groupPaths && state.groupPaths.length > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.55;
    state.groupPaths.forEach((path) => strokePath(ctx, path, 3));
    ctx.restore();
  }
  if (state.livePath && state.livePath.length > 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.55;
    strokePath(ctx, state.livePath, 3);
    ctx.restore();
  }
}

function drawRingPulse(ctx, cx, cy, ringR, t) {
  const pulseT = Math.min(1, t / 0.35);
  if (pulseT >= 1) return;
  const ease = 1 - Math.pow(1 - pulseT, 2);
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = (1 - pulseT) * 0.5;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR * (1 + ease * 0.12), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSigilPulse(ctx, cx, cy, r, sigilId, t) {
  const pulseT = Math.min(1, t / 0.4);
  if (pulseT >= 1) return;
  const sigil = getSigil(sigilId);
  if (!sigil) return;
  const img = getImage(sigil.image);
  if (!(img.complete && img.naturalWidth > 0)) return;
  const ease = Math.sin(pulseT * Math.PI);
  const rr = r * (1 + ease * 0.25);
  ctx.save();
  ctx.globalAlpha = ease * 0.6;
  ctx.drawImage(img, cx - rr, cy - rr, rr * 2, rr * 2);
  ctx.restore();
}

// A fading comet trail behind a moving particle, drawn from its recent
// positions instead of just a dot at the current one.
function drawTrail(ctx, trail, baseAlpha, width) {
  if (trail.length < 2) return;
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const t = i / trail.length;
    ctx.globalAlpha = baseAlpha * t * 0.5;
    ctx.lineWidth = width * (0.3 + t * 0.5);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

// Each element gets a distinct, organic shape instead of a generic dot or
// rectangle, so a cast at least reads as an effect belonging to that
// element, not an abstract particle system.
function drawParticle(ctx, shape, x, y, angle, alpha, size, extra) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  switch (shape) {
    case "spark": {
      // A licking flame silhouette trailing behind the direction of travel.
      const back = angle + Math.PI;
      const len = size * 2.6 * (0.85 + (extra.flicker || 0) * 0.3);
      const perp = angle + Math.PI / 2;
      const tipX = x;
      const tipY = y;
      const baseX = x + Math.cos(back) * len;
      const baseY = y + Math.sin(back) * len;
      const midX = x + Math.cos(back) * len * 0.5 + Math.cos(perp) * size * 0.55;
      const midY = y + Math.sin(back) * len * 0.5 + Math.sin(perp) * size * 0.55;
      const midX2 = x + Math.cos(back) * len * 0.5 - Math.cos(perp) * size * 0.55;
      const midY2 = y + Math.sin(back) * len * 0.5 - Math.sin(perp) * size * 0.55;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo(midX, midY, baseX, baseY);
      ctx.quadraticCurveTo(midX2, midY2, tipX, tipY);
      ctx.fill();
      break;
    }
    case "droplet": {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.3);
      ctx.quadraticCurveTo(size * 0.9, size * 0.2, 0, size * 1.0);
      ctx.quadraticCurveTo(-size * 0.9, size * 0.2, 0, -size * 1.3);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "wisp": {
      // A small curling gust, like a comma, instead of a blurred dot.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((extra.spin || 0) + angle);
      ctx.shadowColor = `rgba(${INK_RGB}, 0.4)`;
      ctx.shadowBlur = size * 0.9;
      ctx.lineWidth = size * 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.1, 0.4, Math.PI * 1.5);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "shard": {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(extra.spin || angle);
      ctx.beginPath();
      ctx.moveTo(-size * 0.9, -size * 0.6);
      ctx.lineTo(size * 1.0, -size * 0.1);
      ctx.lineTo(size * 0.5, size * 0.8);
      ctx.lineTo(-size * 0.7, size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case "beam": {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.shadowColor = `rgba(${INK_RGB}, 0.45)`;
      ctx.shadowBlur = size * 1.4;
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillRect(-size * 2.2, -size * 0.5, size * 4.4, size);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha;
      ctx.fillRect(-size * 2.2, -1, size * 4.4, 2);
      ctx.restore();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function castEffect(canvas, size, params, sigil, sceneState, duration = 1000) {
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * RING_RATIO;
  const count = 26;
  const style = sigil ? sigil.particle : { shape: "spark" };
  const particleSize = 3 + Math.min(params.intensity, 2.5) * 1.4;
  const trailLength = 6;
  const particles = Array.from({ length: count }, () => {
    const spread = params.spreadRatio * Math.PI * 2 + 0.3;
    const baseAngle = params.hasDirection ? params.direction : Math.random() * Math.PI * 2;
    const angle = params.hasDirection
      ? baseAngle + (Math.random() - 0.5) * spread * 0.6
      : Math.random() * Math.PI * 2;
    const speed = (0.4 + Math.random() * 0.6) * (0.5 + params.intensity);
    const wobblePhase = Math.random() * Math.PI * 2;
    const spinDir = Math.random() < 0.5 ? -1 : 1;
    return { angle, speed, offset: Math.random() * 0.35, wobblePhase, spinDir, trail: [] };
  });

  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    drawScene(ctx, size, sceneState);
    drawRingPulse(ctx, cx, cy, ringR, t);
    if (sceneState.sigilId) drawSigilPulse(ctx, cx, cy, ringR * 0.28, sceneState.sigilId, t);

    particles.forEach((p) => {
      const pt = Math.max(0, t - p.offset) / (1 - p.offset);
      if (pt <= 0) return;
      const eased = 1 - Math.pow(1 - pt, 2);
      const gravity = style.shape === "droplet" ? pt * pt * size * 0.06 : 0;
      const dist = eased * size * 0.42 * p.speed;
      const wobble = style.shape === "wisp" ? Math.sin(pt * Math.PI * 3 + p.wobblePhase) * 6 : 0;
      const perp = p.angle + Math.PI / 2;
      const x = cx + Math.cos(p.angle) * dist + Math.cos(perp) * wobble;
      const y = cy + Math.sin(p.angle) * dist + Math.sin(perp) * wobble + gravity;

      p.trail.push({ x, y });
      if (p.trail.length > trailLength) p.trail.shift();

      const alpha = 1 - pt;
      ctx.strokeStyle = INK;
      drawTrail(ctx, p.trail, alpha, particleSize * 0.5);

      const extra = {
        flicker: Math.sin(now * 0.02 + p.wobblePhase) * 0.5 + 0.5,
        spin: p.spinDir * pt * Math.PI * 2.2,
      };
      drawParticle(ctx, style.shape, x, y, p.angle, alpha, particleSize, extra);
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (t < 1) requestAnimationFrame(frame);
    else drawScene(ctx, size, sceneState);
  }
  requestAnimationFrame(frame);
}
