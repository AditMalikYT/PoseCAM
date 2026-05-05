import '../utils/angle_utils.dart' as au;

class PoseTemplate {
  final String displayName;
  final Map<String, double> targetAngles;
  final Map<int, au.LandmarkPoint>? ghostLandmarks;
  final double tolerance;

  const PoseTemplate({
    required this.displayName,
    required this.targetAngles,
    this.ghostLandmarks,
    this.tolerance = 8.0, // degrees
  });
}

enum ProximityState {
  red,
  yellow,
  cyan,
}

class LandmarkBounds {
  final double minX;
  final double minY;
  final double maxX;
  final double maxY;

  const LandmarkBounds({
    required this.minX,
    required this.minY,
    required this.maxX,
    required this.maxY,
  });
}

class PoseResult {
  final Map<String, double> jointAngles;
  final Map<int, au.LandmarkPoint> landmarks;
  final LandmarkBounds bounds;

  const PoseResult({
    required this.jointAngles,
    required this.landmarks,
    required this.bounds,
  });
}