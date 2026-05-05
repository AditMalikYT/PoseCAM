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
      height: 45,
      margin: const EdgeInsets.symmetric(vertical: 10),
      child: Center(
        child: ListView.separated(
          shrinkWrap: true,
          scrollDirection: Axis.horizontal,
          itemCount: modes.length,
          separatorBuilder: (_, __) => const SizedBox(width: 15),
          padding: const EdgeInsets.symmetric(horizontal: 30),
          itemBuilder: (context, index) {
            final mode = modes[index];
            final isSelected = mode == selectedMode;
            return GestureDetector(
              onTap: () => onModeSelected(mode),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedDefaultTextStyle(
                    duration: const Duration(milliseconds: 250),
                    style: TextStyle(
                      fontSize: isSelected ? 14 : 13,
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                      color: isSelected
                          ? const Color(0xFF00E5FF)
                          : Colors.white.withOpacity(0.6),
                      letterSpacing: 1.5,
                    ),
                    child: Text(modeLabels[index]),
                  ),
                  const SizedBox(height: 4),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    width: isSelected ? 4 : 0,
                    height: 4,
                    decoration: const BoxDecoration(
                      color: Color(0xFF00E5FF),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Color(0xFF00E5FF),
                          blurRadius: 4,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
