import 'package:flutter/material.dart';
import 'dart:ui';
import 'feature_selector.dart';
import '../models/camera_mode.dart';

class BottomControls extends StatelessWidget {
  final VoidCallback onFlashToggle;
  final bool isFlashOn;
  final CameraMode selectedMode;
  final ValueChanged<CameraMode> onModeSelected;

  const BottomControls({
    super.key,
    required this.onFlashToggle,
    required this.isFlashOn,
    required this.selectedMode,
    required this.onModeSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 40,
      left: 0,
      right: 0,
      child: Column(
        children: [
          // Feature mode selector
          FeatureSelector(
            selectedMode: selectedMode,
            onModeSelected: onModeSelected,
          ),

          const SizedBox(height: 20),

          // Shutter button row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Photo preview thumbnail
              _buildPreviewThumbnail(),

              // Main shutter button
              _buildShutterButton(),

              // Pose Gallery button
              _buildPoseGalleryButton(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewThumbnail() {
    return GestureDetector(
      onTap: () {
        // Open gallery
      },
      child: Container(
        width: 50,
        height: 50,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withOpacity(0.3),
            width: 2,
          ),
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: ClipOval(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                  child: Container(
                    color: Colors.white.withOpacity(0.05),
                  ),
                ),
              ),
            ),
            const Center(
              child: Icon(
                Icons.camera_alt_outlined,
                size: 20,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildShutterButton() {
    return GestureDetector(
      onTap: () {
        // Take photo
      },
      child: Container(
        width: 75,
        height: 75,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
          border: Border.all(
            color: Colors.white.withOpacity(0.5),
            width: 3,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.white.withOpacity(0.3),
              blurRadius: 12,
              spreadRadius: 2,
            ),
          ],
        ),
        child: const Center(
          child: Icon(
            Icons.circle,
            color: Colors.transparent,
            size: 60,
          ),
        ),
      ),
    );
  }

  Widget _buildPoseGalleryButton() {
    return GestureDetector(
      onTap: () {
        // Open pose gallery
      },
      child: Container(
        width: 50,
        height: 50,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withOpacity(0.3),
            width: 1.5,
          ),
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: ClipOval(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                  child: Container(
                    color: Colors.white.withOpacity(0.05),
                  ),
                ),
              ),
            ),
            const Center(
              child: Icon(
                Icons.person_outline,
                size: 24,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickModeButton({
    required String label,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? Colors.white.withOpacity(0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: Colors.white.withOpacity(0.15),
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isActive
                ? const Color(0xFF00E5FF)
                : Colors.white.withOpacity(0.6),
            letterSpacing: 1.2,
          ),
        ),
      ),
    );
  }
}
