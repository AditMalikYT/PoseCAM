# PoseCam - High-End AI Pose Camera UI

A minimal, premium camera UI for Flutter inspired by the Huawei Pura 90 'AI Pose' feature.

## Features

- **Full-screen camera viewfinder** with real-time preview
- **Glassmorphism effects** on all interactive elements
- **AI Pose overlay** - Neon-cyan vector skeleton outline centered on screen
- **Horizontal mode selector** with AI POSE highlighting
- **Sleek bottom controls**: Shutter, preview thumbnail, Pose Gallery
- **Professional tech aesthetic** with ultra-thin icons

## Design Specifications

- **Primary color**: Neon Cyan (#00E5FF)
- **Style**: Glassmorphism + Neon glow
- **Animations**: Smooth transitions, subtle blur effects

## Installation

```bash
flutter pub get
```

## Permissions

### Android
Add camera permissions in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### iOS
Add camera permissions in `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access for AI Pose photography</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo library access to save photos</string>
<key>NSMicrophoneUsageDescription</key>
<string>We need microphone access for video recording</string>
```

## Usage

1. Ensure you have a physical device (camera not available on simulators)
2. Run the app:
```bash
flutter run
```

The camera will start automatically. Tap the shutter button to capture photos.

## Project Structure

```
pose_cam/
├── lib/
│   ├── main.dart                    # App entry point
│   ├── screens/
│   │   └── camera_screen.dart       # Main camera interface
│   └── widgets/
│       ├── pose_overlay.dart        # AI Pose skeleton overlay
│       ├── feature_selector.dart    # Mode selector slider
│       └── bottom_controls.dart     # Shutter & control buttons
├── assets/
│   └── pose_landmarker_lite.task    # MediaPipe pose model
└── pubspec.yaml
```

## Dependencies

- `camera` - Native camera integration
- `permission_handler` - Runtime permission management
- `cupertino_icons` - iOS-style icons

## Customization

### Change Accent Color
Edit `lib/main.dart`:
```dart
primaryColor: const Color(0xFF00E5FF), // Your color here
```

### Modify Pose Overlay
Edit `lib/widgets/pose_overlay.dart` - Adjust `PoseOutlinePainter` for custom skeleton shapes.

## License

Proprietary - Created for demonstration purposes.
