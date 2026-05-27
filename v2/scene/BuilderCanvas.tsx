import React, { useEffect, useRef } from 'react';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PARTS } from '../registry/parts';
import { solvePlacement } from '../engine/snapSolver';
import { getWorldEdgeAnchors } from '../engine/anchors';
import { getWorldFootprint } from '../engine/occupancy';
import { useV2BuilderStore } from '../store/builderStore';
import { PartId, PartInstance, PlacementCandidate } from '../types';
import { V2_UNIT_SIZE } from '../constants';
import { V2_BUILD } from '../version';
import { PartMesh } from './PartMesh';

const GRID_CELLS_PER_SIDE = 24;

const AnchorLines = ({ instance }: { instance: PartInstance }) => {
  const part = PARTS[instance.partId];
  const anchors = getWorldEdgeAnchors(part, instance.transform, instance.id);

  return (
    <group>
      {anchors.map((anchor) => (
        <line key={`${instance.id}-${anchor.id}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  anchor.startWorld[0], anchor.startWorld[1] + 0.08, anchor.startWorld[2],
                  anchor.endWorld[0], anchor.endWorld[1] + 0.08, anchor.endWorld[2],
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#facc15" />
        </line>
      ))}
    </group>
  );
};

const FootprintOutline = ({
  instance,
  color = '#22c55e',
}: {
  instance: PartInstance;
  color?: string;
}) => {
  const part = PARTS[instance.partId];
  const points = getWorldFootprint(part, instance.transform);

  return (
    <lineLoop>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array(points.flatMap(([x, z]) => [x, 0.12, z])),
            3,
          ]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} />
    </lineLoop>
  );
};

const DebugEdgeLine = ({
  start,
  end,
  color,
  yOffset = 0.22,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  yOffset?: number;
}) => {
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array([
              start[0], start[1] + yOffset, start[2],
              end[0], end[1] + yOffset, end[2],
            ]),
            3,
          ]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
};

const PreviewEdgeDiagnosticsLines = ({
  activePartId,
  instances,
  preview,
}: {
  activePartId: PartId;
  instances: PartInstance[];
  preview: PlacementCandidate;
}) => {
  const activePart = PARTS[activePartId];
  const binding = preview.binding;
  if (activePart.occupancyLayer !== 'wall-edge' || !binding) return null;

  const wallEdge = getWorldEdgeAnchors(activePart, preview.transform, 'preview').find(
    (anchor) => anchor.id === binding.sourceAnchorId
  );

  if (!wallEdge) return null;

  if (binding.placementMode === 'support-edge') {
    const targetInstance = instances.find((instance) => instance.id === binding.targetInstanceId);
    if (!targetInstance) return null;

    const targetPart = PARTS[targetInstance.partId];
    const targetEdge = getWorldEdgeAnchors(targetPart, targetInstance.transform, targetInstance.id).find(
      (anchor) => anchor.id === binding.targetAnchorId
    );

    if (!targetEdge) return null;

    return (
      <>
        <DebugEdgeLine start={targetEdge.startWorld} end={targetEdge.endWorld} color="#38bdf8" yOffset={0.34} />
        <DebugEdgeLine start={wallEdge.startWorld} end={wallEdge.endWorld} color="#f97316" yOffset={0.46} />
      </>
    );
  }

  return (
    <DebugEdgeLine start={wallEdge.startWorld} end={wallEdge.endWorld} color="#f97316" yOffset={0.46} />
  );
};

const WallEndpointMarkers = ({ instance }: { instance: PartInstance }) => {
  const part = PARTS[instance.partId];
  if (part.occupancyLayer !== 'wall-edge') return null;

  const anchors = getWorldEdgeAnchors(part, instance.transform, instance.id);

  return (
    <>
      {anchors.flatMap((anchor) => [
        <mesh key={`${instance.id}-${anchor.id}-start`} position={[anchor.startWorld[0], anchor.startWorld[1] + 0.28, anchor.startWorld[2]]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>,
        <mesh key={`${instance.id}-${anchor.id}-end`} position={[anchor.endWorld[0], anchor.endWorld[1] + 0.28, anchor.endWorld[2]]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>,
      ])}
    </>
  );
};

const V2GroundGrid = () => {
  const halfCells = GRID_CELLS_PER_SIDE / 2;
  const halfSize = (GRID_CELLS_PER_SIDE * V2_UNIT_SIZE) / 2;
  const positions: number[] = [];

  for (let index = -halfCells; index <= halfCells; index += 1) {
    const value = index * V2_UNIT_SIZE;
    positions.push(-halfSize, 0.012, value, halfSize, 0.012, value);
    positions.push(value, 0.012, -halfSize, value, 0.012, halfSize);
  }

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(positions), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#5b513c" transparent opacity={0.72} />
    </lineSegments>
  );
};

const formatSnapChannel = (channel?: string) => {
  if (channel === 'foundation-structure') return 'Structural';
  if (channel === 'floor-support') return 'Floor';
  if (channel === 'wall-support') return 'Wall';
  return undefined;
};

const SceneContents = () => {
  const {
    activePartId,
    debugVisuals,
    instances,
    placePreview,
    preview,
    rotationY,
    setPreview,
    showGrid,
    snapToGrid,
  } = useV2BuilderStore();
  const groundRef = useRef<THREE.Mesh>(null);
  const lastCursorRef = useRef<[number, number, number]>([0, 0, 0]);

  const updatePreview = (point: THREE.Vector3) => {
    lastCursorRef.current = [point.x, point.y, point.z];
    setPreview(
      solvePlacement({
        cursor: lastCursorRef.current,
        activePartId,
        rotationY,
        instances,
        snapToGrid,
      })
    );
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    updatePreview(event.point);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    placePreview();
  };

  useEffect(() => {
    setPreview(
      solvePlacement({
        cursor: lastCursorRef.current,
        activePartId,
        rotationY,
        instances,
        snapToGrid,
      })
    );
  }, [activePartId, instances, rotationY, setPreview, snapToGrid]);

  useFrame(() => {
    if (!preview && groundRef.current) {
      setPreview(
        solvePlacement({
          cursor: [0, 0, 0],
          activePartId,
          rotationY,
          instances,
          snapToGrid,
        })
      );
    }
  });

  return (
    <group>
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#d2b076" roughness={0.95} />
      </mesh>
      {/* Placement points are cell centers; these visible lines mark cell boundaries. */}
      {showGrid && <V2GroundGrid />}
      {instances.map((instance) => (
        <React.Fragment key={instance.id}>
          <PartMesh partId={instance.partId} transform={instance.transform} debugVisuals={debugVisuals} />
          {debugVisuals && (
            <>
              <AnchorLines instance={instance} />
              <FootprintOutline instance={instance} />
              <WallEndpointMarkers instance={instance} />
            </>
          )}
        </React.Fragment>
      ))}
      {preview && (
        <>
          <PartMesh
            partId={activePartId}
            transform={preview.transform}
            debugVisuals={debugVisuals}
            ghost
            valid={preview.isValid}
          />
          {debugVisuals && (
            <FootprintOutline
              instance={{ id: 'preview', partId: activePartId, transform: preview.transform }}
              color={preview.isValid ? '#59e38a' : '#f05252'}
            />
          )}
          {debugVisuals && (
            <PreviewEdgeDiagnosticsLines
              activePartId={activePartId}
              instances={instances}
              preview={preview}
            />
          )}
        </>
      )}
    </group>
  );
};

const PlacementDebugPanel = () => {
  const { activePartId, debugVisuals, preview } = useV2BuilderStore();
  const activePart = PARTS[activePartId];
  const binding = preview?.binding;

  if (!debugVisuals || !binding) return null;

  return (
    <div className="pointer-events-none absolute left-4 top-40 z-10 max-w-sm rounded-lg border border-sky-400/30 bg-black/75 p-3 text-[11px] leading-5 text-white shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold uppercase tracking-wide text-sky-300">Placement Debug</div>
      <div>mode: {binding.placementMode}</div>
      <div>channel: {binding.snapChannel ?? 'none'}</div>
      {binding.placementMode === 'support-edge' && (
        <>
          <div>support instance: {binding.targetInstanceId}</div>
          <div>support edge: {binding.targetAnchorId}</div>
        </>
      )}
      {binding.placementMode === 'wall-run' && (
        <>
          <div>target wall: {binding.targetWallInstanceId}</div>
          <div>target endpoint: {binding.targetWallEndpointId}</div>
        </>
      )}
      <div>wall edge: {binding.sourceAnchorId ?? 'none'}</div>
      <div>source endpoint: {binding.sourceEndpointId ?? 'none'}</div>
      <div>key: {binding.occupancyKey ?? 'none'}</div>
      <div className={binding.targetOccupied ? 'text-red-300' : 'text-emerald-300'}>
        target status: {binding.targetOccupied ? 'occupied' : 'free'}
      </div>
      {activePart.occupancyLayer === 'wall-edge' && (
        <div className="mt-1 text-white/50">blue = support edge, orange = wall endpoint/preview segment</div>
      )}
    </div>
  );
};

const Toolbar = () => {
  const {
    activePartId,
    clear,
    debugVisuals,
    instances,
    preview,
    rotateActivePart,
    rotationY,
    setActivePartId,
    toggleDebugVisuals,
    showGrid,
    snapToGrid,
    toggleGrid,
    toggleSnapToGrid,
  } = useV2BuilderStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        rotateActivePart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rotateActivePart]);

  const tools: Array<{ id: PartId; label: string }> = [
    { id: 'foundation.square', label: 'Square' },
    { id: 'foundation.triangle', label: 'Triangle' },
    { id: 'calibration.harkonnen.level3.floor.square', label: 'Real Floor' },
    { id: 'calibration.harkonnen.level3.foundation.square', label: 'Real Foundation' },
    { id: 'calibration.harkonnen.level3.floor.wedge', label: 'Real Floor Wedge' },
    { id: 'calibration.harkonnen.level3.foundation.wedge', label: 'Real Foundation Wedge' },
    { id: 'wall.harkonnen.level3.straight', label: 'Hark Wall' },
    { id: 'wall.harkonnen.level3.corner.tall', label: 'Tall Corner' },
    { id: 'wall.harkonnen.level3.inclined.tall', label: 'Inclined Wall' },
    { id: 'wall.harkonnen.level3.door', label: 'Door Assembly' },
  ];

  return (
    <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex max-w-[min(96vw,1280px)] flex-wrap items-center justify-center gap-2 rounded-lg border border-white/15 bg-black/75 px-3 py-3 text-white shadow-2xl backdrop-blur">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActivePartId(tool.id)}
            className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
              activePartId === tool.id ? 'bg-dune-gold text-black' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {tool.label}
          </button>
        ))}
        <button
          onClick={rotateActivePart}
          className="h-10 rounded-md bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
        >
          Rotate {Math.round((rotationY * 180) / Math.PI)} deg
        </button>
        <button
          onClick={clear}
          className="h-10 rounded-md bg-red-950/70 px-4 text-sm font-semibold text-red-100 hover:bg-red-900"
        >
          Clear
        </button>
        <label className="flex h-10 items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-semibold text-white">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={toggleGrid}
            className="h-4 w-4 accent-dune-gold"
          />
          Grid
        </label>
        <label className="flex h-10 items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-semibold text-white">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={toggleSnapToGrid}
            className="h-4 w-4 accent-dune-gold"
          />
          Snap Grid
        </label>
        <label className="flex h-10 items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-semibold text-white">
          <input
            type="checkbox"
            checked={debugVisuals}
            onChange={toggleDebugVisuals}
            className="h-4 w-4 accent-dune-gold"
          />
          Debug
        </label>
        <div className="ml-2 min-w-44 text-xs text-white/70">
          <div>{instances.length} placed</div>
          <div className={preview?.isValid === false ? 'text-red-300' : 'text-emerald-300'}>
            {preview?.isValid === false
              ? preview.reasons[0]
              : preview?.placementMode === 'wall-run'
                ? 'Wall run'
                : preview?.placementMode === 'support-edge'
                  ? `Support edge${formatSnapChannel(preview.binding?.snapChannel) ? `: ${formatSnapChannel(preview.binding?.snapChannel)}` : ''}`
                  : preview?.placementMode === 'grid-ground'
                    ? 'Grid placement'
                    : 'Free placement'}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BuilderCanvas = () => {
  return (
    <div className="relative h-screen w-full bg-black" onContextMenu={(event) => event.preventDefault()}>
      <Canvas camera={{ position: [10, 12, 10], fov: 50 }}>
        <color attach="background" args={['#111827']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 20, 10]} intensity={1.1} />
        <SceneContents />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} mouseButtons={{ LEFT: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }} />
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-sm rounded-lg border border-white/15 bg-black/70 p-4 text-white shadow-xl backdrop-blur">
        <div className="text-sm font-bold uppercase tracking-wide text-dune-gold">V2 Placement Engine</div>
        <div className="mt-2 text-xs leading-5 text-white/70">
          Placeholder foundations plus temporary real Harkonnen floor/foundation calibration wrappers. Move the cursor to preview, click to place, press R to rotate.
        </div>
        <div className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-4 text-white/55">
          <div className="font-semibold text-white/70">{V2_BUILD.id}</div>
          <div>{V2_BUILD.description}</div>
        </div>
      </div>
      <PlacementDebugPanel />
      <Toolbar />
    </div>
  );
};

export default BuilderCanvas;
