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
  compassLabel(radians) {
    const deg = Vector.toDegrees(radians);
    const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
    const index = Math.round(deg / 45) % 8;
    return dirs[index];
  },
};
