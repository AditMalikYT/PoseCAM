# MediaPipe Pose Landmarker Task Configuration
# Place pose_landmarker.task file in public/assets/models/

## Model Download URL
```
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker/float16/1/pose_landmarker.task
```

## Recommended Settings for Accuracy

```typescript
const poseLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: '/assets/models/pose_landmarker.task',
    delegate: 'GPU',  // GPU acceleration for better performance
  },
  runningMode: 'VIDEO',  // Video mode for temporal consistency
  numPoses: 1,
  minPoseDetectionConfidence: 0.6,  // Higher = fewer false positives
  minPosePresenceConfidence: 0.6,
  minTrackingConfidence: 0.5,
  outputSegmentationMasks: true,
  // For newer API:
  // minDetectionConfidence: 0.6,
  // minTrackingConfidence: 0.5,
};
```

## Key Accuracy Improvements

1. **Use GPU delegation** - Much faster, allows higher model complexity
2. **Enable landmark smoothing** - Reduces jitter in angle calculations
3. **Use VIDEO mode** - Better temporal consistency than IMAGE mode
4. **Higher confidence thresholds** - Reduces false detections
5. **Temporal validation** - Require consistent detection across frames