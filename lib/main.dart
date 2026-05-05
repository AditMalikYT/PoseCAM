import 'package:flutter/material.dart';
import 'screens/camera_screen.dart';

void main() {
  runApp(const PoseCamApp());
}

class PoseCamApp extends StatelessWidget {
  const PoseCamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PoseCam',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: Colors.black,
        primaryColor: const Color(0xFF00E5FF),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00E5FF),
          secondary: Color(0xFF00B8D4),
          surface: Colors.black,
        ),
        textTheme: const TextTheme(
          labelLarge: TextStyle(
            letterSpacing: 1.5,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      home: const CameraScreen(),
    );
  }
}
