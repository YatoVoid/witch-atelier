// Baseline shape templates for the point-cloud recognizer in classify.js
// ($1 Unistroke Recognizer, Wobbrock, Wilson & Li, 2007): a drawn stroke
// is normalized for position, scale, and rotation, then matched against
// whichever of these it ends up closest to. A handful of representative
// examples per family covers any size or orientation.
//
// Multi-stroke examples (a line with a separate crossbar; a crosshair's
// four arms) are stored as one point list, strokes concatenated in
// drawing order; the "jump" between a stroke's end and the next one's
// start is just more path for the normalizer to work with.
//
// "straight", "bend", "bolt", and "wavy" also carry templates traced
// directly off assets/signs/*.webp.
//
// Add templates here to fix a shape that's still misread; personal
// corrections from the in-app training flow are saved to localStorage
// instead, layered on top of this set.
const SHAPE_TEMPLATES = {
  straight: [
    [
      { x: 0, y: 0 }, { x: 11.7, y: 0 }, { x: 23.3, y: 0 }, { x: 35, y: 0 }, { x: 46.7, y: 0 },
      { x: 58.3, y: 0 }, { x: 70, y: 0 }, { x: 81.7, y: 0 }, { x: 93.3, y: 0 }, { x: 105, y: 0 },
      { x: 116.7, y: 0 }, { x: 128.3, y: 0 }, { x: 140, y: 0 },
    ],
    [
      { x: 0, y: -35 }, { x: 0, y: -29.3 }, { x: 0, y: -23.6 }, { x: 0, y: -17.9 }, { x: 0, y: -12.2 },
      { x: 0, y: -6.5 }, { x: 0, y: -0.8 }, { x: 0, y: 4.9 }, { x: 0, y: 10.6 }, { x: 0, y: 16.3 },
      { x: 0, y: 22 }, { x: -0.9, y: 21.3 }, { x: -1.8, y: 20.6 }, { x: -2.7, y: 19.9 }, { x: -3.6, y: 19.2 },
      { x: -4.5, y: 18.5 }, { x: -5.4, y: 17.8 }, { x: -6.3, y: 17.1 }, { x: -7.2, y: 16.4 }, { x: -8.1, y: 15.7 },
      { x: -9, y: 15 }, { x: -8.1, y: 15.7 }, { x: -7.2, y: 16.4 }, { x: -6.3, y: 17.1 }, { x: -5.4, y: 17.8 },
      { x: -4.5, y: 18.5 }, { x: -3.6, y: 19.2 }, { x: -2.7, y: 19.9 }, { x: -1.8, y: 20.6 }, { x: -0.9, y: 21.3 },
      { x: 0, y: 22 }, { x: 0.9, y: 21.3 }, { x: 1.8, y: 20.6 }, { x: 2.7, y: 19.9 }, { x: 3.6, y: 19.2 },
      { x: 4.5, y: 18.5 }, { x: 5.4, y: 17.8 }, { x: 6.3, y: 17.1 }, { x: 7.2, y: 16.4 }, { x: 8.1, y: 15.7 },
      { x: 9, y: 15 }, { x: -19, y: 27 }, { x: -15.2, y: 27 }, { x: -11.4, y: 27 }, { x: -7.6, y: 27 },
      { x: -3.8, y: 27 }, { x: 0, y: 27 }, { x: 3.8, y: 27 }, { x: 7.6, y: 27 }, { x: 11.4, y: 27 },
      { x: 15.2, y: 27 }, { x: 19, y: 27 },
    ],
    [
      { x: 0, y: 0 }, { x: 0, y: -4.5 }, { x: 0, y: -9 }, { x: 0, y: -13.5 }, { x: 0, y: -18 },
      { x: 0, y: -22.5 }, { x: 0, y: -27 }, { x: 0, y: -31.5 }, { x: 0, y: -36 }, { x: 0, y: -40.5 },
      { x: 0, y: -45 }, { x: 0, y: 0 }, { x: 0, y: 3.5 }, { x: 0, y: 7 }, { x: 0, y: 10.5 },
      { x: 0, y: 14 }, { x: 0, y: 17.5 }, { x: 0, y: 21 }, { x: 0, y: 24.5 }, { x: 0, y: 28 },
      { x: 0, y: 31.5 }, { x: 0, y: 35 }, { x: 0, y: 0 }, { x: -2.9, y: 0 }, { x: -5.8, y: 0 },
      { x: -8.7, y: 0 }, { x: -11.6, y: 0 }, { x: -14.5, y: 0 }, { x: -17.4, y: 0 }, { x: -20.3, y: 0 },
      { x: -23.2, y: 0 }, { x: -26.1, y: 0 }, { x: -29, y: 0 }, { x: 0, y: 0 }, { x: 3.1, y: 0 },
      { x: 6.2, y: 0 }, { x: 9.3, y: 0 }, { x: 12.4, y: 0 }, { x: 15.5, y: 0 }, { x: 18.6, y: 0 },
      { x: 21.7, y: 0 }, { x: 24.8, y: 0 }, { x: 27.9, y: 0 }, { x: 31, y: 0 },
    ],
    // Column's own reference glyph: a vertical spine into a horizontal
    // crossbar (a "T" on its head), traced off assets/signs/column.webp.
    [
      { x: 35, y: 22 }, { x: 34, y: 46 }, { x: 23, y: 47 }, { x: 46, y: 47 },
    ],
    // Pull's own reference glyph: spine, a small triangle, a connector,
    // then the downward arrowhead, traced off assets/signs/pull.webp.
    [
      { x: 34, y: 12 }, { x: 34, y: 33 },
      { x: 33, y: 34 }, { x: 27, y: 35 }, { x: 28, y: 39 }, { x: 33, y: 44 },
      { x: 39, y: 41 }, { x: 42, y: 35 }, { x: 35, y: 34 },
      { x: 34, y: 35 }, { x: 34, y: 43 },
      { x: 34, y: 45 }, { x: 34, y: 53 },
      { x: 33, y: 54 }, { x: 31, y: 54 }, { x: 20, y: 43 },
      { x: 37, y: 54 }, { x: 48, y: 43 },
    ],
  ],
  bend: [
    // Clean symmetric corner, kept alongside the real glyph templates
    // below: a traced glyph's small asymmetry scores a clean hand-drawn
    // corner worse than a template built to be exactly that.
    [
      { x: -35, y: 35 }, { x: -32.1, y: 29.2 }, { x: -29.2, y: 23.3 }, { x: -26.2, y: 17.5 }, { x: -23.3, y: 11.7 },
      { x: -20.4, y: 5.8 }, { x: -17.5, y: 0 }, { x: -14.6, y: -5.8 }, { x: -11.7, y: -11.7 }, { x: -8.7, y: -17.5 },
      { x: -5.8, y: -23.3 }, { x: -2.9, y: -29.2 }, { x: 0, y: -35 }, { x: 2.9, y: -29.2 }, { x: 5.8, y: -23.3 },
      { x: 8.8, y: -17.5 }, { x: 11.7, y: -11.7 }, { x: 14.6, y: -5.8 }, { x: 17.5, y: 0 }, { x: 20.4, y: 5.8 },
      { x: 23.3, y: 11.7 }, { x: 26.3, y: 17.5 }, { x: 29.2, y: 23.3 }, { x: 32.1, y: 29.2 }, { x: 35, y: 35 },
    ],
    // Bend's own glyph: a smooth J-curve, traced off bend.webp.
    [
      { x: 23, y: 46 }, { x: 31, y: 55 }, { x: 34, y: 54 }, { x: 34, y: 15 }, { x: 37, y: 14 }, { x: 46, y: 23 },
    ],
    // Direction's own glyph: a single sharp peak, traced off direction.webp.
    [
      { x: 49, y: 42 }, { x: 35, y: 24 }, { x: 29, y: 29 }, { x: 20, y: 42 },
    ],
    // A real hand rarely draws a peak's two arms the same length or with
    // the apex dead-centered; matchShapeTemplate mirrors the candidate
    // internally, so only one chirality of an asymmetric peak needs to be
    // here to cover both.
    [
      { x: -40, y: 36 }, { x: -16, y: 12 }, { x: 0, y: -40 }, { x: 11.2, y: -8.4 }, { x: 28, y: 23.8 },
    ],
    // Same idea at a much more extreme arm-length ratio (roughly 2:1) and
    // with rounded, curved arms rather than straight segments -- a real
    // hand rarely draws a peak's corner razor-sharp either.
    [
      { x: -100, y: 60 }, { x: -84.8, y: 32.1 }, { x: -71.2, y: 7.2 }, { x: -59.2, y: -14.8 }, { x: -48.8, y: -33.9 },
      { x: -40, y: -50 }, { x: -35.7, y: -44.1 }, { x: -29, y: -34.9 }, { x: -21.3, y: -24.3 }, { x: -12.5, y: -12.2 },
      { x: -2.6, y: 1.4 },
    ],
  ],
  bolt: [
    // Clean multi-turn zigzag, kept alongside the real glyph below for
    // the same reason as "bend" above.
    [
      { x: -45, y: -25 }, { x: -27, y: 25 }, { x: -9, y: -25 }, { x: 9, y: 25 }, { x: 27, y: -25 }, { x: 45, y: 25 },
    ],
    // Bolt's own glyph: a spine with a small diamond mid-spine, traced
    // off bolt.webp.
    [
      { x: 34, y: 7 }, { x: 34, y: 28 },
      { x: 35, y: 29 }, { x: 39, y: 31 }, { x: 41, y: 34 }, { x: 39, y: 38 },
      { x: 33, y: 41 }, { x: 30, y: 39 }, { x: 28, y: 35 }, { x: 30, y: 31 }, { x: 33, y: 30 },
      { x: 34, y: 31 }, { x: 34, y: 40 },
      { x: 34, y: 42 }, { x: 34, y: 62 },
    ],
  ],
  wavy: [
    [
      { x: 0, y: -20 }, { x: 2.3, y: -15.3 }, { x: 4.7, y: -11 }, { x: 7, y: -7.3 }, { x: 9.3, y: -4.4 },
      { x: 11.7, y: -2.6 }, { x: 14, y: -2 }, { x: 16.3, y: -2.6 }, { x: 18.7, y: -4.4 }, { x: 21, y: -7.3 },
      { x: 23.3, y: -11 }, { x: 25.7, y: -15.3 }, { x: 28, y: -20 }, { x: 30.3, y: -24.7 }, { x: 32.7, y: -29 },
      { x: 35, y: -32.7 }, { x: 37.3, y: -35.6 }, { x: 39.7, y: -37.4 }, { x: 42, y: -38 }, { x: 44.3, y: -37.4 },
      { x: 46.7, y: -35.6 }, { x: 49, y: -32.7 }, { x: 51.3, y: -29 }, { x: 53.7, y: -24.7 }, { x: 56, y: -20 },
      { x: 58.3, y: -15.3 }, { x: 60.7, y: -11 }, { x: 63, y: -7.3 }, { x: 65.3, y: -4.4 }, { x: 67.7, y: -2.6 },
      { x: 70, y: -2 },
    ],
    // Float's own glyph: an S-curve ribbon, traced off float.webp.
    [
      { x: 40, y: 16 }, { x: 35, y: 23 }, { x: 35, y: 30 }, { x: 44, y: 39 }, { x: 44, y: 45 }, { x: 39, y: 53 },
      { x: 30, y: 16 }, { x: 25, y: 23 }, { x: 25, y: 30 }, { x: 34, y: 39 }, { x: 34, y: 45 }, { x: 29, y: 53 },
    ],
    // The two templates above have amplitude roughly half their travel
    // distance. A hand-drawn wave crossing open space is usually flatter
    // (amplitude a fifth or less of the distance covered), and normalized
    // to a unit bounding box that sits closer to "straight" than either
    // template above -- these three cover that lower amplitude range.
    [
      { x: 0, y: 0 }, { x: 5, y: 10.6 }, { x: 10, y: 15 }, { x: 15, y: 10.6 }, { x: 20, y: 0 }, { x: 25, y: -10.6 },
      { x: 30, y: -15 }, { x: 35, y: -10.6 }, { x: 40, y: 0 }, { x: 45, y: 10.6 }, { x: 50, y: 15 }, { x: 55, y: 10.6 },
      { x: 60, y: 0 }, { x: 65, y: -10.6 }, { x: 70, y: -15 }, { x: 75, y: -10.6 }, { x: 80, y: 0 }, { x: 85, y: 10.6 },
      { x: 90, y: 15 }, { x: 95, y: 10.6 }, { x: 100, y: 0 },
    ],
    [
      { x: 0, y: 0 }, { x: 6, y: 6.4 }, { x: 12, y: 11.3 }, { x: 18, y: 13.8 }, { x: 24, y: 13.3 }, { x: 30, y: 9.9 },
      { x: 36, y: 4.3 }, { x: 42, y: -2.2 }, { x: 48, y: -8.2 }, { x: 54, y: -12.5 }, { x: 60, y: -14 }, { x: 66, y: -12.5 },
      { x: 72, y: -8.2 }, { x: 78, y: -2.2 }, { x: 84, y: 4.3 }, { x: 90, y: 9.9 }, { x: 96, y: 13.3 }, { x: 102, y: 13.8 },
      { x: 108, y: 11.3 }, { x: 114, y: 6.4 }, { x: 120, y: 0 },
    ],
    // Same low amplitude, but as straight waypoint-to-waypoint segments
    // rather than a smooth curve: a mouse or a finger doesn't draw a
    // perfect sine, and the point-cloud distance to a smooth curve
    // template is worse than it needs to be for an otherwise clearly
    // wave-shaped gesture.
    [
      { x: 0, y: 0 }, { x: 25, y: -10 }, { x: 50, y: 10 }, { x: 75, y: -10 }, { x: 100, y: 10 }, { x: 125, y: -10 },
    ],
    // A coarse zigzag with only 2 turns: net displacement along the
    // travel axis still outweighs the oscillation across it, so without a
    // template shaped like this the point cloud matches closer to
    // "straight" than to any wave template, no matter how much amplitude
    // those other templates carry. matchShapeTemplate mirrors the
    // candidate internally, so only one chirality needs to be here.
    [
      { x: 0, y: 0 }, { x: 20, y: 30 }, { x: 0, y: 60 }, { x: 20, y: 90 }, { x: 0, y: 120 },
    ],
  ],
};
