import * as THREE from 'three';
import { BuildingType, SocketType } from '../types';

// Debug recording frame - captures one moment in time
export interface DebugFrame {
  timestamp: number;
  cursorPosition: [number, number, number] | null; // 3D raycast point
  cursorScreen: [number, number]; // Screen coordinates
  activeType: BuildingType;
  rotation: number; // Current manual rotation

  // Snap calculation details
  snapCalculation?: {
    rayPoint: [number, number, number];
    compatibleSocketsFound: number;
    candidates: Array<{
      targetSocketType: SocketType;
      targetSocketPos: [number, number, number];
      targetSocketNormal: [number, number, number];
      ghostSocketType: SocketType;
      ghostSocketPos: [number, number, number];
      ghostSocketNormal: [number, number, number];
      alignmentScore: number;
      resultingPosition: [number, number, number];
      resultingRotation: [number, number, number];
      distanceToCursor: number;
      wasOccupied: boolean;
    }>;
    selectedCandidate: number | null; // Index into candidates array
    finalPosition: [number, number, number];
    finalRotation: [number, number, number];
    isValid: boolean;
    snappedToSocket: boolean;
  };

  // Keyboard events
  keyPress?: {
    key: string;
    action: string;
  };

  // Building placed/removed
  buildingAction?: {
    action: 'place' | 'remove';
    buildingId: string;
    buildingType: BuildingType;
    position: [number, number, number];
    rotation: [number, number, number];
  };
}

// Debug recording session
export interface DebugRecording {
  version: number;
  startTime: number;
  endTime: number;
  frames: DebugFrame[];
  metadata: {
    userAgent: string;
    screenResolution: [number, number];
    description?: string;
  };
}

// Playback state
export interface PlaybackState {
  recording: DebugRecording;
  currentFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number; // 1.0 = normal, 0.5 = half speed, etc.
}
