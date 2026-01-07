# Debug Recorder System

## Overview

The Debug Recorder is a powerful troubleshooting tool that captures everything you do in the Dune Builder app in JSON format. It's like a "flight recorder" for debugging socket snapping issues.

## What It Records

Every frame captures:

### 1. **Cursor Information**
- 3D world position (where the ray hits the ground)
- Screen coordinates (normalized mouse position)

### 2. **Snap Calculation Details**
For each frame, it logs:
- All compatible sockets found near the cursor
- Every possible snap candidate with:
  - Target socket type and position
  - Target socket normal (direction it faces)
  - Ghost piece socket type and position
  - Alignment score (how well normals oppose)
  - Resulting position and rotation
  - Distance to cursor
  - Whether the socket was occupied
- Which candidate was selected (closest to cursor)
- Final ghost position and rotation
- Whether the placement is valid

### 3. **Keyboard Input**
- Key presses (especially 'R' for rotation)
- Rotation angle changes

### 4. **Building Actions**
- Placement events (building type, position, rotation)
- Removal events

## How to Use

### Recording a Session

1. **Start Recording**
   - Click the red "START" button in the Debug Recorder panel (top right)
   - You'll see "● RECORDING" and a frame counter

2. **Reproduce the Issue**
   - Place a square foundation
   - Select triangle foundation
   - Move your mouse around the square to show the snapping behavior
   - Press 'R' to rotate as needed
   - Place the triangle (or don't if it's misaligned)

3. **Stop Recording**
   - Click "STOP" when done
   - Frame counter shows how many frames were captured

4. **Download the Recording**
   - Click "SAVE" to download a JSON file
   - Add a description when prompted (e.g., "Triangle snapping to square north edge")
   - File will download as `dune-debug-YYYY-MM-DD-HHmmss.json`

### Analyzing the Recording

The JSON file contains:

```json
{
  "version": 1,
  "startTime": 1704826800000,
  "endTime": 1704826815000,
  "frames": [
    {
      "timestamp": 1704826801234,
      "cursorPosition": [2.5, 0, 4.0],
      "cursorScreen": [0.123, -0.456],
      "activeType": "TRIANGLE_FOUNDATION",
      "rotation": 0,
      "snapCalculation": {
        "rayPoint": [2.5, 0, 4.0],
        "compatibleSocketsFound": 4,
        "candidates": [
          {
            "targetSocketType": "FOUNDATION_EDGE",
            "targetSocketPos": [0, 0, 2],
            "targetSocketNormal": [0, 0, 1],
            "ghostSocketType": "FOUNDATION_EDGE",
            "ghostSocketPos": [0, 0, 1.15],
            "ghostSocketNormal": [0, 0, 1],
            "alignmentScore": 0.95,
            "resultingPosition": [0, 0, 0.85],
            "resultingRotation": [0, 0, 0],
            "distanceToCursor": 3.2,
            "wasOccupied": false
          }
        ],
        "selectedCandidate": 0,
        "finalPosition": [0, 0, 0.85],
        "finalRotation": [0, 0, 0],
        "isValid": true,
        "snappedToSocket": true
      }
    }
  ],
  "metadata": {
    "userAgent": "Mozilla/5.0...",
    "screenResolution": [1920, 1080],
    "description": "Triangle snapping to square north edge"
  }
}
```

### Key Fields to Check

**When triangle isn't aligning properly:**

1. **`snapCalculation.candidates`** - Shows ALL possible snap positions
   - Check if the correct socket is being considered
   - Verify socket positions match expected geometry
   - Check alignment scores (should be > 0.5 for good alignment)

2. **`selectedCandidate`** - Which candidate was chosen
   - Should be the index of the closest candidate
   - If wrong candidate selected, may indicate distance calculation issue

3. **`targetSocketNormal` vs `ghostSocketNormal`** - Direction sockets face
   - Should be roughly opposite for good snapping
   - Triangle edges are at 60°, 180°, 300° from +X axis

4. **`resultingPosition`** - Where the triangle center ends up
   - For edge-to-edge snapping, calculate expected position
   - Square edge at z=2, triangle apothem=1.15 → triangle center should be at z ≈ 3.15

## Sharing Recordings with Claude

When you send me a debug recording:

1. Download the JSON file
2. Share the file contents or attach it
3. Tell me:
   - What you were trying to do
   - What you expected to happen
   - What actually happened

I can analyze the exact snap calculations and identify:
- Socket position errors
- Alignment calculation bugs
- Rotation issues
- Overlap detection problems

## Tips

**Performance:**
- Recording captures data every frame (60 FPS)
- A 10-second recording = ~600 frames
- Keep recordings short (5-15 seconds) for specific issues

**Best Practices:**
- Record one issue at a time
- Move mouse slowly to capture smooth snap transitions
- Add descriptive notes when downloading
- Enable "Sockets" debug view while recording for visual context

## Example Workflow

```
1. Enable Socket Debug (purple "Sockets" button)
2. Start Recording (red "START")
3. Place square foundation
4. Switch to triangle
5. Hover over north edge of square (watch green sockets)
6. Press 'R' to rotate if needed
7. Click to place (or don't if misaligned)
8. Stop Recording
9. Download with description "Triangle north edge alignment"
10. Share JSON with Claude
```

## Clearing Recordings

Click "Clear" to delete the current recording without saving. Useful if you want to start over.

---

**Version:** v1.3.0
**Build:** Debug Recorder System
**Status:** ✅ Ready for testing
