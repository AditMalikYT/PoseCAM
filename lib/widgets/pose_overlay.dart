import 'package:flutter/material.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import '../models/pose_template.dart';
import '../utils/angle_utils.dart' as au;

class PoseOverlay extends StatelessWidget {
  final PoseResult? poseResult;
  final PoseTemplate currentTemplate;
  final Map<String, ProximityState> jointStates;
  final Size imageSize;
  final bool isFrontCamera;

  const PoseOverlay({
    super.key,
    required this.poseResult,
    required this.currentTemplate,
    required this.jointStates,
    required this.imageSize,
    this.isFrontCamera = true,
  });

  @override
  Widget build(BuildContext context) {
    if (imageSize.isEmpty) {
      return const SizedBox.shrink();
    }

    return CustomPaint(
      painter: PoseSkeletonPainter(
        poseResult: poseResult,
        template: currentTemplate,
        jointStates: jointStates,
        imageSize: imageSize,
        isFrontCamera: isFrontCamera,
      ),
      size: Size.infinite,
    );
  }
}

class PoseSkeletonPainter extends CustomPainter {
  final PoseResult? poseResult;
  final PoseTemplate template;
  final Map<String, ProximityState> jointStates;
  final Size imageSize;
  final bool isFrontCamera;

  PoseSkeletonPainter({
    required this.poseResult,
    required this.template,
    required this.jointStates,
    required this.imageSize,
    required this.isFrontCamera,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final scaleX = size.width / imageSize.width;
    final scaleY = size.height / imageSize.height;

    Offset translatePoint(au.LandmarkPoint point, [LandmarkBounds? bounds]) {
      double x, y;
      if (bounds != null) {
        // Map normalized ghost points to detected user's bounding box or center
        final centerX = (bounds.minX + bounds.maxX) / 2;
        final centerY = (bounds.minY + bounds.maxY) / 2;
        final width = (bounds.maxX - bounds.minX) * 1.1; // Add padding
        final height = (bounds.maxY - bounds.minY) * 1.1;

        x = centerX + (point.x - 0.5) * width;
        y = centerY + (point.y - 0.5) * height;
      } else {
        x = point.x;
        y = point.y;
      }

      double finalX = x * scaleX;
      if (isFrontCamera) {
        finalX = size.width - finalX;
      }
      return Offset(finalX, y * scaleY);
    }

    // --- Draw Ghost Outline ---
    final ghostLandmarks = template.ghostLandmarks;
    if (ghostLandmarks != null) {
      final bounds = poseResult?.bounds;

      void drawGhostBone(int startIdx, int endIdx) {
        final startLP = ghostLandmarks[startIdx];
        final endLP = ghostLandmarks[endIdx];
        if (startLP == null || endLP == null) return;

        final start = translatePoint(startLP, bounds);
        final end = translatePoint(endLP, bounds);

        canvas.drawLine(
          start, end,
          Paint()
            ..color = Colors.white.withOpacity(0.2)
            ..strokeWidth = 3
            ..strokeCap = StrokeCap.round
        );
      }

      // Draw essential ghost bones
      drawGhostBone(11, 12); // shoulders
      drawGhostBone(11, 13); drawGhostBone(13, 15); // left arm
      drawGhostBone(12, 14); drawGhostBone(14, 16); // right arm
      drawGhostBone(11, 23); drawGhostBone(12, 24); // torso sides
      drawGhostBone(23, 24); // hips
      drawGhostBone(23, 25); drawGhostBone(25, 27); // left leg
      drawGhostBone(24, 26); drawGhostBone(26, 28); // right leg
    }

    if (poseResult == null) return;

    final landmarks = poseResult!.landmarks;

    Offset? getOffset(int typeIndex) {
      final lm = landmarks[typeIndex];
      if (lm == null) return null;
      return translatePoint(au.LandmarkPoint(x: lm.x, y: lm.y, z: lm.z));
    }

    // Define landmark indices for pose detection
    const leftShoulder = 11;
    const rightShoulder = 12;
    const leftElbow = 13;
    const rightElbow = 14;
    const leftWrist = 15;
    const rightWrist = 16;
    const leftHip = 23;
    const rightHip = 24;
    const leftKnee = 25;
    const rightKnee = 26;
    const leftAnkle = 27;
    const rightAnkle = 28;

    final leftShoulderOffset = getOffset(leftShoulder);
    final rightShoulderOffset = getOffset(rightShoulder);
    final leftElbowOffset = getOffset(leftElbow);
    final rightElbowOffset = getOffset(rightElbow);
    final leftWristOffset = getOffset(leftWrist);
    final rightWristOffset = getOffset(rightWrist);
    final leftHipOffset = getOffset(leftHip);
    final rightHipOffset = getOffset(rightHip);
    final leftKneeOffset = getOffset(leftKnee);
    final rightKneeOffset = getOffset(rightKnee);
    final leftAnkleOffset = getOffset(leftAnkle);
    final rightAnkleOffset = getOffset(rightAnkle);

    Color getColorForJoint(String jointName) {
      final state = jointStates[jointName] ?? ProximityState.red;
      switch (state) {
        case ProximityState.cyan:
          return const Color(0xFF00E5FF);
        case ProximityState.yellow:
          return const Color(0xFFFFEB3B).withOpacity(0.8);
        case ProximityState.red:
          return Colors.white.withOpacity(0.5);
      }
    }

    void drawBone(Offset? start, Offset? end, String jointName) {
      if (start == null || end == null) return;

      final color = getColorForJoint(jointName);
      final isMatched = jointStates[jointName] == ProximityState.cyan;

      final paint = Paint()
        ..color = color
        ..strokeWidth = isMatched ? 5 : 3
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;

      if (isMatched) {
        // Glow effect for matched joints
        canvas.drawLine(start, end, Paint()
          ..color = color.withOpacity(0.3)
          ..strokeWidth = 10
          ..strokeCap = StrokeCap.round
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4)
        );
      }

      canvas.drawLine(start, end, paint);
    }

    void drawJoint(Offset? point, String jointName) {
      if (point == null) return;

      final color = getColorForJoint(jointName);
      final isMatched = jointStates[jointName] == ProximityState.cyan;

      if (isMatched) {
        canvas.drawCircle(point, 8, Paint()
          ..color = color.withOpacity(0.3)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4)
        );
      }

      final paint = Paint()
        ..color = color
        ..style = PaintingStyle.fill;

      canvas.drawCircle(point, isMatched ? 6 : 4, paint);
    }

