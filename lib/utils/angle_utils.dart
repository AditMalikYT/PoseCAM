import 'dart:math' as math;

class AngleUtils {
  static double angleBetween(LandmarkPoint a, LandmarkPoint b, LandmarkPoint c) {
    // Calculate angle at point b formed by points a, b, c
    final vectorBA = LandmarkPoint(
      x: a.x - b.x,
      y: a.y - b.y,
      z: a.z - b.z,
    );

    final vectorBC = LandmarkPoint(
      x: c.x - b.x,
      y: c.y - b.y,
      z: c.z - b.z,
    );

    final dotProduct = vectorBA.x * vectorBC.x +
                      vectorBA.y * vectorBC.y +
                      vectorBA.z * vectorBC.z;

    final magnitudeBA = math.sqrt(vectorBA.x * vectorBA.x +
                                  vectorBA.y * vectorBA.y +
                                  vectorBA.z * vectorBA.z);

    final magnitudeBC = math.sqrt(vectorBC.x * vectorBC.x +
                                  vectorBC.y * vectorBC.y +
                                  vectorBC.z * vectorBC.z);

    if (magnitudeBA == 0 || magnitudeBC == 0) return 0.0;

    final cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
    final angle = math.acos(cosAngle.clamp(-1.0, 1.0));

    return angle * 180.0 / math.pi;
  }
}

class LandmarkPoint {
  final double x;
  final double y;
  final double z;

  const LandmarkPoint({
    required this.x,
    required this.y,
    required this.z,
  });
}