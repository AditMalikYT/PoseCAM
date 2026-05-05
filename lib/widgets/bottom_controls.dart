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
      bottom: 0,
      left: 0,
      right: 0,
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: const EdgeInsets.only(bottom: 40, top: 20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withOpacity(0.0),
                  Colors.black.withOpacity(0.4),
                  Colors.black.withOpacity(0.6),
                ],
              ),
              border: Border(
                top: BorderSide(
                  color: Colors.white.withOpacity(0.1),
                  width: 0.5,
                ),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Feature mode selector
                FeatureSelector(
                  selectedMode: selectedMode,
                  onModeSelected: onModeSelected,
                ),

                const SizedBox(height: 15),

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
          ),
        ),
      ),
    );
  }

  Widget _buildPreviewThumbnail() {
    return GestureDetector(
      onTap: () {
        // Open gallery
      },
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withOpacity(0.2),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 10,
            ),
          ],
        ),
        child: ClipOval(
          child: Container(
            color: Colors.white.withOpacity(0.1),
            child: const Center(
              child: Icon(
                Icons.photo_library_outlined,
                size: 22,
                color: Colors.white,
              ),
            ),
          ),
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
        width: 82,
        height: 82,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withOpacity(0.8),
            width: 4,
          ),
        ),
        padding: const EdgeInsets.all(6),
        child: Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF00E5FF).withOpacity(0.3),
                blurRadius: 15,
                spreadRadius: 2,
              ),
            ],
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
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: ClipOval(
          child: Container(
            color: Colors.white.withOpacity(0.1),
            child: const Center(
              child: Icon(
                Icons.accessibility_new_rounded,
                size: 24,
                color: Colors.white,
              ),
            ),
          ),
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
