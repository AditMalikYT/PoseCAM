import 'package:flutter/material.dart';
import '../models/camera_mode.dart';

class FeatureSelector extends StatelessWidget {
  final CameraMode selectedMode;
  final ValueChanged<CameraMode> onModeSelected;

  const FeatureSelector({
    super.key,
    required this.selectedMode,
    required this.onModeSelected,
  });

  @override
  Widget build(BuildContext context) {
    final modes = CameraMode.values;
    final modeLabels = ['PHOTO', 'PORTRAIT', 'AI POSE', 'VIDEO'];

    return Container(
      height: 50,
      margin: const EdgeInsets.symmetric(horizontal: 20),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: modes.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        padding: const EdgeInsets.symmetric(horizontal: 10),
        itemBuilder: (context, index) {
          final mode = modes[index];
          final isSelected = mode == selectedMode;
          return GestureDetector(
            onTap: () => onModeSelected(mode),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                gradient: isSelected
                    ? const LinearGradient(
                        colors: [Color(0xFF00E5FF), Color(0xFF00B8D4)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: isSelected ? null : Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(25),
                border: Border.all(
                  color: isSelected
                      ? Colors.transparent
                      : Colors.white.withOpacity(0.15),
                  width: 1,
                ),
              ),
              child: Text(
                modeLabels[index],
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected
                      ? Colors.black
                      : Colors.white.withOpacity(isSelected ? 1.0 : 0.5),
                  letterSpacing: 1.3,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
