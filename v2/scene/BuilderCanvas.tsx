import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { PARTS } from '../registry/parts';
import { solvePlacement } from '../engine/snapSolver';
import { getWorldEdgeAnchors } from '../engine/anchors';
import { getWorldFootprint } from '../engine/occupancy';
import {
  BUILD_MODES,
  BuildMode,
  ClaimChunk,
  GROUND_STYLES,
  GroundStyle,
  MAX_CLAIM_CHUNKS,
  MAX_HORIZONTAL_STAKING_UNITS,
  MENU_TABS,
  MenuTab,
  getDefaultPartCategory,
  getEffectiveCategoryMap,
  getTabParts,
  useV2BuilderStore,
} from '../store/builderStore';
import { PartId, PartInstance, PlacementCandidate, Transform2D } from '../types';
import { V2_FOUNDATION_HEIGHT, V2_UNIT_SIZE } from '../constants';
import { V2_BUILD } from '../version';
import { baseDesignFilename, parseBaseDesign, serializeBaseDesign } from '../io/baseDesign';
import { PartMesh } from './PartMesh';

// Renders children with raycasting disabled on the whole subtree. Debug overlays
// are observe-only: if they remain raycastable they hijack the placement cursor
// — either reporting their own (elevated) hit point or, as bare scene geometry,
// shadowing the structure so the ground wins the event. Setting `raycast` to a
// no-op via traversal works uniformly for <line>/<lineLoop>/<mesh> and sidesteps
// the <line>/SVG JSX typing clash that blocks a per-element `raycast` prop.
const NonRaycastableGroup = ({ children }: { children: React.ReactNode }) => {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((object) => {
      object.raycast = () => null;
    });
  });
  return <group ref={ref}>{children}</group>;
};

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
  const outlineY = instance.transform.position[1] + 0.12;

  return (
    <lineLoop>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array(points.flatMap(([x, z]) => [x, outlineY, z])),
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

// Facing indicator for wall/door ghost previews: an arrow pointing outward
// from the outer (_Ext) face plus a faint orange tint over the inner (_Int)
// face, mirroring the game's orange banding. The outer face is local +Z
// (measured from the GLB _Ext/_Int primitives via scripts/inspect-facing.mjs);
// flipped facings are 180° rotations, so rendering in part-local space tracks R.
const FACING_COLOR = '#f97316';

const FacingIndicator = ({
  partId,
  transform,
}: {
  partId: PartId;
  transform: Transform2D;
}) => {
  const part = PARTS[partId];
  if (part.category !== 'wall' && part.category !== 'wall-door') return null;

  const halfWidth = Math.max(...part.footprint.points.map(([x]) => Math.abs(x)));
  const halfDepth = Math.max(...part.footprint.points.map(([, z]) => Math.abs(z)));
  const arrowY = part.height * 0.5;
  const shaftLength = 1.1;
  const headLength = 0.55;
  const shaftStart = halfDepth + 0.2;

  return (
    <group
      position={[transform.position[0], transform.position[1], transform.position[2]]}
      rotation={[0, transform.rotationY, 0]}
    >
      <mesh
        raycast={() => null}
        position={[0, arrowY, shaftStart + shaftLength / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.07, 0.07, shaftLength, 8]} />
        <meshBasicMaterial color={FACING_COLOR} depthTest={false} transparent opacity={0.9} />
      </mesh>
      <mesh
        raycast={() => null}
        position={[0, arrowY, shaftStart + shaftLength + headLength / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <coneGeometry args={[0.24, headLength, 12]} />
        <meshBasicMaterial color={FACING_COLOR} depthTest={false} transparent opacity={0.9} />
      </mesh>
      <mesh
        raycast={() => null}
        position={[0, part.height / 2, -(halfDepth + 0.04)]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[halfWidth * 2 * 0.96, part.height * 0.96]} />
        <meshBasicMaterial
          color={FACING_COLOR}
          transparent
          opacity={0.16}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
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

// Invisible raycast target sitting just above a wall's top edge. The placement
// cursor is the point under the mouse, and the solver uses cursor height to pick
// between stacked snap targets ("point high to build up"). A wall's actual top
// is a thin strip, so aiming at/just above it otherwise sails past to the ground
// behind — making it impossible to stack onto a wall top without the (now
// non-raycastable) debug markers. This catcher gives that intent a real surface.
// Rendered inside the instance's pointer group so a hit drives the cursor.
const TOP_CATCHER_MAX_HEIGHT = V2_FOUNDATION_HEIGHT;

const TopSnapCatcher = ({ instance }: { instance: PartInstance }) => {
  const part = PARTS[instance.partId];
  if (part.occupancyLayer !== 'wall-edge') return null;

  const xs = part.footprint.points.map(([x]) => x);
  const zs = part.footprint.points.map(([, z]) => z);
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const centerZ = (Math.max(...zs) + Math.min(...zs)) / 2;

  const catchHeight = Math.min(part.height, TOP_CATCHER_MAX_HEIGHT);
  const topY = instance.transform.position[1] + part.height;

  // Footprint centre offset, rotated into world space (walls are centred, so this
  // is usually zero, but keep it correct for any off-centre footprint).
  const cos = Math.cos(instance.transform.rotationY);
  const sin = Math.sin(instance.transform.rotationY);
  const worldX = instance.transform.position[0] + centerX * cos + centerZ * sin;
  const worldZ = instance.transform.position[2] - centerX * sin + centerZ * cos;

  return (
    <mesh
      position={[worldX, topY + catchHeight / 2, worldZ]}
      rotation={[0, instance.transform.rotationY, 0]}
    >
      <boxGeometry args={[width, catchHeight, depth]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
};

const CLAIM_CHUNK_SIZE = V2_UNIT_SIZE * 10;
const CLAIM_TIER_HEIGHT = V2_FOUNDATION_HEIGHT * 6;
const CLAIM_COLOR = '#24d8d8';

const ClaimBox = ({
  chunk,
  height,
  showTierSeam,
}: {
  chunk: ClaimChunk;
  height: number;
  showTierSeam: boolean;
}) => {
  const centerX = chunk.x * CLAIM_CHUNK_SIZE;
  const centerZ = chunk.z * CLAIM_CHUNK_SIZE;
  const seamPoints = [
    -CLAIM_CHUNK_SIZE / 2, CLAIM_TIER_HEIGHT - height / 2, -CLAIM_CHUNK_SIZE / 2,
    CLAIM_CHUNK_SIZE / 2, CLAIM_TIER_HEIGHT - height / 2, -CLAIM_CHUNK_SIZE / 2,
    CLAIM_CHUNK_SIZE / 2, CLAIM_TIER_HEIGHT - height / 2, CLAIM_CHUNK_SIZE / 2,
    -CLAIM_CHUNK_SIZE / 2, CLAIM_TIER_HEIGHT - height / 2, CLAIM_CHUNK_SIZE / 2,
  ];

  return (
    <group position={[centerX, height / 2, centerZ]}>
      <mesh>
        <boxGeometry args={[CLAIM_CHUNK_SIZE, height, CLAIM_CHUNK_SIZE]} />
        <meshBasicMaterial
          color={CLAIM_COLOR}
          transparent
          opacity={0.075}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(CLAIM_CHUNK_SIZE, height, CLAIM_CHUNK_SIZE)]} />
        <lineBasicMaterial color={CLAIM_COLOR} transparent opacity={0.42} />
      </lineSegments>
      {showTierSeam && (
        <lineLoop>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(seamPoints), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={CLAIM_COLOR} transparent opacity={0.28} />
        </lineLoop>
      )}
    </group>
  );
};

const ClaimOverlay = () => {
  const claimSettings = useV2BuilderStore((state) => state.claimSettings);
  if (!claimSettings.visible) return null;

  const height = CLAIM_TIER_HEIGHT * (claimSettings.verticalStaking ? 2 : 1);

  return (
    <NonRaycastableGroup>
      {claimSettings.chunks.map((chunk) => (
        <ClaimBox
          key={`${chunk.x},${chunk.z}`}
          chunk={chunk}
          height={height}
          showTierSeam={claimSettings.verticalStaking}
        />
      ))}
    </NonRaycastableGroup>
  );
};

const formatSnapChannel = (channel?: string) => {
  if (channel === 'foundation-structure') return 'Structural';
  if (channel === 'floor-support') return 'Floor';
  if (channel === 'wall-support') return 'Wall';
  return undefined;
};

const GROUND_BASE_COLOR = '#d2b076';

// Ground-plane texture, baked once into a single canvas (no image assets, no
// per-frame cost) and mapped across the plane — constant cost regardless of
// build size, no lights or shadows. 'flat' returns null (use the base color).
//  - gradient:          radial brighter-center → darker-edge across the plane
//  - gradient-focused:  same, but the falloff is pulled in toward the origin
//  - grain:             focused gradient + procedural sand speckle for surface
const createGroundTexture = (style: GroundStyle): THREE.Texture | null => {
  if (style === 'flat') return null;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 'gradient-focused'/'grain' pull the bright core in so the depth cue reads
  // sooner; beyond the radius the gradient clamps to the dark edge color.
  const outerRadius = style === 'gradient' ? size / 2 : size * 0.34;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, outerRadius);
  gradient.addColorStop(0, '#e7c690'); // brighter near the build origin
  gradient.addColorStop(0.5, GROUND_BASE_COLOR); // base sand (the prior flat color)
  gradient.addColorStop(1, '#8a7044'); // darker toward the edges / horizon
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  if (style === 'grain') {
    // Procedural per-pixel noise — generated once, ships no image data.
    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14; // gentle ±7 luminance jitter (toned down)
      data[i] += n;
      data[i + 1] += n;
      data[i + 2] += n;
    }
    ctx.putImageData(image, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const SceneContents = () => {
  const {
    activePartId,
    buildMode,
    copyPiece,
    debugVisuals,
    demolishInstance,
    groundStyle,
    hoveredInstanceId,
    instances,
    placePreview,
    preview,
    replaceInstance,
    rotationY,
    setHoveredInstance,
    setPreview,
  } = useV2BuilderStore();
  const groundRef = useRef<THREE.Mesh>(null);
  const groundTexture = useMemo(() => createGroundTexture(groundStyle), [groundStyle]);
  // Release the previous canvas texture's GPU memory when the style changes.
  useEffect(() => () => groundTexture?.dispose(), [groundTexture]);
  const lastCursorRef = useRef<[number, number, number]>([0, 0, 0]);

  const updatePreview = (point: THREE.Vector3) => {
    lastCursorRef.current = [point.x, point.y, point.z];
    setPreview(
      solvePlacement({
        cursor: lastCursorRef.current,
        activePartId,
        rotationY,
        instances,
      })
    );
  };

  const handleGroundPointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHoveredInstance(null);
    updatePreview(event.point);
  };

  const handleGroundClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    if (buildMode === 'build') placePreview();
  };

  const handleInstancePointerMove = (instanceId: string) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHoveredInstance(instanceId);
    updatePreview(event.point);
  };

  const handleInstanceClick = (instanceId: string) => (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    if (buildMode === 'build') placePreview();
    if (buildMode === 'demolish') demolishInstance(instanceId);
    if (buildMode === 'replace') replaceInstance(instanceId);
  };

  const handleInstancePointerDown = (instanceId: string) => (event: ThreeEvent<PointerEvent>) => {
    // Middle mouse copies the piece, like the game.
    if (event.button !== 1) return;
    event.stopPropagation();
    copyPiece(instanceId);
  };

  const highlightFor = (instanceId: string) => {
    if (hoveredInstanceId !== instanceId) return undefined;
    if (buildMode === 'demolish') return '#ef4444';
    if (buildMode === 'replace') return '#38bdf8';
    return undefined;
  };

  useEffect(() => {
    setPreview(
      solvePlacement({
        cursor: lastCursorRef.current,
        activePartId,
        rotationY,
        instances,
      })
    );
  }, [activePartId, instances, rotationY, setPreview]);

  return (
    <group>
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        onPointerMove={handleGroundPointerMove}
        onClick={handleGroundClick}
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          map={groundTexture}
          color={groundTexture ? '#ffffff' : GROUND_BASE_COLOR}
          roughness={0.95}
        />
      </mesh>
      <ClaimOverlay />
      {/* Part GLBs load inside a Suspense boundary so a first-time load suspends
          only the meshes — never the ground plane above, which owns the pointer
          handlers that drive the placement cursor. (GLBs are also preloaded in
          PartMesh, so this is a safety net rather than the common path.) */}
      <Suspense fallback={null}>
      {/* Placed parts are pointer targets too, so the cursor tracks the surface
          under the mouse instead of the ground hidden behind elevated parts. */}
      {instances.map((instance) => (
        <group
          key={instance.id}
          onPointerMove={handleInstancePointerMove(instance.id)}
          onClick={handleInstanceClick(instance.id)}
          onPointerDown={handleInstancePointerDown(instance.id)}
        >
          <PartMesh
            partId={instance.partId}
            transform={instance.transform}
            debugVisuals={debugVisuals}
            highlightColor={highlightFor(instance.id)}
          />
          <TopSnapCatcher instance={instance} />
        </group>
      ))}
      {/* Debug overlays render OUTSIDE the pointer-handler groups and with
          raycasting disabled: they are observe-only and must never intercept the
          cursor raycast (doing so would let Debug change where pieces snap). */}
      {debugVisuals && (
        <NonRaycastableGroup>
          {instances.map((instance) => (
            <React.Fragment key={`debug-${instance.id}`}>
              <AnchorLines instance={instance} />
              <FootprintOutline instance={instance} />
              <WallEndpointMarkers instance={instance} />
            </React.Fragment>
          ))}
        </NonRaycastableGroup>
      )}
      {preview && buildMode === 'build' && (
        <>
          <PartMesh
            partId={activePartId}
            transform={preview.transform}
            debugVisuals={debugVisuals}
            ghost
            valid={preview.isValid}
          />
          <FacingIndicator partId={activePartId} transform={preview.transform} />
          {debugVisuals && (
            <NonRaycastableGroup>
              <FootprintOutline
                instance={{ id: 'preview', partId: activePartId, transform: preview.transform }}
                color={preview.isValid ? '#59e38a' : '#f05252'}
              />
              <PreviewEdgeDiagnosticsLines
                activePartId={activePartId}
                instances={instances}
                preview={preview}
              />
            </NonRaycastableGroup>
          )}
        </>
      )}
      </Suspense>
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

const TAB_LABELS: Record<MenuTab, string> = {
  all: 'ALL',
  structural: 'STRUCTURAL',
  walls: 'WALLS',
  'wedge-walls': 'WEDGE WALLS',
  roofs: 'ROOFS',
  inclines: 'INCLINES',
  special: 'SPECIAL',
};

const GROUND_STYLE_LABELS: Record<GroundStyle, string> = {
  flat: 'Flat',
  gradient: 'Gradient',
  'gradient-focused': 'Focused',
  grain: 'Grain',
};

const MODE_LABELS: Record<BuildMode, string> = {
  build: 'Build',
  replace: 'Replace',
  customize: 'Customize',
  demolish: 'Demolish',
};

const partLabel = (partId: PartId) => PARTS[partId].name.replace(/^Harkonnen (Level 3 )?/, '');

const SettingsPanel = () => {
  const {
    settingsOpen,
    toggleSettings,
    reverseScrollZoom,
    toggleReverseScrollZoom,
    groundStyle,
    setGroundStyle,
    darkDetail,
    setDarkDetail,
  } = useV2BuilderStore();

  if (!settingsOpen) return null;

  return (
    <div className="absolute right-4 top-4 z-20 max-h-[80vh] w-96 overflow-y-auto rounded-lg border border-white/15 bg-black/90 p-4 text-white shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold uppercase tracking-wide text-dune-gold">Settings</div>
        <button onClick={toggleSettings} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
          Close
        </button>
      </div>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-white/55">Display</div>
        <label className="mt-3 block">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Dark detail</span>
            <span className="font-mono text-xs text-white/55">{darkDetail}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={darkDetail}
            onInput={(event) => setDarkDetail(Number(event.currentTarget.value))}
            onChange={(event) => setDarkDetail(Number(event.target.value))}
            className="w-full accent-dune-gold"
            aria-label="Dark detail"
          />
        </label>
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Ground style</div>
          <div className="flex flex-wrap gap-1">
            {GROUND_STYLES.map((style) => (
              <button
                key={style}
                onClick={() => setGroundStyle(style)}
                className={`h-8 rounded px-2 text-xs font-semibold capitalize transition ${
                  groundStyle === style
                    ? 'bg-dune-gold text-black'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {GROUND_STYLE_LABELS[style]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-white/55">Controls</div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={reverseScrollZoom}
            onChange={toggleReverseScrollZoom}
            className="mt-0.5 h-4 w-4 accent-dune-gold"
          />
          <span>
            <span className="font-semibold">Wheel zooms camera</span>
            <span className="block text-xs leading-4 text-white/45">
              {reverseScrollZoom
                ? 'Wheel zooms; hold Shift + Wheel to cycle pieces.'
                : 'Wheel cycles pieces; hold Shift + Wheel to zoom.'}
            </span>
          </span>
        </label>
      </section>
    </div>
  );
};

const BuildModePanel = () => {
  const { buildMode } = useV2BuilderStore();

  return (
    <div className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-lg border border-white/15 bg-black/70 p-3 text-right text-white shadow-xl backdrop-blur">
      {BUILD_MODES.map((mode) => (
        <div
          key={mode}
          className={`px-2 py-1 text-sm font-semibold ${
            buildMode === mode ? 'text-dune-gold' : 'text-white/45'
          }`}
        >
          {MODE_LABELS[mode]}
        </div>
      ))}
      <div className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-4 text-white/50">
        Right Click: change mode
        <br />
        Left Click: apply
      </div>
    </div>
  );
};

const claimCellKey = (chunk: ClaimChunk) => `${chunk.x},${chunk.z}`;

const claimNeighbors = (chunk: ClaimChunk): ClaimChunk[] => [
  { x: chunk.x, z: chunk.z - 1 },
  { x: chunk.x + 1, z: chunk.z },
  { x: chunk.x, z: chunk.z + 1 },
  { x: chunk.x - 1, z: chunk.z },
];

const ClaimPlannerGrid = () => {
  const {
    addClaimChunk,
    claimSettings,
    removeClaimChunk,
    resetClaim,
    toggleClaimVerticalStaking,
  } = useV2BuilderStore();
  const existingKeys = new Set(claimSettings.chunks.map(claimCellKey));
  const candidateByKey = new Map<string, ClaimChunk>();

  for (const chunk of claimSettings.chunks) {
    for (const neighbor of claimNeighbors(chunk)) {
      const key = claimCellKey(neighbor);
      if (!existingKeys.has(key)) candidateByKey.set(key, neighbor);
    }
  }

  const cells = [...claimSettings.chunks, ...candidateByKey.values()];
  const minX = Math.min(...cells.map((chunk) => chunk.x));
  const maxX = Math.max(...cells.map((chunk) => chunk.x));
  const minZ = Math.min(...cells.map((chunk) => chunk.z));
  const maxZ = Math.max(...cells.map((chunk) => chunk.z));
  const width = maxX - minX + 1;
  const horizontalCount = claimSettings.chunks.length - 1;
  const atHorizontalLimit = claimSettings.chunks.length >= MAX_CLAIM_CHUNKS;
  const totalHeightModules = claimSettings.verticalStaking ? 12 : 6;
  const gridCells: ClaimChunk[] = [];

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      gridCells.push({ x, z });
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-300/15 bg-cyan-950/20 px-3 py-2">
      <div className="flex items-center gap-3">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1.75rem))` }}
        >
          {gridCells.map((chunk) => {
            const key = claimCellKey(chunk);
            const isExisting = existingKeys.has(key);
            const isBase = chunk.x === 0 && chunk.z === 0;
            const isCandidate = candidateByKey.has(key);
            const disabled = !isExisting && (!isCandidate || atHorizontalLimit);
            const label = isBase ? 'B' : isExisting ? '#' : isCandidate ? '+' : '';

            return (
              <button
                key={key}
                onClick={() => (isExisting ? removeClaimChunk(chunk) : addClaimChunk(chunk))}
                disabled={disabled || isBase}
                title={
                  isBase
                    ? 'Base 10x10 claim'
                    : isExisting
                      ? 'Remove staking grid'
                      : isCandidate
                        ? 'Add staking grid'
                        : undefined
                }
                className={`h-7 w-7 rounded border text-[11px] font-black transition ${
                  isBase
                    ? 'border-cyan-200 bg-cyan-200 text-black'
                    : isExisting
                      ? 'border-cyan-300/70 bg-cyan-300/25 text-cyan-100 hover:bg-cyan-300/40'
                      : isCandidate && !atHorizontalLimit
                        ? 'border-dashed border-cyan-300/35 bg-white/5 text-cyan-200 hover:bg-cyan-300/20'
                        : 'border-transparent text-transparent'
                }`}
                style={{ gridColumn: chunk.x - minX + 1, gridRow: chunk.z - minZ + 1 }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="text-[11px] leading-4 text-white/55">
          <div className="font-semibold text-cyan-100">Claim border</div>
          <div>
            {horizontalCount}/{MAX_HORIZONTAL_STAKING_UNITS} staking · {totalHeightModules} high
          </div>
          <div className="text-white/35">Each block is 10x10 floor tiles.</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-8 items-center gap-2 rounded-md bg-white/10 px-2 text-xs font-semibold text-white">
          <input
            type="checkbox"
            checked={claimSettings.verticalStaking}
            onChange={toggleClaimVerticalStaking}
            className="h-4 w-4 accent-cyan-300"
          />
          Vertical
        </label>
        <button
          onClick={resetClaim}
          className="h-8 rounded-md bg-white/10 px-2 text-xs font-semibold text-white hover:bg-white/20"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

const ImportDesignModal = ({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (jsonText: string) => string;
}) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyImport = (text = jsonText) => {
    try {
      const message = onImport(text);
      setError(null);
      onClose();
      return message;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that design.');
      return null;
    }
  };

  const importFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setError('Drop a .json base design file.');
      return;
    }
    const text = await file.text();
    setJsonText(text);
    applyImport(text);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importFile(file);
    event.target.value = '';
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragActive(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      await importFile(file);
      return;
    }

    const droppedText = event.dataTransfer.getData('text/plain');
    if (droppedText.trim()) {
      setJsonText(droppedText);
      applyImport(droppedText);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-[min(92vw,640px)] rounded-lg border p-4 text-white shadow-2xl transition ${
          dragActive
            ? 'border-dune-gold bg-dune-gold/10'
            : 'border-white/15 bg-black/90'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-bold uppercase tracking-wide text-dune-gold">Import Base JSON</div>
          <button onClick={onClose} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
            Close
          </button>
        </div>
        <div
          className={`mb-3 rounded-md border border-dashed px-3 py-4 text-center text-xs transition ${
            dragActive
              ? 'border-dune-gold bg-dune-gold/15 text-dune-gold'
              : 'border-white/20 bg-white/[0.03] text-white/55'
          }`}
        >
          Drop a Dune Builder JSON file here, choose a file, or paste JSON below.
        </div>
        <textarea
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          spellCheck={false}
          className="h-64 w-full resize-none rounded-md border border-white/10 bg-zinc-950 p-3 font-mono text-xs leading-5 text-white outline-none focus:border-dune-gold"
          placeholder="{"
        />
        {error && (
          <div className="mt-2 rounded border border-red-400/25 bg-red-950/50 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyImport()}
            className="h-9 rounded-md bg-dune-gold px-3 text-sm font-semibold text-black hover:bg-yellow-300"
          >
            Import Design
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-9 rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20"
          >
            Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="ml-auto text-xs text-white/45">Import replaces the current placed parts.</div>
        </div>
      </div>
    </div>,
    document.body
  );
};

type InfoTab = 'features' | 'roadmap' | 'feedback';
type FeedbackType = 'bug' | 'placement' | 'missing-part' | 'idea';

const FEATURE_SECTIONS = [
  {
    title: 'Build Planning',
    items: [
      '3D Dune: Awakening base planner using real Harkonnen build-piece models.',
      'Connection-first placement, so pieces attach to other pieces instead of a world grid.',
      'Build, Replace, Customize, and Demolish modes for laying out and revising a base.',
    ],
  },
  {
    title: 'Planning Tools',
    items: [
      'Claim overlay for planning Subfief, staking-unit, and vertical staking-unit space.',
      'JSON import/export so bases can be saved, shared, and used as starter layouts.',
      'Orbit, pan, and wheel zoom for inspecting builds from any angle.',
    ],
  },
];

const ROADMAP_SECTIONS = [
  {
    title: 'More Parts',
    items: [
      'Roof pieces, curved pieces, pillars, railings, ladders, gates, and more Harkonnen parts.',
      'Better organization as more in-game pieces are added.',
    ],
  },
  {
    title: 'Placement',
    items: [
      'Better stair, ramp, roof, and stacked-foundation behavior.',
      'Clearer vertical controls for choosing the intended story/height.',
    ],
  },
  {
    title: 'Sharing',
    items: [
      'Autosave, named saved designs, and starter-base examples.',
      'Optional buildability warnings for issues like pieces outside a claim plan.',
      'Direct feedback submission when a backend is available.',
    ],
  },
];

const CURRENT_LIMITATIONS = [
  'Some Harkonnen parts are still being added.',
  'Roofs, curved pieces, and saved-design libraries are not finished yet.',
  'Claim overlay settings are local planning aids and are not included in exported base JSON.',
];

const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  placement: 'Placement issue',
  'missing-part': 'Missing part',
  idea: 'Idea',
};

const AboutFeedbackModal = ({ onClose }: { onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<InfoTab>('features');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [steps, setSteps] = useState('');
  const [contact, setContact] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);

  const report = useMemo(() => {
    return {
      appBuild: V2_BUILD.id,
      type: feedbackType,
      summary,
      details,
      steps,
      contact,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      createdAt: new Date().toISOString(),
    };
  }, [contact, details, feedbackType, steps, summary]);

  const reportText = JSON.stringify(report, null, 2);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setFeedbackStatus('Copied feedback');
    } catch {
      setFeedbackStatus('Copy failed; use Download Feedback instead');
    }
  };

  const downloadReport = () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const blob = new Blob([`${reportText}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `arx-studio-feedback-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedbackStatus('Downloaded feedback');
  };

  return createPortal(
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-[min(94vw,980px)] flex-col overflow-hidden rounded-lg border border-white/15 bg-black/92 text-white shadow-2xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold uppercase tracking-wide text-dune-gold">About Arx Studio</div>
            <div className="break-words text-xs text-white/45">{V2_BUILD.id} · public preview</div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
            Close
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-3">
          {(['features', 'roadmap', 'feedback'] as InfoTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-8 rounded-md px-3 text-xs font-bold uppercase tracking-wide ${
                activeTab === tab
                  ? 'bg-dune-gold text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {tab === 'feedback' ? 'Feedback' : tab}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {activeTab === 'features' && (
            <div className="grid gap-4 md:grid-cols-2">
              {FEATURE_SECTIONS.map((section) => (
                <section key={section.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-sm font-bold text-dune-gold">{section.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-5 text-white/70">
                    {section.items.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </section>
              ))}
              <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-sm font-bold text-dune-gold">Current Limitations</h3>
                <ul className="mt-3 space-y-2 text-sm leading-5 text-white/70">
                  {CURRENT_LIMITATIONS.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {activeTab === 'roadmap' && (
            <div className="grid gap-4 md:grid-cols-3">
              {ROADMAP_SECTIONS.map((section) => (
                <section key={section.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-sm font-bold text-dune-gold">{section.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-5 text-white/70">
                    {section.items.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-white/50">
                  Report type
                  <select
                    value={feedbackType}
                    onChange={(event) => setFeedbackType(event.target.value as FeedbackType)}
                    className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-dune-gold"
                  >
                    {Object.entries(FEEDBACK_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value} className="bg-zinc-950">
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-white/50">
                  Short summary
                  <input
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-dune-gold"
                    placeholder="Wall snapped to the wrong height"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-white/50">
                  What happened?
                  <textarea
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    className="mt-1 h-24 w-full resize-none rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case leading-5 text-white outline-none focus:border-dune-gold"
                    placeholder="Describe what you saw and what you expected."
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-white/50">
                  Steps to reproduce
                  <textarea
                    value={steps}
                    onChange={(event) => setSteps(event.target.value)}
                    className="mt-1 h-24 w-full resize-none rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case leading-5 text-white outline-none focus:border-dune-gold"
                    placeholder="1. Place a foundation. 2. Select wall. 3. Hover near..."
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-white/50">
                  Contact or Discord name
                  <input
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-dune-gold"
                    placeholder="Optional"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-sm font-bold text-dune-gold">Report Package</h3>
                <p className="mt-2 text-xs leading-4 text-white/55">
                  Feedback is not sent automatically yet. Copy or download this report and share it with a screenshot or exported base JSON.
                </p>
                <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-zinc-950 p-3 text-[10px] leading-4 text-white/55">
                  {reportText}
                </pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={copyReport}
                    className="h-9 rounded-md bg-dune-gold px-3 text-sm font-semibold text-black hover:bg-yellow-300"
                  >
                    Copy Feedback
                  </button>
                  <button
                    onClick={downloadReport}
                    className="h-9 rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20"
                  >
                    Download Feedback
                  </button>
                </div>
                {feedbackStatus && <div className="mt-2 text-xs text-emerald-300">{feedbackStatus}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const WORM_GRID_WIDTH = 14;
const WORM_GRID_HEIGHT = 10;
type WormDirection = 'up' | 'right' | 'down' | 'left';
type WormCell = { x: number; y: number };

const wormKey = (cell: WormCell) => `${cell.x},${cell.y}`;

const randomSpiceCell = (worm: WormCell[]) => {
  const occupied = new Set(worm.map(wormKey));
  const open: WormCell[] = [];
  for (let y = 0; y < WORM_GRID_HEIGHT; y += 1) {
    for (let x = 0; x < WORM_GRID_WIDTH; x += 1) {
      const cell = { x, y };
      if (!occupied.has(wormKey(cell))) open.push(cell);
    }
  }
  return open[Math.floor(Math.random() * open.length)] ?? { x: 1, y: 1 };
};

const INITIAL_WORM: WormCell[] = [
  { x: 5, y: 5 },
  { x: 4, y: 5 },
  { x: 3, y: 5 },
];

const nextWormHead = (head: WormCell, direction: WormDirection): WormCell => {
  if (direction === 'up') return { x: head.x, y: (head.y - 1 + WORM_GRID_HEIGHT) % WORM_GRID_HEIGHT };
  if (direction === 'down') return { x: head.x, y: (head.y + 1) % WORM_GRID_HEIGHT };
  if (direction === 'left') return { x: (head.x - 1 + WORM_GRID_WIDTH) % WORM_GRID_WIDTH, y: head.y };
  return { x: (head.x + 1) % WORM_GRID_WIDTH, y: head.y };
};

const isReverseDirection = (current: WormDirection, next: WormDirection) =>
  (current === 'up' && next === 'down') ||
  (current === 'down' && next === 'up') ||
  (current === 'left' && next === 'right') ||
  (current === 'right' && next === 'left');

const SandwormSnake = () => {
  const [worm, setWorm] = useState<WormCell[]>(INITIAL_WORM);
  const [direction, setDirection] = useState<WormDirection>('right');
  const [spice, setSpice] = useState<WormCell>(() => randomSpiceCell(INITIAL_WORM));
  const [running, setRunning] = useState(false);
  const [lost, setLost] = useState(false);
  const [score, setScore] = useState(0);

  const reset = () => {
    setWorm(INITIAL_WORM);
    setDirection('right');
    setSpice(randomSpiceCell(INITIAL_WORM));
    setRunning(false);
    setLost(false);
    setScore(0);
  };

  const turn = (next: WormDirection) => {
    setDirection((current) => (isReverseDirection(current, next) ? current : next));
    if (!lost) setRunning(true);
  };

  useEffect(() => {
    if (!running || lost) return;
    const timer = window.setInterval(() => {
      setWorm((current) => {
        const head = nextWormHead(current[0], direction);
        const ateSpice = head.x === spice.x && head.y === spice.y;
        const bodyToCheck = ateSpice ? current : current.slice(0, -1);

        if (bodyToCheck.some((cell) => cell.x === head.x && cell.y === head.y)) {
          setRunning(false);
          setLost(true);
          return current;
        }

        const next = [head, ...current];
        if (ateSpice) {
          setScore((value) => value + 1);
          setSpice(randomSpiceCell(next));
          return next;
        }

        next.pop();
        return next;
      });
    }, 180);

    return () => window.clearInterval(timer);
  }, [direction, lost, running, spice]);

  const wormCells = new Set(worm.map(wormKey));
  const headKey = wormKey(worm[0]);
  const spiceKey = wormKey(spice);

  const cells: WormCell[] = [];
  for (let y = 0; y < WORM_GRID_HEIGHT; y += 1) {
    for (let x = 0; x < WORM_GRID_WIDTH; x += 1) cells.push({ x, y });
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') turn('up');
    if (event.key === 'ArrowRight') turn('right');
    if (event.key === 'ArrowDown') turn('down');
    if (event.key === 'ArrowLeft') turn('left');
    if (event.key === ' ') setRunning((value) => !value);
    event.stopPropagation();
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="mb-3 rounded-lg border border-dune-gold/20 bg-amber-950/20 p-3 outline-none focus:border-dune-gold/60"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-dune-gold">Sandworm Snake</div>
          <div className="text-[10px] text-white/40">Score {score}{lost ? ' · swallowed itself' : ''}</div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setRunning((value) => !value)}
            className="rounded bg-dune-gold px-2 py-1 text-[11px] font-bold text-black"
          >
            {running ? 'Pause' : 'Start'}
          </button>
          <button onClick={reset} className="rounded bg-white/10 px-2 py-1 text-[11px] font-semibold hover:bg-white/20">
            Reset
          </button>
        </div>
      </div>
      <div
        className="grid gap-0.5 rounded bg-black/35 p-1"
        style={{ gridTemplateColumns: `repeat(${WORM_GRID_WIDTH}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const key = wormKey(cell);
          const isHead = key === headKey;
          const isWorm = wormCells.has(key);
          const isSpice = key === spiceKey;
          return (
            <div
              key={key}
              className={`aspect-square rounded-sm ${
                isHead
                  ? 'bg-dune-gold'
                  : isWorm
                    ? 'bg-amber-700'
                    : isSpice
                      ? 'bg-cyan-300'
                      : 'bg-white/[0.05]'
              }`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-center gap-1">
        {[
          ['up', '^'],
          ['left', '<'],
          ['down', 'v'],
          ['right', '>'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => turn(value as WormDirection)}
            className="h-7 w-8 rounded bg-white/10 text-xs font-bold text-white/70 hover:bg-white/20"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

const AdminPanel = () => {
  const {
    adminOpen,
    categoryOverrides,
    setCategoryOverride,
    toggleAdmin,
    adminHueEnabled,
    adminHue,
    setAdminHueEnabled,
    setAdminHue,
  } = useV2BuilderStore();
  const [masterCopied, setMasterCopied] = useState(false);

  if (!adminOpen) return null;

  const categories = MENU_TABS.filter((tab): tab is Exclude<MenuTab, 'all'> => tab !== 'all');

  const copyMasterJson = async () => {
    const json = JSON.stringify(getEffectiveCategoryMap(categoryOverrides), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setMasterCopied(true);
      setTimeout(() => setMasterCopied(false), 2500);
    } catch {
      // Clipboard unavailable (e.g. insecure context); show the JSON instead.
      window.prompt('Copy the master category JSON:', json);
    }
  };

  return (
    <div className="absolute right-4 top-4 z-20 max-h-[80vh] w-96 overflow-y-auto rounded-lg border border-white/15 bg-black/90 p-4 text-white shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold uppercase tracking-wide text-dune-gold">Admin · Part Registry</div>
        <button onClick={toggleAdmin} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
          Close
        </button>
      </div>
      <div className="mb-2 text-[11px] leading-4 text-white/55">
        Assign each piece to its in-game build-menu category. Changes save to this browser immediately and
        persist across sessions; an asterisk marks pieces moved from the shipped master organization.
      </div>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={copyMasterJson}
          className="rounded bg-dune-gold/20 px-2 py-1 text-[11px] font-semibold text-dune-gold hover:bg-dune-gold/30"
        >
          {masterCopied ? 'Copied!' : 'Copy Master JSON'}
        </button>
        <span className="text-[10px] leading-3 text-white/40">
          Paste into v2/registry/categoryMaster.ts and deploy to make this the default for everyone.
        </span>
      </div>
      <div className="mb-3 border-t border-white/10 pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/55">Experimental</div>
        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={adminHueEnabled}
            onChange={(event) => setAdminHueEnabled(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-dune-gold"
          />
          <span>
            <span className="font-semibold">Spectrum tint</span>
            <span className="block text-[10px] leading-4 text-white/45">
              Hidden color wash for Harkonnen exterior materials.
            </span>
          </span>
        </label>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold">Hue</div>
            <div className="font-mono text-[10px] text-white/45">{adminHue}°</div>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={adminHue}
            onInput={(event) => setAdminHue(Number(event.currentTarget.value))}
            onChange={(event) => setAdminHue(Number(event.target.value))}
            className="w-full accent-dune-gold"
            aria-label="Spectrum hue"
          />
          <button
            onClick={() => setAdminHueEnabled(false)}
            className="mt-2 rounded bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/60 hover:bg-white/20 hover:text-white"
          >
            Reset normal color
          </button>
        </div>
      </div>
      <SandwormSnake />
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-white/40">
            <th className="pb-1 font-semibold">Piece</th>
            <th className="pb-1 font-semibold">Category</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(PARTS).map((part) => (
            <tr key={part.id} className="border-t border-white/10">
              <td className="py-1.5 pr-2">
                <div className="font-semibold">
                  {partLabel(part.id)}
                  {categoryOverrides[part.id] ? ' *' : ''}
                </div>
                <div className="text-[10px] text-white/35">{part.id}</div>
              </td>
              <td className="py-1.5">
                <select
                  value={categoryOverrides[part.id] ?? getDefaultPartCategory(part.id)}
                  onChange={(event) =>
                    setCategoryOverride(part.id, event.target.value as Exclude<MenuTab, 'all'>)
                  }
                  className="w-full rounded bg-white/10 px-2 py-1 text-xs text-white"
                >
                  {categories.map((category) => (
                    <option key={category} value={category} className="bg-zinc-900">
                      {TAB_LABELS[category]}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Toolbar = () => {
  const {
    activePartId,
    activeTab,
    buildMode,
    categoryOverrides,
    claimSettings,
    clear,
    controlsUnlocked,
    cycleActivePart,
    cycleTab,
    debugVisuals,
    importDesign,
    instances,
    menuExpanded,
    preview,
    rotateActivePart,
    rotationY,
    reverseScrollZoom,
    setActivePartId,
    setActiveTab,
    toggleDebugVisuals,
    toggleClaimOverlay,
    toggleAdmin,
    toggleMenuExpanded,
    toggleSettings,
    unlockControls,
  } = useV2BuilderStore();
  const [claimPlannerOpen, setClaimPlannerOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [designStatus, setDesignStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!designStatus) return;
    const timeout = window.setTimeout(() => setDesignStatus(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [designStatus]);

  // Debug + Admin are hidden until this Sega-Genesis-style code is entered.
  const unlockComboRef = useRef<string[]>([]);

  // Cheat code: in Customize mode, tap the square Foundation 7× to unlock too.
  const foundationTapsRef = useRef(0);
  const handlePartClick = (partId: PartId) => {
    setActivePartId(partId);
    if (buildMode === 'customize' && partId === 'foundation.harkonnen.level3.square') {
      foundationTapsRef.current += 1;
      if (foundationTapsRef.current >= 7) {
        foundationTapsRef.current = 0;
        unlockControls();
      }
    } else {
      foundationTapsRef.current = 0;
    }
  };

  useEffect(() => {
    const UNLOCK_COMBO = ['a', 'b', 'a', 'c', 'a', 'b', 'b'];
    const isComboPrefix = (keys: string[]) =>
      keys.every((key, index) => UNLOCK_COMBO[index] === key);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();

      // Track the longest tail of recent keys that is still a prefix of the combo.
      let progress = [...unlockComboRef.current, key];
      while (progress.length && !isComboPrefix(progress)) progress = progress.slice(1);
      unlockComboRef.current = progress;

      if (progress.length === UNLOCK_COMBO.length) {
        unlockComboRef.current = [];
        unlockControls();
        return;
      }

      // While a combo is in progress (≥2 keys deep) the keypress belongs to the
      // code, so its normal action (notably B toggling the menu) is suppressed —
      // no flicker while entering it. A lone B etc. still works normally.
      if (progress.length >= 2) return;

      if (key === 'r') rotateActivePart();
      if (key === 'q') cycleTab(-1);
      if (key === 'e') cycleTab(1);
      if (key === 'b') toggleMenuExpanded();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycleTab, rotateActivePart, toggleMenuExpanded, unlockControls]);

  useEffect(() => {
    // By default the wheel cycles pieces (Shift+Wheel zooms), like the game. The
    // Admin "Reverse scroll wheel" option swaps these so the bare wheel zooms.
    const handleWheel = (event: WheelEvent) => {
      // Cycle when the Shift state matches the cycle gesture; otherwise let
      // OrbitControls handle zoom.
      if (event.shiftKey !== reverseScrollZoom) return;
      event.preventDefault();
      cycleActivePart(event.deltaY > 0 ? 1 : -1);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [cycleActivePart, reverseScrollZoom]);

  const tabParts = getTabParts(activeTab, categoryOverrides);

  const handleExportDesign = () => {
    const json = serializeBaseDesign(instances);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = baseDesignFilename();
    link.click();
    URL.revokeObjectURL(url);
    setDesignStatus(`Exported ${instances.length} ${instances.length === 1 ? 'part' : 'parts'}`);
  };

  const handleImportDesign = (jsonText: string) => {
    const parsed = parseBaseDesign(jsonText);
    importDesign(parsed.instances);
    const message = `Imported ${parsed.instances.length} ${parsed.instances.length === 1 ? 'part' : 'parts'}`;
    setDesignStatus(message);
    return message;
  };

  if (!menuExpanded) {
    return (
      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto rounded-lg border border-white/15 bg-black/75 px-4 py-2 text-xs text-white/70 shadow-2xl backdrop-blur">
          <span className="font-semibold text-dune-gold">{MODE_LABELS[buildMode]}</span>
          {' · '}
          {partLabel(activePartId)} · Press B for the build menu
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex w-[min(96vw,1280px)] flex-col gap-3 rounded-xl border border-white/15 bg-black/80 px-4 py-3 text-white shadow-2xl backdrop-blur">
        {importModalOpen && (
          <ImportDesignModal
            onClose={() => setImportModalOpen(false)}
            onImport={handleImportDesign}
          />
        )}
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/50">Q</span>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-1">
            {MENU_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`h-8 rounded-md px-3 text-xs font-bold tracking-wide transition ${
                  activeTab === tab
                    ? 'bg-dune-gold text-black shadow'
                    : 'bg-white/5 text-white/60 hover:bg-white/15 hover:text-white'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/50">E</span>
        </div>

        <div className="flex min-h-[2.5rem] flex-wrap items-center justify-center gap-2 rounded-lg bg-white/[0.03] px-2 py-2">
          {tabParts.length === 0 ? (
            <div className="px-4 py-2 text-xs italic text-white/40">No pieces in this category yet</div>
          ) : (
            tabParts.map((partId) => (
              <button
                key={partId}
                onClick={() => handlePartClick(partId)}
                className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
                  activePartId === partId
                    ? 'bg-dune-gold text-black shadow'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {partLabel(partId)}
              </button>
            ))
          )}
        </div>

        {claimPlannerOpen && <ClaimPlannerGrid />}

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <button
            onClick={rotateActivePart}
            className="h-9 rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20"
          >
            Rotate {Math.round((rotationY * 180) / Math.PI)}°
          </button>
          <button
            onClick={clear}
            className="h-9 rounded-md bg-red-950/70 px-3 text-sm font-semibold text-red-100 hover:bg-red-900"
          >
            Clear
          </button>
          <button
            onClick={handleExportDesign}
            className="h-9 rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20"
          >
            Export JSON
          </button>
          <button
            onClick={() => setImportModalOpen(true)}
            className="h-9 rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20"
          >
            Import JSON
          </button>
          <button
            onClick={toggleSettings}
            className="h-9 rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20"
          >
            Settings
          </button>
          <label className="flex h-9 items-center gap-2 rounded-md bg-cyan-950/60 px-3 text-sm font-semibold text-cyan-100">
            <input
              type="checkbox"
              checked={claimSettings.visible}
              onChange={toggleClaimOverlay}
              className="h-4 w-4 accent-cyan-300"
            />
            Claim
          </label>
          <button
            onClick={() => setClaimPlannerOpen((value) => !value)}
            className={`h-9 rounded-md px-3 text-sm font-semibold transition ${
              claimPlannerOpen
                ? 'bg-cyan-300 text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Plan Claim
          </button>
          {controlsUnlocked && (
            <>
              <label className="flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-semibold text-white">
                <input
                  type="checkbox"
                  checked={debugVisuals}
                  onChange={toggleDebugVisuals}
                  className="h-4 w-4 accent-dune-gold"
                />
                Debug
              </label>
              <button
                onClick={toggleAdmin}
                className="h-9 rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Admin
              </button>
            </>
          )}
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-white/60">
              {instances.length} placed · <span className="font-semibold text-dune-gold">{MODE_LABELS[buildMode]}</span>
            </span>
            <span className={preview?.isValid === false ? 'text-red-300' : 'text-emerald-300'}>
              {designStatus ??
                (buildMode === 'demolish'
                ? 'Click a piece to demolish'
                : buildMode === 'replace'
                  ? 'Click a wall piece to swap it'
                  : buildMode === 'customize'
                    ? 'Customize is not implemented yet'
                    : preview?.isValid === false
                      ? preview.reasons[0]
                      : preview?.placementMode === 'wall-run'
                        ? 'Wall run'
                        : preview?.placementMode === 'support-edge'
                          ? `Support edge${formatSnapChannel(preview.binding?.snapChannel) ? `: ${formatSnapChannel(preview.binding?.snapChannel)}` : ''}`
                          : 'Free placement')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CONTROL_ROWS: { keys: string; action: string }[] = [
  { keys: 'Left Click', action: 'Apply current mode' },
  { keys: 'Right Click', action: 'Cycle build modes' },
  { keys: 'R', action: 'Rotate piece' },
  { keys: 'Q / E', action: 'Switch categories' },
  { keys: 'Wheel', action: 'Cycle pieces' },
  { keys: 'Middle Click', action: 'Copy a piece' },
  { keys: 'B', action: 'Toggle build menu' },
  { keys: 'Middle-drag', action: 'Orbit' },
  { keys: 'Left-drag', action: 'Pan' },
];

const ControlsPanel = ({ reverseScrollZoom }: { reverseScrollZoom: boolean }) => {
  const [open, setOpen] = useState(false);

  const rows = [
    ...CONTROL_ROWS,
    reverseScrollZoom
      ? { keys: 'Wheel / Shift+Wheel', action: 'Zoom / cycle pieces' }
      : { keys: 'Shift+Wheel', action: 'Zoom' },
  ];

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-10 w-72 overflow-hidden rounded-lg border border-white/15 bg-black/70 text-white shadow-xl backdrop-blur">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-white/5"
      >
        <span className="text-sm font-bold uppercase tracking-wide text-dune-gold">V2 Placement Engine</span>
        <svg
          className={`h-4 w-4 shrink-0 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="text-[11px] leading-4 text-white/60">
            Real Harkonnen parts; the first placed piece establishes the build grid.
          </div>
          <dl className="mt-3 space-y-1.5">
            {rows.map((row) => (
              <div key={row.keys} className="flex items-baseline justify-between gap-3 text-xs">
                <dt className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wide text-dune-gold/90">
                  {row.keys}
                </dt>
                <dd className="text-right text-white/70">{row.action}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-4 text-white/45">
            <div className="font-semibold text-white/60">{V2_BUILD.id}</div>
            <div>{V2_BUILD.description}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export const BuilderCanvas = () => {
  const cycleBuildMode = useV2BuilderStore((state) => state.cycleBuildMode);
  const reverseScrollZoom = useV2BuilderStore((state) => state.reverseScrollZoom);
  const [shiftHeld, setShiftHeld] = useState(false);
  // Default: zoom requires Shift. Reversed: zoom is the bare wheel (no Shift).
  const zoomEnabled = reverseScrollZoom ? !shiftHeld : shiftHeld;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => setShiftHeld(event.shiftKey);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  return (
    <div
      className="relative h-screen w-full bg-black"
      onContextMenu={(event) => {
        event.preventDefault();
        cycleBuildMode();
      }}
    >
      {/* frameloop="demand" renders only when something changes (controls move,
          state updates) instead of every frame — idle/typing no longer competes
          with a constant render loop. dpr is capped so high-DPI displays don't
          pay 3-4x the fragment cost on the large ground plane at grazing angles. */}
      <Canvas frameloop="demand" dpr={[1, 2]} camera={{ position: [10, 12, 10], fov: 50 }}>
        <color attach="background" args={['#111827']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 20, 10]} intensity={1.1} />
        <SceneContents />
        <OrbitControls
          makeDefault
          maxPolarAngle={Math.PI / 2 - 0.05}
          enableZoom={zoomEnabled}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE }}
        />
      </Canvas>
      <ControlsPanel reverseScrollZoom={reverseScrollZoom} />
      <PlacementDebugPanel />
      <BuildModePanel />
      <SettingsPanel />
      <AdminPanel />
      <Toolbar />
    </div>
  );
};

export default BuilderCanvas;
