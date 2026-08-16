// One Euro Filter (Casiez, Roussel & Vogel, 2012) -- smooths a live input
// stream adaptively based on how fast it's moving, rather than by a fixed
// amount: slow movement (finger tremor sitting nearly still) gets smoothed
// heavily, fast movement (a deliberate stroke, a sharp corner) gets
// smoothed barely at all. A fixed-window average can't do this -- it
// either leaves jitter in or rounds off real corners, since it can't tell
// the two apart. This can, because a real corner is a sudden direction
// change at speed, not just position noise.
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

// beta is the parameter that actually matters here: how much estimated
// speed is allowed to widen the cutoff (and so cut smoothing) before it's
// trusted as real movement rather than jitter. Tuned up from the paper's
// original mouse-cursor default (0.007) -- a fingertip's tremor is slower
// than a mouse's, but a deliberate stroke on a small ring covers real
// distance quickly, so a sharp corner needs to earn "this is real motion"
// sooner than cursor tracking does, or the corner itself gets rounded.
//
// One Euro alone wasn't cutting enough jitter: at natural drawing speed
// (not just holding still) its cutoff opens up in proportion to velocity,
// so tremor riding on top of a real stroke comes back through almost
// unfiltered -- tested by simulation, moderate-speed jitter barely
// changed across a wide sweep of minCutoff/beta. So there's a second
// stage below: a pixel-radius "pulled string" catch-up, the same
// technique Photoshop's brush smoothing slider is built on. The traced
// point doesn't move at all until the raw input strays more than
// STROKE_SMOOTH_RADIUS_PX away, then it gets pulled along just enough to
// stay exactly that far behind -- so anything smaller than the radius
// (tremor) is thrown out completely instead of merely damped, while a
// real stroke that keeps moving in one direction (a corner, a straight
// line) still gets traced accurately, just lagged by a few constant px.
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
