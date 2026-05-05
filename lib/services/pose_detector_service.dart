import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import '../models/pose_template.dart';
import '../utils/angle_utils.dart' as au;

class PoseDetectorService {
  late PoseDetector _poseDetector;

  PoseDetectorService() {
    if (kIsWeb) return;
    try {
      final options = PoseDetectorOptions(
        mode: PoseDetectionMode.stream,
      );
      _poseDetector = PoseDetector(options: options);
    } catch (e) {
      // Handle initialization error
      print('Failed to initialize pose detector: $e');
    }
  }

  Future<PoseResult?> processImage(InputImage inputImage) async {
    if (kIsWeb || _poseDetector == null) return null;
    try {
      final List<Pose> poses = await _poseDetector.processImage(inputImage);
      if (poses.isEmpty) return null;

      final pose = poses.first;
      final landmarks = <int, au.LandmarkPoint>{};

      double minX = 1.0, minY = 1.0, maxX = 0.0, maxY = 0.0;

      pose.landmarks.forEach((type, landmark) {
        final point = au.LandmarkPoint(
          x: landmark.x,
          y: landmark.y,
          z: landmark.z,
        );
        landmarks[type.index] = point;

        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
      });

      final angles = _calculateJointAngles(pose);

      return PoseResult(
        jointAngles: angles,
        landmarks: landmarks,
        bounds: LandmarkBounds(
          minX: minX,
          minY: minY,
          maxX: maxX,
          maxY: maxY,
        ),
      );
    } catch (e) {
      print('Error detecting pose: $e');
      return null;
    }
  }

  Map<String, double> _calculateJointAngles(Pose pose) {
    final angles = <String, double>{};

    final leftShoulder = pose.landmarks[PoseLandmarkType.leftShoulder];
    final leftElbow = pose.landmarks[PoseLandmarkType.leftElbow];
    final leftWrist = pose.landmarks[PoseLandmarkType.leftWrist];
    final leftHip = pose.landmarks[PoseLandmarkType.leftHip];
    final leftKnee = pose.landmarks[PoseLandmarkType.leftKnee];
    final leftAnkle = pose.landmarks[PoseLandmarkType.leftAnkle];

    final rightShoulder = pose.landmarks[PoseLandmarkType.rightShoulder];
    final rightElbow = pose.landmarks[PoseLandmarkType.rightElbow];
    final rightWrist = pose.landmarks[PoseLandmarkType.rightWrist];
    final rightHip = pose.landmarks[PoseLandmarkType.rightHip];
    final rightKnee = pose.landmarks[PoseLandmarkType.rightKnee];
    final rightAnkle = pose.landmarks[PoseLandmarkType.rightAnkle];

    if (leftShoulder != null && leftElbow != null && leftWrist != null) {
      angles['left_elbow'] = au.AngleUtils.angleBetween(
        _toLP(leftShoulder), _toLP(leftElbow), _toLP(leftWrist));
    }

    if (rightShoulder != null && rightElbow != null && rightWrist != null) {
      angles['right_elbow'] = au.AngleUtils.angleBetween(
        _toLP(rightShoulder), _toLP(rightElbow), _toLP(rightWrist));
    }

    if (leftHip != null && leftShoulder != null && leftElbow != null) {
      angles['left_shoulder'] = au.AngleUtils.angleBetween(
        _toLP(leftHip), _toLP(leftShoulder), _toLP(leftElbow));
    }

    if (rightHip != null && rightShoulder != null && rightElbow != null) {
      angles['right_shoulder'] = au.AngleUtils.angleBetween(
        _toLP(rightHip), _toLP(rightShoulder), _toLP(rightElbow));
    }

    if (leftShoulder != null && leftHip != null && leftKnee != null) {
      angles['left_hip'] = au.AngleUtils.angleBetween(
        _toLP(leftShoulder), _toLP(leftHip), _toLP(leftKnee));
    }

    if (rightShoulder != null && rightHip != null && rightKnee != null) {
      angles['right_hip'] = au.AngleUtils.angleBetween(
        _toLP(rightShoulder), _toLP(rightHip), _toLP(rightKnee));
    }

    if (leftHip != null && leftKnee != null && leftAnkle != null) {
      angles['left_knee'] = au.AngleUtils.angleBetween(
        _toLP(leftHip), _toLP(leftKnee), _toLP(leftAnkle));
    }

    if (rightHip != null && rightKnee != null && rightAnkle != null) {
      angles['right_knee'] = au.AngleUtils.angleBetween(
        _toLP(rightHip), _toLP(rightKnee), _toLP(rightAnkle));
    }

    if (rightShoulder != null && rightElbow != null && rightWrist != null) {
      angles['right_elbow'] = au.AngleUtils.angleBetween(
        _toLP(rightShoulder), _toLP(rightElbow), _toLP(rightWrist));
    }

    if (leftHip != null && leftShoulder != null && leftElbow != null) {
      angles['left_shoulder'] = au.AngleUtils.angleBetween(
        _toLP(leftHip), _toLP(leftShoulder), _toLP(leftElbow));
    }

    if (rightHip != null && rightShoulder != null && rightElbow != null) {
      angles['right_shoulder'] = au.AngleUtils.angleBetween(
        _toLP(rightHip), _toLP(rightShoulder), _toLP(rightElbow));
    }

    if (leftShoulder != null && leftHip != null && leftKnee != null) {
      angles['left_hip'] = au.AngleUtils.angleBetween(
        _toLP(leftShoulder), _toLP(leftHip), _toLP(leftKnee));
    }

    if (rightShoulder != null && rightHip != null && rightKnee != null) {
      angles['right_hip'] = au.AngleUtils.angleBetween(
        _toLP(rightShoulder), _toLP(rightHip), _toLP(rightKnee));
    }

    if (leftHip != null && leftKnee != null && leftAnkle != null) {
      angles['left_knee'] = au.AngleUtils.angleBetween(
        _toLP(leftHip), _toLP(leftKnee), _toLP(leftAnkle));
    }

    if (rightHip != null && rightKnee != null && rightAnkle != null) {
      angles['right_knee'] = au.AngleUtils.angleBetween(
        _toLP(rightHip), _toLP(rightKnee), _toLP(rightAnkle));
    }

    // Torso lean - relative to vertical
    if (leftShoulder != null && rightShoulder != null && leftHip != null && rightHip != null) {
      final shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
      final shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
      final hipMidX = (leftHip.x + rightHip.x) / 2;
      final hipMidY = (leftHip.y + rightHip.y) / 2;

      // Angle between spine and vertical (approximated)
      final dy = (shoulderMidY - hipMidY).abs();
      final dx = (shoulderMidX - hipMidX).abs();
      angles['torso_lean'] = 180 - (math.atan2(dx, dy) * 180 / math.pi);
    }

    return angles;
  }

  au.LandmarkPoint _toLP(PoseLandmark l) => au.LandmarkPoint(x: l.x, y: l.y, z: l.z);

  void dispose() {
    if (kIsWeb || _poseDetector == null) return;
    _poseDetector.close();
  }
}