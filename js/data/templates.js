// Baseline shape templates for the point-cloud recognizer in classify.js,
// modeled on the $1 Unistroke Recognizer (Wobbrock, Wilson & Li, 2007): a
// drawn stroke is normalized for position, scale, and rotation and then
// matched against whichever of these it ends up closest to. Because
// rotation/scale/position are normalized away, one template only needs a
// handful of representative examples per family, not one for every size
// or orientation a person might draw it at.
//
// "straight" includes two real hand-drawn examples (a line with an
// arrowhead and a separate crossbar; a crosshair drawn as four separate
// arm strokes) traced from an actual screenshot where the older
// corner-counting classifier misread both, since a decorated or
// multi-stroke real gesture doesn't look like the clean textbook shape a
// synthetic test would generate. Multi-stroke examples are stored as a
// single point list (strokes concatenated in drawing order); the
// resulting "jump" between a stroke's end and the next one's start is
// just more path for the normalizer to work with, not a special case.
//
// "straight", "bend", "bolt", and "wavy" each also carry at least one
// template traced directly off the actual reference glyph art in
// assets/signs/*.webp (auto-extracted: the art was thinned to a
// skeleton and the resulting point path spot-checked by eye against the
// source image before being pasted in here). Earlier templates for
// "bend" and "bolt" were built from a verbal idea of each shape (a
// bend is "a corner", a bolt is "a zigzag") rather than from the art
// itself, and didn't actually match it: the real Bend glyph is a smooth
// J-curve, not the sharp symmetric V the old template used, and the
// real Bolt glyph has a small diamond sitting in the middle of its
// spine that a plain zigzag template had no way to match. Column's and
// Pull's glyphs also carry real decoration (an arrowhead cap; a small
// triangle above the arrowhead) the synthetic templates never captured.
// This was a structural bug, not a threshold-tuning one: no amount of
// adjusting match-distance thresholds fixes a template being compared
// against that doesn't resemble what it's supposed to recognize.
//
// Add more templates here to improve recognition on a shape it still
// gets wrong (the in-app training flow instead saves personal corrections
// to localStorage, layered on top of this shipped set rather than
// editing it).
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
    // A clean, symmetric single corner. Kept alongside the real-glyph
    // templates below rather than replaced: a real reference glyph
    // traced off actual artwork carries its own small asymmetries (a
    // slightly uneven arm, a stray extra kink), which is honest to the
    // source but scores a real, careful hand-drawn corner worse than a
    // template built to be exactly what a corner is. Point-cloud
    // matching takes the closest of however many templates a category
    // has, so a clean geometric example and a real-art example coexist
    // instead of competing.
    [
      { x: -35, y: 35 }, { x: -32.1, y: 29.2 }, { x: -29.2, y: 23.3 }, { x: -26.2, y: 17.5 }, { x: -23.3, y: 11.7 },
      { x: -20.4, y: 5.8 }, { x: -17.5, y: 0 }, { x: -14.6, y: -5.8 }, { x: -11.7, y: -11.7 }, { x: -8.7, y: -17.5 },
      { x: -5.8, y: -23.3 }, { x: -2.9, y: -29.2 }, { x: 0, y: -35 }, { x: 2.9, y: -29.2 }, { x: 5.8, y: -23.3 },
      { x: 8.8, y: -17.5 }, { x: 11.7, y: -11.7 }, { x: 14.6, y: -5.8 }, { x: 17.5, y: 0 }, { x: 20.4, y: 5.8 },
      { x: 23.3, y: 11.7 }, { x: 26.3, y: 17.5 }, { x: 29.2, y: 23.3 }, { x: 32.1, y: 29.2 }, { x: 35, y: 35 },
    ],
    // Bend's own reference glyph: a smooth J-curve, traced off
    // assets/signs/bend.webp. An earlier version of this file replaced
    // the clean template above with this one instead of adding it,
    // which broke matching for a clean, carefully-drawn corner (and the
    // synthetic geometry in test/run.js) since a real traced glyph is
    // never quite as regular as a hand-built shape.
    [
      { x: 23, y: 46 }, { x: 31, y: 55 }, { x: 34, y: 54 }, { x: 34, y: 15 }, { x: 37, y: 14 }, { x: 46, y: 23 },
    ],
    // Direction's own reference glyph: a single sharp peak, no straight
    // spine, traced off assets/signs/direction.webp. Direction lives in
    // the same zigzag/one-corner family as Bend and Bolt (see
    // classify.js's SIGN_BUCKETS), and its own glyph is a plain corner
    // shape, distinct in sharpness from Bend's curve but still a single
    // bend rather than a multi-turn zigzag.
    [
      { x: 49, y: 42 }, { x: 35, y: 24 }, { x: 29, y: 29 }, { x: 20, y: 42 },
    ],
  ],
  bolt: [
    // A clean multi-turn zigzag, kept for the same reason as the clean
    // corner under "bend" above: a real hand-drawn or reference-traced
    // zigzag carries its own irregularity that scores a clean, careful
    // one worse than a template built to be exactly that.
    [
      { x: -45, y: -25 }, { x: -27, y: 25 }, { x: -9, y: -25 }, { x: 9, y: 25 }, { x: 27, y: -25 }, { x: 45, y: 25 },
    ],
    // Bolt's own reference glyph: a vertical spine with a small diamond
    // sitting in the middle of it, traced off assets/signs/bolt.webp. An
    // earlier version of this file replaced the clean zigzag above with
    // this one instead of adding it; see the note under "bend" for why
    // that broke matching for a clean zigzag draw.
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
    // Float's own reference glyph: a genuine S-curve ribbon (two parallel
    // wavy strokes), traced off assets/signs/float.webp. Of the six
    // signs currently bucketed under the "wavy" family in classify.js,
    // Float is the one whose own glyph is actually wave-shaped; see the
    // note on SIGN_BUCKETS there about the other five.
    [
      { x: 40, y: 16 }, { x: 35, y: 23 }, { x: 35, y: 30 }, { x: 44, y: 39 }, { x: 44, y: 45 }, { x: 39, y: 53 },
      { x: 30, y: 16 }, { x: 25, y: 23 }, { x: 25, y: 30 }, { x: 34, y: 39 }, { x: 34, y: 45 }, { x: 29, y: 53 },
    ],
  ],
};
