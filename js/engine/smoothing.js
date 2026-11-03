// One Euro Filter.
function lowPassAlpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

function make1D(minCutoff, beta, dCutoff) {
  let xPrev = null;
  let dxPrev = 0;
  let tPrev = null;
  return function filter(x, tMs) {
    if (tPrev === null) {
      xPrev = x;
      tPrev = tMs;
      return x;
    }
    const dt = Math.max((tMs - tPrev) / 1000, 1 / 240); // seconds, floored against a zero/negative delta
    const dx = (x - xPrev) / dt;
    const aD = lowPassAlpha(dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * dxPrev;
    const cutoff = minCutoff + beta * Math.abs(dxHat);
    const a = lowPassAlpha(cutoff, dt);
    const xHat = a * x + (1 - a) * xPrev;
    xPrev = xHat;
    dxPrev = dxHat;
    tPrev = tMs;
    return xHat;
  };
}

// beta is the parameter that actually matters here: how much estimated speed is allowed to
// widen the cutoff (and so cut smoothing) before it's trusted as real movement rather than
// jitter.
const STROKE_SMOOTH_RADIUS_PX = 3;

function createPulledStringFilter(radius) {
  let sx = null;
  let sy = null;
  return function pull(point) {
    if (sx === null) {
      sx = point.x;
      sy = point.y;
      return { x: sx, y: sy };
    }
    const dx = point.x - sx;
    const dy = point.y - sy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      const catchUp = (dist - radius) / dist;
      sx += dx * catchUp;
      sy += dy * catchUp;
    }
    return { x: sx, y: sy };
  };
}

function createStrokeSmoother() {
  const fx = make1D(1.0, 0.03, 1.0);
  const fy = make1D(1.0, 0.03, 1.0);
  const pull = createPulledStringFilter(STROKE_SMOOTH_RADIUS_PX);
  return function smooth(point, tMs) {
    const eased = { x: fx(point.x, tMs), y: fy(point.y, tMs) };
    return pull(eased);
  };
}
