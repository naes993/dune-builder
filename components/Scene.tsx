import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
  BuildingType,
  BuildingData,
  UNIT_SIZE,
  FOUNDATION_HEIGHT,
  TRIANGLE_RADIUS,
  WALL_HEIGHT,
  HALF_WALL_HEIGHT,
} from '../types';
import { calculateSnap, getWorldSockets, getLocalSockets } from '../utils/geometry';
import {
  createCurvedFoundationShape,
  createDoorwayShape,
  getStairSteps,
  getRampParams,
  RAMP_THICKNESS,
  RAIL_WIDTH,
  RAIL_HEIGHT,
  ROOF_HEIGHT,
  ROOF_THICKNESS,
  WINDOW_HEIGHT,
  WINDOW_WIDTH_RATIO,
} from '../utils/buildingGeometries';

// Material colors
const COLORS = {
  foundation: '#7c7c7c',
  wall: '#8a6e4b',
  windowWall: '#5a4e3b',
  windowGlass: '#87CEEB',
  roof: '#5D4037',
  roofTrim: '#4e3b2e',
  incline: '#6d5e4d',
  edge: 'black',
} as const;

// Wall thickness
const WALL_THICKNESS = 0.2;

interface MaterialsType {
  ghost: THREE.MeshBasicMaterial;
  error: THREE.MeshBasicMaterial;
}

interface SceneProps {
  buildings: BuildingData[];
  setBuildings: React.Dispatch<React.SetStateAction<BuildingData[]>>;
  activeType: BuildingType;
  showWireframe: boolean;
  showSocketDebug: boolean;
  materials: MaterialsType;
  debugRecorder?: {
    isRecording: boolean;
    addFrame: (frame: any) => void;
  };
}

interface BuildingMeshProps {
  type: BuildingType;
  position: [number, number, number];
  rotation: [number, number, number];
  isGhost?: boolean;
  isValid?: boolean;
  id?: string;
  wireframe?: boolean;
  materials: MaterialsType;
}

/**
 * Returns the Y offset for a building type (how high above placement point the center is)
 */
function getYOffset(type: BuildingType): number {
  switch (type) {
    case BuildingType.SQUARE_FOUNDATION:
    case BuildingType.TRIANGLE_FOUNDATION:
    case BuildingType.CURVED_FOUNDATION:
      return FOUNDATION_HEIGHT / 2;
    case BuildingType.WALL:
    case BuildingType.WINDOW_WALL:
    case BuildingType.DOORWAY:
      return WALL_HEIGHT / 2;
    case BuildingType.HALF_WALL:
      return HALF_WALL_HEIGHT / 2;
    default:
      return 0;
  }
}

/**
 * Determines if a building type uses a group wrapper (complex geometry)
 * These types handle their own positioning and cannot use simplified ghost geometry
 */
function usesGroupWrapper(type: BuildingType): boolean {
  return [
    BuildingType.CURVED_FOUNDATION,
    BuildingType.WINDOW_WALL,
    BuildingType.DOORWAY,
    BuildingType.SQUARE_ROOF,
    BuildingType.TRIANGLE_ROOF,
    BuildingType.STAIRS,
    BuildingType.RAMP,
  ].includes(type);
}

/**
 * Gets the ghost material based on validity
 */
function getGhostMaterial(materials: MaterialsType, isValid: boolean): THREE.MeshBasicMaterial {
  return isValid ? materials.ghost : materials.error;
}

// =============================================================================
// Individual Building Geometry Components
// =============================================================================

interface GeometryProps {
  wireframe?: boolean;
  isGhost?: boolean;
  isValid?: boolean;
  materials: MaterialsType;
}

const SquareFoundation = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => (
  <>
    <boxGeometry args={[UNIT_SIZE, FOUNDATION_HEIGHT, UNIT_SIZE]} />
    {isGhost ? (
      <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
    ) : (
      <meshStandardMaterial color={COLORS.foundation} roughness={0.8} wireframe={wireframe} />
    )}
    {!isGhost && (
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(UNIT_SIZE, FOUNDATION_HEIGHT, UNIT_SIZE)]} />
        <meshBasicMaterial color={COLORS.edge} />
      </lineSegments>
    )}
  </>
);

