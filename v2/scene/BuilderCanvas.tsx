import React, { useEffect, useRef } from 'react';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PARTS } from '../registry/parts';
import { solvePlacement } from '../engine/snapSolver';
import { getWorldEdgeAnchors } from '../engine/anchors';
import { getWorldFootprint } from '../engine/occupancy';
import { useV2BuilderStore } from '../store/builderStore';
import { PartId, PartInstance } from '../types';
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
  } = useV2BuilderStore();
  const groundRef = useRef<THREE.Mesh>(null);

  const updatePreview = (point: THREE.Vector3) => {
    setPreview(
      solvePlacement({
        cursor: [point.x, point.y, point.z],
        activePartId,
        rotationY,
        instances,
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

  useFrame(() => {
    if (!preview && groundRef.current) {
      setPreview(
        solvePlacement({
          cursor: [0, 0, 0],
          activePartId,
          rotationY,
          instances,
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
        </>
      )}
    </group>
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
    toggleGrid,
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
            checked={debugVisuals}
            onChange={toggleDebugVisuals}
            className="h-4 w-4 accent-dune-gold"
          />
          Debug
        </label>
        <div className="ml-2 min-w-44 text-xs text-white/70">
          <div>{instances.length} placed</div>
          <div className={preview?.isValid === false ? 'text-red-300' : 'text-emerald-300'}>
            {preview?.isValid === false ? preview.reasons[0] : preview?.snapped ? 'Edge snap' : 'Grid placement'}
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
      <Toolbar />
    </div>
  );
};

export default BuilderCanvas;
