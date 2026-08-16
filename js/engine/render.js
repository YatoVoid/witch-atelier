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

// Drawn as an ellipse (ctx.ellipse with two radii, not ctx.arc scaled via
// ctx.scale) specifically so the stroke stays an even width all the way
// around -- scaling the context non-uniformly scales lineWidth with it,
// leaving a ring that's thick on the sides and thin top-to-bottom.
// Started out popping in already flattened into the portal ellipse, held
// for a fraction of a second, then vanished -- with the persistent (true
// circular) ring drawn underneath every frame regardless, that read as
// two different ring shapes swapping in and out, a glitch rather than a
// tilt. tiltT now drives the squash AND the fade together on the same
// 0->1->0 curve, so what's actually on screen is one ring smoothly
// leaning back into the ellipse and level again, not a shape substitution.
// The tilt itself is a real CSS 3D transform on the canvas element now
// (see .circle-frame.casting in style.css), applied to the whole
// rendered surface -- ring, sigil, drawn signs, and this pulse all tilt
// together for free because the browser is actually perspective-
// projecting the canvas's pixels, not because anything drawn here fakes
// an ellipse. This just needs to be a normal circle.
function drawRingPulse(ctx, cx, cy, ringR, t, colorRgb) {
  const pulseT = Math.min(1, t / 0.35);
  if (pulseT >= 1) return;
  const ease = 1 - Math.pow(1 - pulseT, 2);
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = (1 - pulseT) * 0.5;
  ctx.strokeStyle = `rgb(${colorRgb})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR * (1 + ease * 0.12), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSigilPulse(ctx, cx, cy, r, sigilId, t, colorRgb) {
  const pulseT = Math.min(1, t / 0.4);
  if (pulseT >= 1) return;
  const sigil = getSigil(sigilId);
  if (!sigil) return;
  const img = getImage(sigil.image);
  if (!(img.complete && img.naturalWidth > 0)) return;
  const ease = Math.sin(pulseT * Math.PI);
  const rr = r * (1 + ease * 0.25);
  ctx.save();
  // A soft elemental glow behind the sigil's own ink art, rather than
  // just scaling the ink image up -- the image itself stays the one
  // hand-drawn ink color (it's the caster's own glyph), the glow around
  // it is what actually reads as "this element is active."
  ctx.shadowColor = `rgba(${colorRgb}, 0.8)`;
  ctx.shadowBlur = rr * 0.5;
  ctx.globalAlpha = ease * 0.6;
  ctx.drawImage(img, cx - rr, cy - rr, rr * 2, rr * 2);
  ctx.restore();
}

// A bold streak from center out along the resolved direction, layered
// under the small particles, while they're still deciding among
// themselves which way to go. Individual particles already carry
// direction (their spread narrows toward params.direction), but that
// only reads clearly once several of them have traveled a visible
// distance; this makes "which way did this spell just go" obvious from
// the first frame, for any cast that actually resolved a direction.
function drawDirectionalSurge(ctx, cx, cy, size, angle, colorRgb, t) {
  const surgeT = Math.min(1, t / 0.5);
  if (surgeT >= 1) return;
  const ease = 1 - Math.pow(1 - surgeT, 3);
  const len = size * 0.55 * ease;
  const fade = 1 - surgeT;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, `rgba(${colorRgb}, ${0.5 * fade})`);
  grad.addColorStop(1, `rgba(${colorRgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.shadowColor = `rgba(${colorRgb}, 0.6)`;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, -3 * fade);
  ctx.lineTo(len, -1);
  ctx.lineTo(len, 1);
  ctx.lineTo(0, 3 * fade);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// A fading comet trail behind a moving particle, drawn from its recent
// positions instead of just a dot at the current one.
function drawTrail(ctx, trail, baseAlpha, width, colorRgb) {
  if (trail.length < 2) return;
  ctx.strokeStyle = `rgb(${colorRgb})`;
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
// element, not an abstract particle system. colorRgb tints every shape
// with its element's color (see js/data/sigils.js); extra.lifeT (0 at
// birth, 1 at death) drives each shape's own end-of-life flourish -- a
// glint, a splash, a twinkle -- instead of every particle just fading
// out identically regardless of what it's supposed to be.
function drawParticle(ctx, shape, x, y, angle, alpha, size, extra, colorRgb) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgb(${colorRgb})`;
  ctx.strokeStyle = `rgb(${colorRgb})`;
  switch (shape) {
    case "spark": {
      // A licking flame silhouette trailing behind the direction of
      // travel, biased to also drift upward (negative y) the way real
      // flame buoyancy does, blended with wherever the cast is actually
      // headed rather than replacing it.
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
      // A hotter, brighter core near the tip -- flame doesn't burn one
      // flat color from base to tip.
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = `rgba(${colorRgb}, 0.9)`;
      ctx.beginPath();
      ctx.arc(tipX, tipY, size * 0.4, 0, Math.PI * 2);
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
      // A brief outward-ringing splash right at the end of the drop's
      // life, instead of it simply blinking out.
      if (extra.lifeT > 0.82) {
        const splashT = (extra.lifeT - 0.82) / 0.18;
        ctx.globalAlpha = alpha * (1 - splashT) * 0.6;
        ctx.strokeStyle = `rgb(${colorRgb})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, size * (0.6 + splashT * 1.6), 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "wisp": {
      // A small curling gust, like a comma, instead of a blurred dot.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((extra.spin || 0) + angle);
      ctx.shadowColor = `rgba(${colorRgb}, 0.4)`;
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
      // A brief bright glint sweeping across the facet as it tumbles --
      // real cut stone/crystal catches light unevenly, not as one flat
      // silhouette the whole time it's moving.
      const glint = Math.pow(Math.max(0, Math.sin((extra.spin || 0) * 2)), 6);
      if (glint > 0.15) {
        ctx.globalAlpha = alpha * glint;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.moveTo(-size * 0.2, -size * 0.3);
        ctx.lineTo(size * 0.5, -size * 0.05);
        ctx.lineTo(size * 0.1, size * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "beam": {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.shadowColor = `rgba(${colorRgb}, 0.45)`;
      ctx.shadowBlur = size * 1.4;
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillRect(-size * 2.2, -size * 0.5, size * 4.4, size);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha;
      ctx.fillRect(-size * 2.2, -1, size * 4.4, 2);
      ctx.restore();
      // A stray twinkle point beside the beam, on roughly a third of
      // particles each frame -- light scatters, it doesn't travel as one
      // clean unbroken line.
      if (extra.twinkle) {
        ctx.globalAlpha = alpha * extra.twinkle;
        ctx.fillStyle = "rgba(255, 250, 230, 0.9)";
        ctx.beginPath();
        ctx.arc(x + extra.twinkleOffsetX, y + extra.twinkleOffsetY, size * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
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

// preset (see js/data/castpresets.js -- castPresetFor(result.match)) swaps
// out the MOTION for the handful of named spells whose documented effect
// doesn't look like a generic direction-aware radial burst: a beam that
// only goes one way, a vortex that pulls inward, particles that orbit or
// hover instead of launching. Everything else -- most casts, since most
// sign combinations aren't a recognized named spell -- gets "burst", the
// original direction/spread-aware behavior, unchanged.
//
// Everything drawn in here is plain, flat, untilted canvas geometry --
// the "tilted plate" look is a genuine CSS 3D transform on the canvas
// element itself now (.circle-frame.casting in style.css, toggled by
// app.js around this call), not anything faked here. That's deliberate:
// an earlier version hand-projected just the ring pulse and particles
// onto a fake ellipse, which left the ring/sigil/drawn signs (drawn
// flat by drawScene, same as always) looking untilted right next to
// them -- two different depths in the same frame. Letting the browser's
// real perspective transform tilt the whole rendered canvas, ink and
// particles together, doesn't have that seam, and doesn't require
// hand-rolling a projection for every shape drawScene() can draw.
function castEffect(canvas, size, params, sigil, sceneState, duration = 1000, preset = null, onComplete = null) {
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * RING_RATIO;
  const mode = preset?.mode || "burst";
  const intensity = params.intensity * (preset?.intensityBoost || 1);
  const focusRatio = params.focusRatio || 0;
  const stabilityRatio = Math.min(1, params.stabilityRatio || 0);
  const burstRatio = Math.min(1.5, params.burstRatio || 0);

  // A handful of signs get their own distinct form or motion on top of
  // the shared burst math below, instead of only ever showing up as a
  // number that scales count/speed/spread. params.signWeights (see
  // compose.js) is how much of the total drawn length any one archetype
  // was, 0..1, regardless of family -- picked out here by hand, one at a
  // time, for the signs whose own description (see js/data/signs.js)
  // points at something visually distinct rather than "changes strength
  // only": Bird flies, Rain falls, Billowing puffs out soft and slow,
  // Weave stretches into a long flexible ribbon, Crosshair locks onto a
  // single precise line, Diamond facets the burst into a crystalline
  // pattern instead of a random scatter, Repetition echoes/renews
  // instead of firing once, Collection gathers scattered material in
  // toward the seal instead of launching outward. Not every sign needs
  // this -- most of the 24 are already well served by the shared
  // spread/focus/sustain/burst system above, this is only for the ones
  // a shared number can't really capture.
  const sw = params.signWeights || {};
  const birdW = sw.bird || 0;
  const rainW = sw.rain || 0;
  const billowingW = sw.billowing || 0;
  const weaveW = sw.weave || 0;
  const crosshairW = sw.crosshair || 0;
  const diamondW = sw.diamond || 0;
  const repetitionW = sw.repetition || 0;
  const collectionW = sw.collection || 0;

  // "Amount": Dispersion/Radial/Rain make the burst wider AND busier
  // (more particles to actually fill the wider arc), Convergence/Window
  // thin it back down toward a single tight jet, raw intensity (Crush,
  // Enlarge, Bolt...) throws more material at the seal regardless of
  // shape. Named-spell presets keep their own fixed count -- their motion
  // is scripted, not sign-driven -- but still breathe a little with
  // intensity so a stronger cast still reads as stronger.
  const baseCount = mode === "beam" ? 16 : 26;
  const signDrivenCount = mode === "burst" ? params.spreadRatio * 16 - focusRatio * 10 : 0;
  const count = Math.round(Math.max(8, Math.min(46, baseCount + signDrivenCount + intensity * 4)));

  const style = sigil ? sigil.particle : { shape: "spark" };
  const colorRgb = sigil ? sigil.color : INK_RGB;
  // Billowing: "expands material into a soft, lasting volume" -- bigger,
  // softer-reading particles instead of the usual sharp scatter.
  const particleSize = (3 + Math.min(intensity, 2.5) * 1.4) * (1 + billowingW * 0.55);
  // Weave: "stretches material long and flexible" -- a much longer
  // trail reads as a ribbon instead of a comet's short streak.
  const trailLength = Math.round(6 + weaveW * 12);

  // "Speed"/timing: Levitation/Float/Bird/Dancing Puppet (sustainRatio)
  // hold a cast on screen longer, a slow steady release; Bolt (burstRatio)
  // does the opposite, a short sharp snap that's mostly over before it's
  // begun. Both fight over the same duration, sustain wins on a tie since
  // it's the more common of the two in practice.
  const durationScale = Math.max(0.55, Math.min(1.9, 1 + params.sustainRatio * 0.55 - burstRatio * 0.3));
  const effectiveDuration = duration * durationScale;

  // Diamond/Repetition/Eye/Vision (stabilityRatio) damp down the random
  // per-particle variance -- a stabilized cast throws material in a
  // steadier, more uniform stream instead of a scattershot one.
  const wildness = 1 - stabilityRatio * 0.65;
  // Bolt sharpens the deceleration curve -- particles are already near
  // top speed at launch and dump it fast, instead of accelerating out
  // smoothly across the whole animation.
  // Billowing softens the deceleration curve too -- material puffing
  // outward slows into place gradually instead of snapping to a stop.
  const easePower = Math.max(1.15, 2 + burstRatio * 2.5 - billowingW * 1.1);

  const particles = Array.from({ length: count }, () => {
    let angle;
    if (mode === "beam") {
      // Narrow upward cone, ignoring drawn direction/spread -- Light
      // Beam's own wiki entry is a single steady beam, not whichever way
      // the four Columns that trigger it happen to average out to.
      angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.35;
    } else if (mode === "vortex" || mode === "orbit" || mode === "hover") {
      angle = Math.random() * Math.PI * 2;
    } else {
      // A directional cast that only barely resolved a direction (two
      // Columns nearly, but not quite, canceling) sprays wider than one
      // where every directional sign agreed -- params.magnitude is how
      // much of the drawn force actually survived cancellation.
      const disagreement = params.hasDirection ? (1 - params.magnitude) * 0.9 : 0;
      let spread = Math.max(0.15, params.spreadRatio * Math.PI * 2 + 0.3 + disagreement - focusRatio * 0.9);
      // Crosshair: "aims the effect at whatever it points toward" -- a
      // locked-on single line instead of a spray, the cone narrows
      // toward zero as more of the drawing was Crosshair specifically.
      spread *= 1 - crosshairW * 0.85;
      const baseAngle = params.hasDirection ? params.direction : Math.random() * Math.PI * 2;
      angle = params.hasDirection ? baseAngle + (Math.random() - 0.5) * spread * 0.6 : Math.random() * Math.PI * 2;
      // Rain: "scatters the effect down over an area" -- bends the spray
      // toward straight down (positive y) instead of wherever the drawn
      // direction happened to point, blended rather than replaced so a
      // Rain sign paired with a real direction still leans that way.
      if (rainW > 0.1) angle = angle * (1 - rainW * 0.6) + (Math.PI / 2) * (rainW * 0.6);
      // Diamond: "marks the boundary of the effect" -- snaps the spawn
      // angle toward the nearest of 6 facets instead of a free scatter,
      // reading as a faceted, crystalline burst rather than a spray.
      if (diamondW > 0.12) {
        const facetStep = (Math.PI * 2) / 6;
        const facet = Math.round(angle / facetStep) * facetStep;
        angle = angle * (1 - diamondW) + facet * diamondW;
      }
    }
    // Crosshair also travels faster than a generic push -- a shot, not a
    // spray, gets there quicker.
    const speed = (0.65 + Math.random() * 0.75 * wildness) * (0.5 + intensity) * (1 + burstRatio * 0.4) * (1 + crosshairW * 0.5);
    const wobblePhase = Math.random() * Math.PI * 2;
    const spinDir = Math.random() < 0.5 ? -1 : 1;
    // Collection: "gathers material from around the seal inward" -- a
    // scattered starting point on the ring, independent of whatever
    // angle the burst logic above picked, used to pull particles in
    // FROM there rather than launching them from center. Picked once
    // here, at creation, not per-frame, or it would jitter to a new
    // scatter point every frame instead of tracing one gathering path.
    const gatherAngle = Math.random() * Math.PI * 2;
    return { angle, speed, offset: Math.random() * 0.35 * wildness, wobblePhase, spinDir, gatherAngle, trail: [] };
  });

  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / effectiveDuration);
    drawScene(ctx, size, sceneState);
    // Repetition: "restores what it touches, as if new" -- one ring
    // pulse read as a single activation regardless of how many times it
    // fires, so this repeats it, up to 3 separate echoes staggered
    // across the cast instead of one, each one its own small renewal
    // rather than a continuous fade. Reuses drawRingPulse as-is, just
    // called again on a delayed clock -- an echo whose own delayed t
    // hasn't reached 0 yet simply doesn't draw anything (see its own
    // pulseT >= 1 guard), so this is safe to call unconditionally.
    const echoCount = repetitionW > 0.15 ? 1 + Math.round(repetitionW * 2) : 1;
    const echoGap = 0.22;
    for (let echo = 0; echo < echoCount; echo++) {
      const echoT = t - echo * echoGap;
      if (echoT >= 0) drawRingPulse(ctx, cx, cy, ringR, echoT, colorRgb);
    }
    if (sceneState.sigilId) drawSigilPulse(ctx, cx, cy, ringR * 0.28, sceneState.sigilId, t, colorRgb);
    if (mode === "burst" && params.hasDirection) drawDirectionalSurge(ctx, cx, cy, size, params.direction, colorRgb, t);

    particles.forEach((p) => {
      const pt = Math.max(0, t - p.offset) / (1 - p.offset);
      if (pt <= 0) return;
      const eased = 1 - Math.pow(1 - pt, easePower);
      let x, y;

      if (mode === "vortex") {
        // Spirals INTO center instead of radiating out -- particles
        // start near the ring edge and wind inward as they age, for a
        // spell whose whole point is pulling things toward the seal.
        const r = ringR * (1 - eased) * (0.6 + p.speed * 0.5);
        const spin = p.angle + pt * Math.PI * 3.2 * p.spinDir;
        x = cx + Math.cos(spin) * r;
        y = cy + Math.sin(spin) * r;
      } else if (mode === "orbit") {
        // Circles at roughly the ring's own radius rather than
        // traveling outward -- held around the seal, not launched.
        const r = ringR * (0.75 + Math.sin(pt * Math.PI) * 0.15);
        const spin = p.angle + pt * Math.PI * 1.8 * p.spinDir;
        x = cx + Math.cos(spin) * r;
        y = cy + Math.sin(spin) * r;
      } else if (mode === "hover") {
        // Drifts a short distance and bobs, staying close to the seal
        // instead of launching -- lifted and held, not projected.
        const r = size * 0.14 * eased * p.speed;
        const bob = Math.sin(pt * Math.PI * 2.4 + p.wobblePhase) * size * 0.03 * wildness;
        x = cx + Math.cos(p.angle) * r;
        y = cy + Math.sin(p.angle) * r - bob - pt * size * 0.05;
      } else {
        // Rain adds its own downward pull on top of a droplet's usual
        // one, and applies regardless of which element/shape is casting
        // it -- a fire spark falling like rain still falls.
        const gravity = (style.shape === "droplet" ? pt * pt * size * 0.06 : 0) + pt * pt * size * 0.05 * rainW;
        // Flame's own buoyancy: a gentle upward bias blended on top of
        // wherever the cast is actually headed, not a replacement for it.
        const buoyancy = style.shape === "spark" ? -pt * size * 0.05 : 0;
        // Was capped at 0.42 -- at a typical (not extreme) intensity that
        // never even reached the ring edge, every burst stayed clustered
        // near the seal instead of launching. Raised enough that a
        // decent cast now visibly clears the ring, with a strong one
        // flying well past it off the edge of the plate.
        let dist = eased * size * 0.78 * p.speed;
        // Convergence (focusRatio): the spray narrows back down as it
        // travels instead of continuing to fan out, like it's being
        // gathered rather than just released.
        if (focusRatio > 0.1) dist *= 1 - Math.min(0.5, focusRatio * 0.4) * pt;
        // Weave adds its own slow, wide side-to-side braid on top of a
        // wisp's usual tighter wobble -- material crossing back and
        // forth over its own path instead of traveling straight.
        const wobble =
          (style.shape === "wisp" ? Math.sin(pt * Math.PI * 3 + p.wobblePhase) * 6 * wildness : 0) +
          (weaveW > 0.1 ? Math.sin(pt * Math.PI * 2 + p.wobblePhase) * size * 0.05 * weaveW : 0);
        const perp = p.angle + Math.PI / 2;
        x = cx + Math.cos(p.angle) * dist + Math.cos(perp) * wobble;
        y = cy + Math.sin(p.angle) * dist + Math.sin(perp) * wobble + gravity + buoyancy;
        // Bird: "animates flight" -- a genuine rise-then-glide arc (an
        // actual lift, independent of whatever direction the particle
        // is otherwise headed, not just a sideways wobble along its
        // path) plus a banking curve on top, so this reads as a swooping
        // flight silhouette rather than a wobblier version of the plain
        // burst. spinDir picks which way each particle banks so a spray
        // of them doesn't all swoop identically.
        if (birdW > 0.1) {
          const lift = Math.sin(pt * Math.PI) * size * 0.18 * birdW;
          y -= lift;
          const bank = Math.sin(pt * Math.PI * 1.5 + p.wobblePhase) * size * 0.09 * birdW * p.spinDir;
          x += Math.cos(perp) * bank;
          y += Math.sin(perp) * bank;
        }
        // Collection: "gathers material from around the seal inward" --
        // blends the particle's position toward a point on the ring
        // (gatherAngle, picked once at creation) that shrinks toward
        // center as the cast plays, instead of the plain burst's launch
        // from center outward. At collectionW near 1 this replaces the
        // burst motion almost entirely; blended for a cast that mixes
        // Collection with other directional signs.
        if (collectionW > 0.1) {
          const gatherR = ringR * (1 - eased);
          const gx = cx + Math.cos(p.gatherAngle) * gatherR;
          const gy = cy + Math.sin(p.gatherAngle) * gatherR;
          x = x * (1 - collectionW) + gx * collectionW;
          y = y * (1 - collectionW) + gy * collectionW;
        }
        // Convergence on a directional cast also pulls stray particles
        // back toward the center line as they age, not just shortening
        // their reach -- a focused jet, not just a smaller scattershot.
        if (focusRatio > 0.15 && params.hasDirection) {
          const pull = Math.min(0.6, focusRatio * 0.5) * eased;
          const lineX = cx + Math.cos(params.direction) * dist;
          const lineY = cy + Math.sin(params.direction) * dist;
          x = x * (1 - pull) + lineX * pull;
          y = y * (1 - pull) + lineY * pull;
        }
      }

      p.trail.push({ x, y });
      if (p.trail.length > trailLength) p.trail.shift();

      const alpha = 1 - pt;
      drawTrail(ctx, p.trail, alpha, particleSize * 0.5, colorRgb);

      const extra = {
        flicker: Math.sin(now * 0.02 + p.wobblePhase) * 0.5 + 0.5,
        spin: p.spinDir * pt * Math.PI * 2.2,
        lifeT: pt,
        twinkle: style.shape === "beam" && Math.sin(now * 0.006 + p.wobblePhase * 3) > 0.6 ? 0.7 : 0,
        twinkleOffsetX: Math.cos(p.wobblePhase) * particleSize * 1.8,
        twinkleOffsetY: Math.sin(p.wobblePhase) * particleSize * 1.8,
      };
      drawParticle(ctx, style.shape, x, y, p.angle, alpha, particleSize, extra, colorRgb);
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (t < 1) requestAnimationFrame(frame);
    else {
      drawScene(ctx, size, sceneState);
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(frame);
}