const TriangleFoundation = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => (
  <>
    <cylinderGeometry args={[TRIANGLE_RADIUS, TRIANGLE_RADIUS, FOUNDATION_HEIGHT, 3]} />
    {isGhost ? (
      <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
    ) : (
      <meshStandardMaterial color={COLORS.foundation} roughness={0.8} wireframe={wireframe} />
    )}
    {!isGhost && (
      <lineSegments>
        <edgesGeometry args={[new THREE.CylinderGeometry(TRIANGLE_RADIUS, TRIANGLE_RADIUS, FOUNDATION_HEIGHT, 3)]} />
        <meshBasicMaterial color={COLORS.edge} />
      </lineSegments>
    )}
  </>
);

const CurvedFoundation = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => {
  const shape = useMemo(() => createCurvedFoundationShape(), []);
  const extrudeSettings = useMemo(() => ({ depth: FOUNDATION_HEIGHT, bevelEnabled: false }), []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -FOUNDATION_HEIGHT / 2, 0]}>
      <mesh>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial color={COLORS.foundation} roughness={0.8} wireframe={wireframe} />
        )}
      </mesh>
    </group>
  );
};

const Wall = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => (
  <>
    <boxGeometry args={[UNIT_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
    {isGhost ? (
      <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
    ) : (
      <meshStandardMaterial color={COLORS.wall} roughness={0.9} wireframe={wireframe} />
    )}
  </>
);

const HalfWall = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => (
  <>
    <boxGeometry args={[UNIT_SIZE, HALF_WALL_HEIGHT, WALL_THICKNESS]} />
    {isGhost ? (
      <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
    ) : (
      <meshStandardMaterial color={COLORS.wall} roughness={0.9} wireframe={wireframe} />
    )}
  </>
);

const WindowWall = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => (
  <group>
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[UNIT_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
      {isGhost ? (
        <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
      ) : (
        <meshStandardMaterial color={COLORS.windowWall} roughness={0.9} transparent opacity={0.9} wireframe={wireframe} />
      )}
    </mesh>
    {!wireframe && !isGhost && (
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[UNIT_SIZE * WINDOW_WIDTH_RATIO, WINDOW_HEIGHT, WALL_THICKNESS + 0.02]} />
        <meshStandardMaterial color={COLORS.windowGlass} />
      </mesh>
    )}
  </group>
);

const Doorway = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => {
  const shape = useMemo(() => createDoorwayShape(), []);
  const extrudeSettings = useMemo(() => ({ depth: WALL_THICKNESS, bevelEnabled: false }), []);

  return (
    <group position={[0, 0, -WALL_THICKNESS / 2]}>
      <mesh>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial color={COLORS.wall} roughness={0.9} wireframe={wireframe} />
        )}
      </mesh>
    </group>
  );
};

const SquareRoof = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => {
  const roofAngle = useMemo(() => -Math.atan(ROOF_HEIGHT / UNIT_SIZE), []);
  const roofLength = useMemo(() => Math.sqrt(UNIT_SIZE * UNIT_SIZE + ROOF_HEIGHT * ROOF_HEIGHT) + 1, []);

  return (
    <group>
      <mesh position={[0, ROOF_HEIGHT / 2, 0]} rotation={[roofAngle, 0, 0]}>
        <boxGeometry args={[UNIT_SIZE, roofLength, ROOF_THICKNESS]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial color={COLORS.roof} wireframe={wireframe} />
        )}
      </mesh>
      {!wireframe && !isGhost && (
        <>
          <mesh position={[-(UNIT_SIZE / 2 - 0.1), ROOF_HEIGHT / 4, UNIT_SIZE / 8]}>
            <boxGeometry args={[ROOF_THICKNESS, ROOF_HEIGHT / 2, UNIT_SIZE]} />
            <meshStandardMaterial color={COLORS.roofTrim} />
          </mesh>
          <mesh position={[(UNIT_SIZE / 2 - 0.1), ROOF_HEIGHT / 4, UNIT_SIZE / 8]}>
            <boxGeometry args={[ROOF_THICKNESS, ROOF_HEIGHT / 2, UNIT_SIZE]} />
            <meshStandardMaterial color={COLORS.roofTrim} />
          </mesh>
        </>
      )}
    </group>
  );
};

