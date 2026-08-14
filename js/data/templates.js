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
  ],
  bend: [
    [
      { x: -35, y: 35 }, { x: -32.1, y: 29.2 }, { x: -29.2, y: 23.3 }, { x: -26.2, y: 17.5 }, { x: -23.3, y: 11.7 },
      { x: -20.4, y: 5.8 }, { x: -17.5, y: 0 }, { x: -14.6, y: -5.8 }, { x: -11.7, y: -11.7 }, { x: -8.7, y: -17.5 },
      { x: -5.8, y: -23.3 }, { x: -2.9, y: -29.2 }, { x: 0, y: -35 }, { x: 2.9, y: -29.2 }, { x: 5.8, y: -23.3 },
      { x: 8.8, y: -17.5 }, { x: 11.7, y: -11.7 }, { x: 14.6, y: -5.8 }, { x: 17.5, y: 0 }, { x: 20.4, y: 5.8 },
      { x: 23.3, y: 11.7 }, { x: 26.3, y: 17.5 }, { x: 29.2, y: 23.3 }, { x: 32.1, y: 29.2 }, { x: 35, y: 35 },
    ],
  ],
  bolt: [
    [
      { x: -45, y: -25 }, { x: -27, y: 25 }, { x: -9, y: -25 }, { x: 9, y: 25 }, { x: 27, y: -25 }, { x: 45, y: 25 },
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
  ],
};
