const Vector = {
  magnitude(x, y) {
    return Math.hypot(x, y);
  },
  angle(x, y) {
    return Math.atan2(y, x);
  },
  toDegrees(radians) {
    return ((radians * 180) / Math.PI + 360) % 360;
  },
  // Canvas angle 0 points right (east) with y growing downward. Readers
  // expect a map-style compass instead: 0 degrees at the top (north),
  // increasing clockwise. This converts one to the other.
  toBearing(radians) {
    return (Vector.toDegrees(radians) + 90) % 360;
  },
  compassLabel(radians) {
    const bearing = Vector.toBearing(radians);
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(bearing / 45) % 8;
    return dirs[index];
  },
};
