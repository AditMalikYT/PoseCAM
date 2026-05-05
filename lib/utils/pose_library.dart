import '../models/pose_template.dart';
import '../utils/angle_utils.dart' as au;

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
      ghostLandmarks: {
        11: au.LandmarkPoint(x: 0.4, y: 0.3, z: 0),
        12: au.LandmarkPoint(x: 0.6, y: 0.3, z: 0),
        13: au.LandmarkPoint(x: 0.2, y: 0.3, z: 0),
        14: au.LandmarkPoint(x: 0.8, y: 0.3, z: 0),
        15: au.LandmarkPoint(x: 0.1, y: 0.3, z: 0),
        16: au.LandmarkPoint(x: 0.9, y: 0.3, z: 0),
        23: au.LandmarkPoint(x: 0.45, y: 0.6, z: 0),
        24: au.LandmarkPoint(x: 0.55, y: 0.6, z: 0),
        25: au.LandmarkPoint(x: 0.45, y: 0.8, z: 0),
        26: au.LandmarkPoint(x: 0.55, y: 0.8, z: 0),
        27: au.LandmarkPoint(x: 0.45, y: 0.95, z: 0),
        28: au.LandmarkPoint(x: 0.55, y: 0.95, z: 0),
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
    PoseTemplate(
      displayName: 'Sitting (Couch)',
      targetAngles: {
        'left_elbow': 90.0,
        'right_elbow': 90.0,
        'left_shoulder': 20.0,
        'right_shoulder': 20.0,
        'left_hip': 90.0,
        'right_hip': 90.0,
        'left_knee': 90.0,
        'right_knee': 90.0,
        'torso_lean': 5.0,
      },
    ),
    PoseTemplate(
      displayName: 'Leaning',
      targetAngles: {
        'left_elbow': 170.0,
        'right_elbow': 170.0,
        'left_shoulder': 15.0,
        'right_shoulder': 45.0,
        'left_hip': 170.0,
        'right_hip': 170.0,
        'left_knee': 180.0,
        'right_knee': 160.0,
        'torso_lean': 25.0,
      },
    ),
    PoseTemplate(
      displayName: 'Squatting',
      targetAngles: {
        'left_elbow': 120.0,
        'right_elbow': 120.0,
        'left_shoulder': 30.0,
        'right_shoulder': 30.0,
        'left_hip': 45.0,
        'right_hip': 45.0,
        'left_knee': 45.0,
        'right_knee': 45.0,
        'torso_lean': 10.0,
      },
    ),
  ];
}