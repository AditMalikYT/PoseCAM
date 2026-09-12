/// <reference types="vite/client" />
/// <reference types="vite-plugin-webxr" />

declare module '@mediapipe/pose' {
  interface PoseResult {
    poseLandmarks?: Float32Array | null;
    poseWorldLandmarks?: Float32Array | null;
  }

  interface PoseSolution {
    set(options: {
      modelComplexity?: number;
      smoothLandmarks?: boolean;
      enableSegmentation?: boolean;
      smoothSegmentation?: boolean;
      refineLandmarks?: boolean;
      minDetectionConfidence?: number;
      minPosePresenceConfidence?: number;
    }): void;
    onResults(callback: (results: PoseResult) => void): void;
    estimatePoses(image: HTMLVideoElement | HTMLCanvasElement): Promise<void>;
  }

  class Pose {
    constructor(options?: {
      locateFile?: (file: string) => string;
    });
    set(options: {
      modelComplexity?: number;
      smoothLandmarks?: boolean;
      enableSegmentation?: boolean;
      smoothSegmentation?: boolean;
      refineLandmarks?: boolean;
      minDetectionConfidence?: number;
      minPosePresenceConfidence?: number;
    }): void;
    onResults(callback: (results: PoseResult) => void): void;
    estimatePoses(image: HTMLVideoElement | HTMLCanvasElement): Promise<void>;
  }

  export { Pose };
  export const Filesets: {
    POSE_CONVOLUTION_MODEL_PATH: string;
    POSE_VECTOR_MODEL_PATH: string;
  };
}