const TriangleRoof = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => (
  <group position={[0, ROOF_HEIGHT / 2, 0]}>
    <mesh>
      <coneGeometry args={[TRIANGLE_RADIUS, ROOF_HEIGHT, 3]} />
      {isGhost ? (
        <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
      ) : (
        <meshStandardMaterial color={COLORS.roof} wireframe={wireframe} />
      )}
    </mesh>
  </group>
);

const Stairs = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => {
  const steps = useMemo(() => getStairSteps(), []);
  const stepHeight = WALL_HEIGHT / 8;
  const stepDepth = UNIT_SIZE / 8;

  return (
    <group>
      {steps.map((step, i) => (
        <mesh key={i} position={[0, step.y, step.z]}>
          <boxGeometry args={[UNIT_SIZE, stepHeight, stepDepth]} />
          {isGhost ? (
            <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
          ) : (
            <meshStandardMaterial color={COLORS.incline} wireframe={wireframe} />
          )}
        </mesh>
      ))}
    </group>
  );
};

const Ramp = ({ wireframe, isGhost, isValid = true, materials }: GeometryProps) => {
  const { length, angle } = useMemo(() => getRampParams(), []);

  return (
    <group>
      <mesh position={[0, WALL_HEIGHT / 2, 0]} rotation={[angle, 0, 0]}>
        <boxGeometry args={[UNIT_SIZE, RAMP_THICKNESS, length]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial color={COLORS.incline} wireframe={wireframe} />
        )}
      </mesh>
      {!wireframe && !isGhost && (
        <>
          <mesh position={[-UNIT_SIZE / 2 + 0.1, WALL_HEIGHT / 2, 0]} rotation={[angle, 0, 0]}>
            <boxGeometry args={[RAIL_WIDTH, RAIL_HEIGHT, length]} />
            <meshStandardMaterial color={COLORS.roofTrim} />
          </mesh>
          <mesh position={[UNIT_SIZE / 2 - 0.1, WALL_HEIGHT / 2, 0]} rotation={[angle, 0, 0]}>
            <boxGeometry args={[RAIL_WIDTH, RAIL_HEIGHT, length]} />
            <meshStandardMaterial color={COLORS.roofTrim} />
          </mesh>
        </>
      )}
    </group>
  );
};

// =============================================================================
// Building Mesh Component
// =============================================================================

const BuildingMesh = ({
  type,
  position,
  rotation,
  isGhost = false,
  isValid = true,
  id,
  wireframe = false,
  materials,
}: BuildingMeshProps) => {
  const geometryProps: GeometryProps = { wireframe, isGhost, isValid, materials };

  // Render the appropriate geometry based on type
  const renderGeometry = () => {
    switch (type) {
      case BuildingType.SQUARE_FOUNDATION:
        return <SquareFoundation {...geometryProps} />;
      case BuildingType.TRIANGLE_FOUNDATION:
        return <TriangleFoundation {...geometryProps} />;
      case BuildingType.CURVED_FOUNDATION:
        return <CurvedFoundation {...geometryProps} />;
      case BuildingType.WALL:
        return <Wall {...geometryProps} />;
      case BuildingType.HALF_WALL:
        return <HalfWall {...geometryProps} />;
      case BuildingType.WINDOW_WALL:
        return <WindowWall {...geometryProps} />;
      case BuildingType.DOORWAY:
        return <Doorway {...geometryProps} />;
      case BuildingType.SQUARE_ROOF:
        return <SquareRoof {...geometryProps} />;
      case BuildingType.TRIANGLE_ROOF:
        return <TriangleRoof {...geometryProps} />;
      case BuildingType.STAIRS:
        return <Stairs {...geometryProps} />;
      case BuildingType.RAMP:
        return <Ramp {...geometryProps} />;
      default:
        return null;
    }
  };

  const offsetY = getYOffset(type);
  const usesGroup = usesGroupWrapper(type);

  // Types that use group wrappers need to be wrapped in a positioned group
  if (usesGroup) {
    return (
      <group
        position={[position[0], position[1] + offsetY, position[2]]}
        rotation={rotation}
        userData={{ isBuilding: true, id }}
      >
        {renderGeometry()}
      </group>
    );
  }

  // Simple mesh types
  return (
    <mesh
      position={[position[0], position[1] + offsetY, position[2]]}
      rotation={rotation}
      userData={{ isBuilding: true, id }}
      raycast={isGhost ? () => null : undefined}
    >
      {renderGeometry()}
    </mesh>
  );
};

