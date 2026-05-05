import '../models/pose_template.dart';

class PoseTemplate {
  final String displayName;
  final Map<String, double> targetAngles;
  final double tolerance;

  const PoseTemplate({
    required this.displayName,
    required this.targetAngles,
    this.tolerance = 10.0, // degrees
  });
}

class PoseLibrary {
  static final List<PoseTemplate> templates = [
    PoseTemplate(
      displayName: 'T-Pose',
      targetAngles: {
        'left_elbow': 180.0,
        'right_elbow': 180.0,
        'left_shoulder': 90.0,
        'right_shoulder': 90.0,
        'left_hip': 180.0,
        'right_hip': 180.0,
        'left_knee': 180.0,
        'right_knee': 180.0,
        'torso_lean': 0.0,
      },
    ),
    PoseTemplate(
      displayName: 'Warrior Pose',
      targetAngles: {
        'left_elbow': 160.0,
        'right_elbow': 180.0,
        'left_shoulder': 30.0,
        'right_shoulder': 90.0,
        'left_hip': 120.0,
        'right_hip': 160.0,
        'left_knee': 90.0,
        'right_knee': 180.0,
        'torso_lean': 15.0,
      },
    ),
  ];
}