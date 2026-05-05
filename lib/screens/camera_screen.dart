import 'dart:async';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import '../widgets/pose_overlay.dart';
import '../widgets/bottom_controls.dart';
import '../services/pose_detector_service.dart';
import '../services/pose_matching_engine.dart';
import '../utils/pose_library.dart';
import '../models/pose_template.dart';
import '../models/camera_mode.dart';

class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  late CameraController _controller;
  Future<void>? _initializeControllerFuture;
  bool _isFlashOn = false;
  bool _isAiPoseMode = true;
  int _selectedModeIndex = 2; // 0: Photo, 1: Portrait, 2: AI POSE, 3: Video

  CameraMode get _selectedMode {
    switch (_selectedModeIndex) {
      case 0: return CameraMode.photo;
      case 1: return CameraMode.portrait;
      case 2: return CameraMode.aiPose;
      case 3: return CameraMode.video;
      default: return CameraMode.photo;
    }
  }

  // AI Pose fields
  late PoseDetectorService _poseDetectorService;
  late PoseMatchingEngine _poseMatchingEngine;
  PoseTemplate _currentTemplate = PoseLibrary.templates.first;

  bool _isDetecting = false;
  PoseResult? _latestPoseResult;
  Map<String, ProximityState> _latestJointStates = {};

  // Auto-capture fields
  DateTime? _symmetryStartTime;
  bool _isCapturing = false;

  @override
  void initState() {
    super.initState();
    _poseDetectorService = PoseDetectorService();
    _poseMatchingEngine = PoseMatchingEngine(_currentTemplate);
    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
    final cameras = await availableCameras();
    final firstCamera = cameras.first;

    _controller = CameraController(
      firstCamera,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: kIsWeb ? ImageFormatGroup.yuv420 : (defaultTargetPlatform == TargetPlatform.iOS ? ImageFormatGroup.bgra8888 : ImageFormatGroup.yuv420),
    );

    _initializeControllerFuture = _controller.initialize();
    await _initializeControllerFuture;

    if (mounted) {
      setState(() {});
      if (_isAiPoseMode) {
        _startPoseDetection();
      }
    }
  }

  void _startPoseDetection() {
    if (_controller.value.isStreamingImages) return;

    if (kIsWeb) return; // Pose detection not supported on web
    _controller.startImageStream((CameraImage image) async {
      if (_isDetecting) return;
      _isDetecting = true;

      try {
        final inputImage = _inputImageFromCameraImage(image);
        if (inputImage == null) return;

        final result = await _poseDetectorService.processImage(inputImage);

        if (result != null && mounted) {
          final jointStates = _poseMatchingEngine.evaluate(result.jointAngles);
          final symmetryScore = _poseMatchingEngine.calculateSymmetryScore(result.jointAngles);

          setState(() {
            _latestPoseResult = result;
            _latestJointStates = jointStates;
          });

          _handleAutoCapture(symmetryScore);
        } else if (mounted) {
          setState(() {
            _latestPoseResult = null;
            _latestJointStates = {};
          });
        }
      } finally {
        _isDetecting = false;
      }
    });
  }

  void _stopPoseDetection() {
    if (_controller.value.isStreamingImages) {
      _controller.stopImageStream();
    }
    setState(() {
      _latestPoseResult = null;
      _latestJointStates = {};
      _symmetryStartTime = null;
    });
  }

  void _handleAutoCapture(double symmetryScore) async {
    if (_isCapturing) return;

    if (symmetryScore > 0.9) {
      _symmetryStartTime ??= DateTime.now();
      final elapsed = DateTime.now().difference(_symmetryStartTime!);

      if (elapsed.inSeconds >= 2) {
        // Auto capture
        _isCapturing = true;
        try {
          await _controller.takePicture();
          // Optionally show flash animation or save to gallery here
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Auto-captured perfect pose!')),
            );
          }
        } catch (e) {
          print('Error taking picture: $e');
        } finally {
          _symmetryStartTime = null;
          // Add a short delay before allowing next capture
          await Future.delayed(const Duration(seconds: 2));
          _isCapturing = false;
        }
      }
    } else {
      _symmetryStartTime = null;
    }
  }

  InputImage? _inputImageFromCameraImage(CameraImage image) {
    final camera = _controller.description;
    final sensorOrientation = camera.sensorOrientation;

    final rotation = InputImageRotationValue.fromRawValue(sensorOrientation);
    if (rotation == null) return null;

    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null || (format != InputImageFormat.yuv420 && format != InputImageFormat.bgra8888)) {
      return null;
    }

    if (image.planes.isEmpty) return null;

    return InputImage.fromBytes(
      bytes: image.planes[0].bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: image.planes[0].bytesPerRow,
      ),
    );
  }

  @override
  void dispose() {
    _stopPoseDetection();
    _controller.dispose();
    _poseDetectorService.dispose();
    super.dispose();
  }

  void _toggleFlash() async {
    if (kIsWeb) return; // Flash not supported on web

    try {
      setState(() {
        _isFlashOn = !_isFlashOn;
      });
      await _controller.setFlashMode(
          _isFlashOn ? FlashMode.torch : FlashMode.off);
    } catch (e) {
      // Flash mode not supported, silently ignore
      setState(() {
        _isFlashOn = false;
      });
    }
  }

  void _onModeSelected(int index) {
    setState(() {
      _selectedModeIndex = index;
      _isAiPoseMode = index == 2; // AI POSE is index 2

      if (_isAiPoseMode) {
        _startPoseDetection();
      } else {
        _stopPoseDetection();
      }
    });
  }

  // Allow user to select different templates
  void _cycleTemplate() {
    final currentIndex = PoseLibrary.templates.indexOf(_currentTemplate);
    final nextIndex = (currentIndex + 1) % PoseLibrary.templates.length;
    setState(() {
      _currentTemplate = PoseLibrary.templates[nextIndex];
      _poseMatchingEngine = PoseMatchingEngine(_currentTemplate);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: FutureBuilder<void>(
        future: _initializeControllerFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.done &&
              _initializeControllerFuture != null) {

            // Get camera preview size for scaling
            final previewSize = _controller.value.previewSize ?? const Size(720, 1280);
            // Camera images might be rotated, so we swap width/height if needed depending on orientation
            final imageSize = Size(previewSize.height, previewSize.width);

            return Stack(
              fit: StackFit.expand,
              children: [
                // Camera preview
                CameraPreview(_controller),

                // Gradient overlay for glass effect
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withOpacity(0.3),
                        Colors.transparent,
                        Colors.transparent,
                        Colors.black.withOpacity(0.3),
                      ],
                      stops: const [0.0, 0.2, 0.8, 1.0],
                    ),
                  ),
                ),

                // AI Pose overlay (dynamic)
                if (_isAiPoseMode && _latestPoseResult != null)
                  PoseOverlay(
                    poseResult: _latestPoseResult,
                    jointStates: _latestJointStates,
                    imageSize: imageSize,
                    isFrontCamera: _controller.description.lensDirection == CameraLensDirection.front,
                  ),

                // Top bar
                _buildTopBar(),

                // Template selector when in AI mode
                if (_isAiPoseMode)
                  Positioned(
                    top: 100,
                    left: 0,
                    right: 0,
                    child: Column(
                      children: [
                        Center(
                          child: GestureDetector(
                            onTap: _cycleTemplate,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.5)),
                              ),
                              child: Text(
                                'Target: ${_currentTemplate.displayName}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ),
                        if (_symmetryStartTime != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Container(
                              width: 200,
                              height: 4,
                              decoration: BoxDecoration(
                                color: Colors.white10,
                                borderRadius: BorderRadius.circular(2),
                              ),
                              child: FractionallySizedBox(
                                alignment: Alignment.centerLeft,
                                widthFactor: (DateTime.now().difference(_symmetryStartTime!).inMilliseconds / 2000).clamp(0.0, 1.0),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF00E5FF),
                                    borderRadius: BorderRadius.circular(2),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF00E5FF).withOpacity(0.5),
                                        blurRadius: 4,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),

                // Bottom controls (includes feature selector)
                BottomControls(
                  onFlashToggle: _toggleFlash,
                  isFlashOn: _isFlashOn,
                  selectedMode: _selectedMode,
                  onModeSelected: (mode) {
                    setState(() {
                      _selectedModeIndex = CameraMode.values.indexOf(mode);
                      _isAiPoseMode = mode == CameraMode.aiPose;

                      if (_isAiPoseMode) {
                        _startPoseDetection();
                      } else {
                        _stopPoseDetection();
                      }
                    });
                  },
                ),
              ],
            );
          } else {
            return const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00E5FF)),
              ),
            );
          }
        },
      ),
    );
  }

  Widget _buildTopBar() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Flash toggle button
            _buildGlassIconButton(
              icon: Icons.flash_on,
              onPressed: _toggleFlash,
              isActive: _isFlashOn,
            ),

            // AI Pose mode indicator
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                gradient: _isAiPoseMode
                    ? const LinearGradient(
                        colors: [Color(0xFF00E5FF), Color(0xFF00B8D4)],
                      )
                    : null,
                color: _isAiPoseMode ? null : Colors.white.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: const Color(0xFF00E5FF).withOpacity(0.3),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.auto_awesome,
                    size: 16,
                    color: _isAiPoseMode
                        ? Colors.black
                        : Colors.white.withOpacity(0.7),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'AI POSE',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _isAiPoseMode
                          ? Colors.black
                          : Colors.white.withOpacity(0.7),
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            ),

            // Settings button
            _buildGlassIconButton(
              icon: Icons.settings,
              onPressed: () {},
              isActive: false,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGlassIconButton({
    required IconData icon,
    required VoidCallback onPressed,
    required bool isActive,
  }) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: isActive
                ? const Color(0xFF00E5FF)
                : Colors.white.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: ClipOval(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                  child: Container(
                    color: Colors.white.withOpacity(isActive ? 0.15 : 0.05),
                  ),
                ),
              ),
            ),
            Center(
              child: Icon(
                icon,
                size: 20,
                color: isActive ? const Color(0xFF00E5FF) : Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}