// =============================================================================
// Socket Debug Visualizer
// =============================================================================

interface SocketDebugProps {
  buildings: BuildingData[];
}

const SocketDebugVisualizer = ({ buildings }: SocketDebugProps) => {
  // Socket type colors
  const socketColors = useMemo(() => ({
    FOUNDATION_EDGE: '#FFD700',    // Gold
    FOUNDATION_TOP: '#00FF00',     // Green
    WALL_BOTTOM: '#FF00FF',        // Magenta
    WALL_SIDE: '#00FFFF',          // Cyan
    WALL_TOP: '#FF8C00',           // Orange
    ROOF_EDGE: '#FF0000',          // Red
    INCLINE_BOTTOM: '#1E90FF',     // Dodger Blue
    INCLINE_TOP: '#9400D3',        // Dark Violet
  }), []);

  return (
    <group>
      {buildings.map((building) => {
        const sockets = getWorldSockets(building);
        return (
          <group key={`sockets-${building.id}`}>
            {sockets.map((socket: any, idx: number) => {
              const color = socketColors[socket.socketType as keyof typeof socketColors] || '#FFFFFF';
              const arrowEnd = socket.position.clone().add(socket.normal.clone().multiplyScalar(0.5));

              return (
                <group key={`socket-${building.id}-${idx}`}>
                  {/* Socket position sphere */}
                  <mesh position={[socket.position.x, socket.position.y, socket.position.z]}>
                    <sphereGeometry args={[0.1, 8, 8]} />
                    <meshBasicMaterial color={color} transparent opacity={0.8} />
                  </mesh>

                  {/* Normal direction arrow */}
                  <arrowHelper
                    args={[
                      socket.normal,
                      socket.position,
                      0.5,
                      color,
                      0.2,
                      0.15
                    ]}
                  />
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};

// =============================================================================
// Planner Component (handles placement logic)
// =============================================================================

const Planner = ({ buildings, setBuildings, activeType, showWireframe, showSocketDebug, materials, debugRecorder }: SceneProps) => {
  const { camera, raycaster, mouse } = useThree();
  const [ghostPos, setGhostPos] = useState<[number, number, number]>([0, 0, 0]);
  const [ghostRot, setGhostRot] = useState<[number, number, number]>([0, 0, 0]);
  const [ghostIsValid, setGhostIsValid] = useState(true);
  const [manualRot, setManualRot] = useState(0);

  const groupRef = useRef<THREE.Group>(null);
  const lastMousePos = useRef<[number, number]>([0, 0]);

  // Handle rotation key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        // Use 60° (π/3) for triangles, 90° (π/2) for everything else
        const isTriangle = activeType === BuildingType.TRIANGLE_FOUNDATION ||
                          activeType === BuildingType.TRIANGLE_ROOF;
        const rotIncrement = isTriangle ? Math.PI / 3 : Math.PI / 2;
        const newRot = manualRot + rotIncrement;
        setManualRot(newRot);

        // Record key press
        if (debugRecorder?.isRecording) {
          debugRecorder.addFrame({
            timestamp: Date.now(),
            cursorPosition: null,
            cursorScreen: lastMousePos.current,
            activeType,
            rotation: newRot,
            keyPress: {
              key: 'r',
              action: 'rotate',
            },
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manualRot, activeType, debugRecorder]);

  // Update ghost position based on mouse
  useFrame(() => {
    if (!groupRef.current) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(groupRef.current.children, true);

    // Track mouse position for recording
    lastMousePos.current = [mouse.x, mouse.y];

    if (intersects.length > 0) {
      const targetPoint = intersects[0].point;

      // Debug callback for recording
      const debugCallback = debugRecorder?.isRecording
        ? (snapCalculation: any) => {
            debugRecorder.addFrame({
              timestamp: Date.now(),
              cursorPosition: [targetPoint.x, targetPoint.y, targetPoint.z],
              cursorScreen: [mouse.x, mouse.y],
              activeType,
              rotation: manualRot,
              snapCalculation,
            });
          }
        : undefined;

      const snap = calculateSnap(targetPoint, buildings, activeType, manualRot, debugCallback);
      if (snap) {
        setGhostPos([snap.position.x, snap.position.y, snap.position.z]);
        setGhostRot([snap.rotation.x, snap.rotation.y, snap.rotation.z]);
        setGhostIsValid(snap.isValid);
      }
    }
  });

  // Handle building placement
  const handlePlace = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5) return; // Ignore if dragging
    if (e.button === 0 && ghostIsValid) {
      e.stopPropagation();
      const newBuilding: BuildingData = {
        id: crypto.randomUUID(),
        type: activeType,
        position: [...ghostPos],
        rotation: [...ghostRot],
      };
      setBuildings((prev) => [...prev, newBuilding]);

      // Record placement
      if (debugRecorder?.isRecording) {
        debugRecorder.addFrame({
          timestamp: Date.now(),
          cursorPosition: ghostPos,
          cursorScreen: lastMousePos.current,
          activeType,
          rotation: manualRot,
          buildingAction: {
            action: 'place',
            buildingId: newBuilding.id,
            buildingType: newBuilding.type,
            position: newBuilding.position,
            rotation: newBuilding.rotation,
          },
        });
      }
    }
  };

  // Handle building removal
  const removeBuilding = (id: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const removedBuilding = buildings.find((b) => b.id === id);
    setBuildings(buildings.filter((b) => b.id !== id));

    // Record removal
    if (debugRecorder?.isRecording && removedBuilding) {
      debugRecorder.addFrame({
        timestamp: Date.now(),
        cursorPosition: null,
        cursorScreen: lastMousePos.current,
        activeType,
        rotation: manualRot,
        buildingAction: {
          action: 'remove',
          buildingId: removedBuilding.id,
          buildingType: removedBuilding.type,
          position: removedBuilding.position,
          rotation: removedBuilding.rotation,
        },
      });
    }
  };

  return (
    <group ref={groupRef} onClick={handlePlace}>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#E6C288" roughness={0.9} />
      </mesh>

      {/* Grid */}
      <gridHelper args={[1000, 250, 0x000000, 0x6b5c45]} position={[0, 0.01, 0]} />

      {/* Placed buildings */}
      {buildings.map((b) => (
        <group key={b.id} onContextMenu={(e) => removeBuilding(b.id, e)}>
          <BuildingMesh {...b} wireframe={showWireframe} materials={materials} />
        </group>
      ))}

      {/* Socket debug visualization */}
      {showSocketDebug && <SocketDebugVisualizer buildings={buildings} />}

      {/* Ghost preview */}
      <BuildingMesh
        type={activeType}
        position={ghostPos}
        rotation={ghostRot}
        isGhost
        isValid={ghostIsValid}
        materials={materials}
      />
    </group>
  );
};

// =============================================================================
// Main Scene Export
// =============================================================================

export const GameScene = (props: Omit<SceneProps, 'materials'>) => {
  const materials = useMemo(
    () => ({
      ghost: new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.5 }),
      error: new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.5 }),
    }),
    []
  );

  return (
    <Canvas shadows camera={{ position: [10, 15, 10], fov: 50 }}>
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#E6C288', 20, 100]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Planner {...props} showSocketDebug={props.showSocketDebug} debugRecorder={props.debugRecorder} materials={materials} />
      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2 - 0.1}
        mouseButtons={{
          LEFT: undefined,
          MIDDLE: THREE.MOUSE.ROTATE,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
    </Canvas>
  );
};
