import '../utils/pose_library.dart';
import '../models/camera_mode.dart';
import '../models/pose_template.dart';

class PoseMatchingEngine {
  final PoseTemplate template;

  PoseMatchingEngine(this.template);

  Map<String, ProximityState> evaluate(Map<String, double> liveAngles) {
    final states = <String, ProximityState>{};

    for (final entry in template.targetAngles.entries) {
      final jointName = entry.key;
      final targetAngle = entry.value;
      final liveAngle = liveAngles[jointName];

      if (liveAngle == null) {
        states[jointName] = ProximityState.red;
        continue;
      }

      final difference = (liveAngle - targetAngle).abs();

      if (difference <= template.tolerance) {
        states[jointName] = ProximityState.cyan;
      } else if (difference <= template.tolerance * 2) {
        states[jointName] = ProximityState.yellow;
      } else {
        states[jointName] = ProximityState.red;
      }
    }

    return states;
  }

  double calculateSymmetryScore(Map<String, double> liveAngles) {
    // Calculate symmetry score based on matching joints
    final states = evaluate(liveAngles);
    final cyanCount = states.values.where((state) => state == ProximityState.cyan).length;
    final totalCount = states.length;

    return totalCount > 0 ? cyanCount / totalCount : 0.0;
  }

  static PoseTemplate findBestMatch(Map<String, double> liveAngles) {
    PoseTemplate bestMatch = PoseLibrary.templates.first;
    double highestScore = -1.0;

    for (final template in PoseLibrary.templates) {
      final engine = PoseMatchingEngine(template);
      final score = engine.calculateSymmetryScore(liveAngles);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = template;
      }
    }

    return bestMatch;
  }
}