    // Draw bones
    drawBone(leftShoulderOffset, leftElbowOffset, 'left_shoulder');
    drawBone(leftElbowOffset, leftWristOffset, 'left_elbow');
    drawBone(rightShoulderOffset, rightElbowOffset, 'right_shoulder');
    drawBone(rightElbowOffset, rightWristOffset, 'right_elbow');
    drawBone(leftShoulderOffset, leftHipOffset, 'left_hip');
    drawBone(rightShoulderOffset, rightHipOffset, 'right_hip');
    drawBone(leftHipOffset, leftKneeOffset, 'left_knee');
    drawBone(rightHipOffset, rightKneeOffset, 'right_knee');
    drawBone(leftKneeOffset, leftAnkleOffset, 'left_knee');
    drawBone(rightKneeOffset, rightAnkleOffset, 'right_knee');

    // Draw torso
    if (leftShoulderOffset != null && rightShoulderOffset != null &&
        leftHipOffset != null && rightHipOffset != null) {
      final torsoColor = getColorForJoint('torso_lean');
      final torsoPaint = Paint()
        ..color = torsoColor
        ..strokeWidth = 3
        ..style = PaintingStyle.stroke;

      canvas.drawLine(leftShoulderOffset, rightShoulderOffset, torsoPaint);
      canvas.drawLine(rightShoulderOffset, rightHipOffset, torsoPaint);
      canvas.drawLine(rightHipOffset, leftHipOffset, torsoPaint);
      canvas.drawLine(leftHipOffset, leftShoulderOffset, torsoPaint);
    }

    // Draw joints
    drawJoint(leftShoulderOffset, 'left_shoulder');
    drawJoint(rightShoulderOffset, 'right_shoulder');
    drawJoint(leftElbowOffset, 'left_elbow');
    drawJoint(rightElbowOffset, 'right_elbow');
    drawJoint(leftWristOffset, 'left_elbow');
    drawJoint(rightWristOffset, 'right_elbow');
    drawJoint(leftHipOffset, 'left_hip');
    drawJoint(rightHipOffset, 'right_hip');
    drawJoint(leftKneeOffset, 'left_knee');
    drawJoint(rightKneeOffset, 'right_knee');
    drawJoint(leftAnkleOffset, 'left_knee');
    drawJoint(rightAnkleOffset, 'right_knee');
  }

  @override
  bool shouldRepaint(covariant PoseSkeletonPainter oldDelegate) => true;
}