import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
  BuildingType,
  BuildingData,
  BuildingPalette,
  EdgeRole,
  UNIT_SIZE,
  FOUNDATION_HEIGHT,
  TRIANGLE_RADIUS,
  TRIANGLE_APOTHEM,
  WALL_HEIGHT,
  HALF_WALL_HEIGHT,
} from '../types';
import {
  calculateSnap,
  getWorldSockets,
  getLocalSockets,
  getWorldEdgeSockets,
  getCompatibleSocketTypes,
  usesEdgeSockets as utilUsesEdgeSockets,
} from '../utils/geometry';
import type { PreferredSnapTarget } from '../utils/geometry';
import {
  createCurvedFoundationShape,
  createCurvedWallShape,
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
import { useGameStore } from '../store/gameStore';
import { getRotationIncrement, getYOffsetFromRegistry } from '../data/BuildingRegistry';
import { PALETTES } from '../data/palettes';

// Edge color constant (not part of palette)
const EDGE_COLOR = 'black';

// Wall thickness
const WALL_THICKNESS = 0.2;

interface MaterialsType {
  ghost: THREE.MeshBasicMaterial;
  error: THREE.MeshBasicMaterial;
}

// SceneProps removed - components now use useGameStore directly

interface BuildingMeshProps {
  type: BuildingType;
  position: [number, number, number];
  rotation: [number, number, number];
  isGhost?: boolean;
  isValid?: boolean;
  id?: string;
  wireframe?: boolean;
  highlight?: boolean;
  materials: MaterialsType;
  palette: BuildingPalette;
}

/**
 * Returns the Y offset for a building type (how high above placement point the center is)
 */
function getYOffset(type: BuildingType): number {
  return getYOffsetFromRegistry(type);
}

/**
 * Determines if a building type uses a group wrapper (complex geometry)
 * These types handle their own positioning and cannot use simplified ghost geometry
 */
function usesGroupWrapper(type: BuildingType): boolean {
  return [
    BuildingType.CURVED_FOUNDATION,
    BuildingType.CURVED_STRUCTURE,
    BuildingType.WINDOW_WALL,
    BuildingType.DOORWAY,
    BuildingType.CURVED_WALL,
    BuildingType.CURVED_HALF_WALL,
    BuildingType.SQUARE_ROOF,
    BuildingType.TRIANGLE_ROOF,
    BuildingType.STAIRS,
    BuildingType.STAIRS_2,
    BuildingType.RAMP,
  ].includes(type);
}

/**
 * Gets the ghost material based on validity
 */
function getGhostMaterial(materials: MaterialsType, isValid: boolean): THREE.MeshBasicMaterial {
  return isValid ? materials.ghost : materials.error;
}

function getHighlightProps(highlight?: boolean) {
  return highlight
    ? { emissive: '#FFD54A', emissiveIntensity: 0.6 }
    : {};
}

function getBuildingRootFromObject(object: THREE.Object3D | null): THREE.Object3D | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const data = current.userData as { buildingId?: string; id?: string; isBuilding?: boolean } | undefined;
    if (data?.buildingId || data?.isBuilding) return current;
    current = current.parent;
  }
  return null;
}

// =============================================================================
// Individual Building Geometry Components
// =============================================================================

interface GeometryProps {
  wireframe?: boolean;
  isGhost?: boolean;
  isValid?: boolean;
  highlight?: boolean;
  materials: MaterialsType;
  palette: BuildingPalette;
}

const SquareFoundation = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => (
  <>
    <boxGeometry args={[UNIT_SIZE, FOUNDATION_HEIGHT, UNIT_SIZE]} />
    {isGhost ? (
      <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
    ) : (
      <meshStandardMaterial
        color={palette.foundation}
        roughness={0.8}
        wireframe={wireframe}
        {...getHighlightProps(highlight)}
      />
    )}
    {!isGhost && (
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(UNIT_SIZE, FOUNDATION_HEIGHT, UNIT_SIZE)]} />
        <meshBasicMaterial color={EDGE_COLOR} />
      </lineSegments>
    )}
  </>
);

const TriangleFoundation = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
  // Custom triangle geometry with FLAT BASE at BOTTOM of screen, apex at TOP
  //
  // In 2D mode, camera looks down from Y+. On screen:
  // - BOTTOM of screen = +Z direction (where red North arrow points)
  // - TOP of screen = -Z direction
  // - RIGHT = +X (blue East arrow)
  // - LEFT = -X
  //
  // We want the triangle to "sit" on the grid like a pyramid:
  // - FLAT BASE at +Z (bottom of screen) = connects to grid/other edges
  // - APEX pointing toward -Z (top of screen)
  //
  // Vertices (with center at origin):
  // - vApex:  (0, 0, -TRIANGLE_RADIUS)           = apex pointing south (TOP of screen)
  // - vLeft:  (-UNIT_SIZE/2, 0, +TRIANGLE_APOTHEM) = base left corner (BOTTOM-left)
  // - vRight: (+UNIT_SIZE/2, 0, +TRIANGLE_APOTHEM) = base right corner (BOTTOM-right)

  const geometry = useMemo(() => {
    const halfSize = UNIT_SIZE / 2;
    const apexZ = -TRIANGLE_RADIUS;     // -2.31 = south (TOP of screen)
    const baseZ = TRIANGLE_APOTHEM;     // +1.15 = north (BOTTOM of screen)
    const halfHeight = FOUNDATION_HEIGHT / 2;

    // Vertices: apex at -Z (south/top of screen), base corners at +Z (north/bottom of screen)
    // Top face (y = +halfHeight)
    const topApex = [0, halfHeight, apexZ];
    const topLeft = [-halfSize, halfHeight, baseZ];
    const topRight = [halfSize, halfHeight, baseZ];

    // Bottom face (y = -halfHeight)
    const botApex = [0, -halfHeight, apexZ];
    const botLeft = [-halfSize, -halfHeight, baseZ];
    const botRight = [halfSize, -halfHeight, baseZ];

    // Create BufferGeometry with triangles
    // Winding order: counterclockwise when viewed from outside
    const vertices = new Float32Array([
      // Top face (viewed from above, counterclockwise: apex -> left -> right)
      ...topApex, ...topLeft, ...topRight,

      // Bottom face (viewed from below, counterclockwise: apex -> right -> left)
      ...botApex, ...botRight, ...botLeft,

      // North face (BASE edge at +Z, bottom of screen) - two triangles
      ...topRight, ...topLeft, ...botLeft,
      ...topRight, ...botLeft, ...botRight,

      // Southwest face (LEFT edge) - two triangles
      ...topLeft, ...topApex, ...botApex,
      ...topLeft, ...botApex, ...botLeft,

      // Southeast face (RIGHT edge) - two triangles
      ...topApex, ...topRight, ...botRight,
      ...topApex, ...botRight, ...botApex,
    ]);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();

    return geom;
  }, []);

  const edgeGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(geometry);
  }, [geometry]);

  return (
    <>
      <primitive object={geometry} attach="geometry" />
      {isGhost ? (
        <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
      ) : (
        <meshStandardMaterial
          color={palette.foundation}
          roughness={0.8}
          wireframe={wireframe}
          {...getHighlightProps(highlight)}
        />
      )}
      {!isGhost && (
        <lineSegments>
          <primitive object={edgeGeometry} attach="geometry" />
          <meshBasicMaterial color={EDGE_COLOR} />
        </lineSegments>
      )}
    </>
  );
};

const CurvedFoundation = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
  const shape = useMemo(() => createCurvedFoundationShape(), []);
  const extrudeSettings = useMemo(() => ({ depth: FOUNDATION_HEIGHT, bevelEnabled: false }), []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -FOUNDATION_HEIGHT / 2, 0]}>
      <mesh>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial
            color={palette.foundation}
            roughness={0.8}
            wireframe={wireframe}
            {...getHighlightProps(highlight)}
          />
        )}
      </mesh>
    </group>
  );
};

const CurvedWall = ({
  wireframe,
  isGhost,
  isValid = true,
  highlight,
  materials,
  palette,
  height,
}: GeometryProps & { height: number }) => {
  const shape = useMemo(() => createCurvedWallShape(WALL_THICKNESS), []);
  const extrudeSettings = useMemo(() => ({ depth: height, bevelEnabled: false }), [height]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -height / 2, 0]}>
      <mesh>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial
            color={palette.wallExterior}
            roughness={0.9}
            wireframe={wireframe}
            {...getHighlightProps(highlight)}
          />
        )}
      </mesh>
    </group>
  );
};

// =============================================================================
// Structure Components (Raised Platform Foundations - WALL_HEIGHT tall)
// =============================================================================

const SquareStructure = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => (
  <>
    <boxGeometry args={[UNIT_SIZE, WALL_HEIGHT, UNIT_SIZE]} />
    {isGhost ? (
      <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
    ) : (
      <meshStandardMaterial
        color={palette.foundation}
        roughness={0.8}
        wireframe={wireframe}
        {...getHighlightProps(highlight)}
      />
    )}
    {!isGhost && (
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(UNIT_SIZE, WALL_HEIGHT, UNIT_SIZE)]} />
        <meshBasicMaterial color={EDGE_COLOR} />
      </lineSegments>
    )}
  </>
);

const TriangleStructure = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
  // Same triangle geometry as TriangleFoundation but with WALL_HEIGHT instead of FOUNDATION_HEIGHT
  const geometry = useMemo(() => {
    const halfSize = UNIT_SIZE / 2;
    const apexZ = -TRIANGLE_RADIUS;     // -2.31 = south (TOP of screen)
    const baseZ = TRIANGLE_APOTHEM;     // +1.15 = north (BOTTOM of screen)
    const halfHeight = WALL_HEIGHT / 2; // Key difference: use WALL_HEIGHT

    // Vertices: apex at -Z (south/top of screen), base corners at +Z (north/bottom of screen)
    const topApex = [0, halfHeight, apexZ];
    const topLeft = [-halfSize, halfHeight, baseZ];
    const topRight = [halfSize, halfHeight, baseZ];
    const botApex = [0, -halfHeight, apexZ];
    const botLeft = [-halfSize, -halfHeight, baseZ];
    const botRight = [halfSize, -halfHeight, baseZ];

    const vertices = new Float32Array([
      // Top face
      ...topApex, ...topLeft, ...topRight,
      // Bottom face
      ...botApex, ...botRight, ...botLeft,
      // North face (BASE edge)
      ...topRight, ...topLeft, ...botLeft,
      ...topRight, ...botLeft, ...botRight,
      // Southwest face (LEFT edge)
      ...topLeft, ...topApex, ...botApex,
      ...topLeft, ...botApex, ...botLeft,
      // Southeast face (RIGHT edge)
      ...topApex, ...topRight, ...botRight,
      ...topApex, ...botRight, ...botApex,
    ]);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    return geom;
  }, []);

  const edgeGeometry = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <>
      <primitive object={geometry} attach="geometry" />
      {isGhost ? (
        <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
      ) : (
        <meshStandardMaterial
          color={palette.foundation}
          roughness={0.8}
          wireframe={wireframe}
          {...getHighlightProps(highlight)}
        />
      )}
      {!isGhost && (
        <lineSegments>
          <primitive object={edgeGeometry} attach="geometry" />
          <meshBasicMaterial color={EDGE_COLOR} />
        </lineSegments>
      )}
    </>
  );
};

const CurvedStructure = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
  const shape = useMemo(() => createCurvedFoundationShape(), []);
  const extrudeSettings = useMemo(() => ({ depth: WALL_HEIGHT, bevelEnabled: false }), []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -WALL_HEIGHT / 2, 0]}>
      <mesh>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial
            color={palette.foundation}
            roughness={0.8}
            wireframe={wireframe}
            {...getHighlightProps(highlight)}
          />
        )}
      </mesh>
    </group>
  );
};

const Wall = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
  // Create materials array for 6 faces to support different interior/exterior colors
  // Box geometry faces order: +X, -X, +Y, -Y, +Z (front/exterior), -Z (back/interior)
  const wallMaterials = useMemo(() => {
    const emissive = highlight ? new THREE.Color('#FFD54A') : undefined;
    const emissiveIntensity = highlight ? 0.6 : 0;
    return [
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // +X
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // -X
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // +Y (top)
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // -Y (bottom)
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // +Z (front/exterior)
      new THREE.MeshStandardMaterial({ color: palette.wallInterior, roughness: 0.9, emissive, emissiveIntensity }), // -Z (back/interior)
    ];
  }, [palette.wallExterior, palette.wallInterior, highlight]);

  // Ghost materials show interior/exterior distinction with transparency
  // Green tint for valid, red tint for invalid placement
  const ghostMaterials = useMemo(() => {
    const tint = isValid ? 0x4ade80 : 0xef4444; // green or red
    const exteriorColor = new THREE.Color(palette.wallExterior).lerp(new THREE.Color(tint), 0.5);
    const interiorColor = new THREE.Color(palette.wallInterior).lerp(new THREE.Color(tint), 0.5);
    return [
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // +X
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // -X
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // +Y
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // -Y
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // +Z (exterior)
      new THREE.MeshBasicMaterial({ color: interiorColor, transparent: true, opacity: 0.6 }), // -Z (interior)
    ];
  }, [palette.wallExterior, palette.wallInterior, isValid]);

  return (
    <>
      <boxGeometry args={[UNIT_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
      {isGhost ? (
        <primitive object={ghostMaterials} attach="material" />
      ) : wireframe ? (
        <meshStandardMaterial
          color={palette.wallExterior}
          roughness={0.9}
          wireframe
          {...getHighlightProps(highlight)}
        />
      ) : (
        <primitive object={wallMaterials} attach="material" />
      )}
    </>
  );
};

const HalfWall = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
  // Same dual-sided materials as Wall
  const wallMaterials = useMemo(() => {
    const emissive = highlight ? new THREE.Color('#FFD54A') : undefined;
    const emissiveIntensity = highlight ? 0.6 : 0;
    return [
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // +X
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // -X
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // +Y (top)
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // -Y (bottom)
      new THREE.MeshStandardMaterial({ color: palette.wallExterior, roughness: 0.9, emissive, emissiveIntensity }), // +Z (front/exterior)
      new THREE.MeshStandardMaterial({ color: palette.wallInterior, roughness: 0.9, emissive, emissiveIntensity }), // -Z (back/interior)
    ];
  }, [palette.wallExterior, palette.wallInterior, highlight]);

  // Ghost materials show interior/exterior distinction with transparency
  const ghostMaterials = useMemo(() => {
    const tint = isValid ? 0x4ade80 : 0xef4444;
    const exteriorColor = new THREE.Color(palette.wallExterior).lerp(new THREE.Color(tint), 0.5);
    const interiorColor = new THREE.Color(palette.wallInterior).lerp(new THREE.Color(tint), 0.5);
    return [
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // +X
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // -X
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // +Y
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // -Y
      new THREE.MeshBasicMaterial({ color: exteriorColor, transparent: true, opacity: 0.6 }), // +Z (exterior)
      new THREE.MeshBasicMaterial({ color: interiorColor, transparent: true, opacity: 0.6 }), // -Z (interior)
    ];
  }, [palette.wallExterior, palette.wallInterior, isValid]);

  return (
    <>
      <boxGeometry args={[UNIT_SIZE, HALF_WALL_HEIGHT, WALL_THICKNESS]} />
      {isGhost ? (
        <primitive object={ghostMaterials} attach="material" />
      ) : wireframe ? (
        <meshStandardMaterial
          color={palette.wallExterior}
          roughness={0.9}
          wireframe
          {...getHighlightProps(highlight)}
        />
      ) : (
        <primitive object={wallMaterials} attach="material" />
      )}
    </>
  );
};

const WindowWall = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => (
  <group>
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[UNIT_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
      {isGhost ? (
        <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
      ) : (
        <meshStandardMaterial
          color={palette.windowWall}
          roughness={0.9}
          transparent
          opacity={0.9}
          wireframe={wireframe}
          {...getHighlightProps(highlight)}
        />
      )}
    </mesh>
    {!wireframe && !isGhost && (
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[UNIT_SIZE * WINDOW_WIDTH_RATIO, WINDOW_HEIGHT, WALL_THICKNESS + 0.02]} />
        <meshStandardMaterial color={palette.windowGlass} {...getHighlightProps(highlight)} />
      </mesh>
    )}
  </group>
);

const Doorway = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
  const shape = useMemo(() => createDoorwayShape(), []);
  const extrudeSettings = useMemo(() => ({ depth: WALL_THICKNESS, bevelEnabled: false }), []);

  return (
    <group position={[0, 0, -WALL_THICKNESS / 2]}>
      <mesh>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial
            color={palette.wallExterior}
            roughness={0.9}
            wireframe={wireframe}
            {...getHighlightProps(highlight)}
          />
        )}
      </mesh>
    </group>
  );
};

const SquareRoof = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
  const roofAngle = useMemo(() => -Math.atan(ROOF_HEIGHT / UNIT_SIZE), []);
  const roofLength = useMemo(() => Math.sqrt(UNIT_SIZE * UNIT_SIZE + ROOF_HEIGHT * ROOF_HEIGHT) + 1, []);

  return (
    <group>
      <mesh position={[0, ROOF_HEIGHT / 2, 0]} rotation={[roofAngle, 0, 0]}>
        <boxGeometry args={[UNIT_SIZE, roofLength, ROOF_THICKNESS]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial color={palette.roof} wireframe={wireframe} {...getHighlightProps(highlight)} />
        )}
      </mesh>
      {!wireframe && !isGhost && (
        <>
          <mesh position={[-(UNIT_SIZE / 2 - 0.1), ROOF_HEIGHT / 4, UNIT_SIZE / 8]}>
            <boxGeometry args={[ROOF_THICKNESS, ROOF_HEIGHT / 2, UNIT_SIZE]} />
            <meshStandardMaterial color={palette.roofTrim} {...getHighlightProps(highlight)} />
          </mesh>
          <mesh position={[(UNIT_SIZE / 2 - 0.1), ROOF_HEIGHT / 4, UNIT_SIZE / 8]}>
            <boxGeometry args={[ROOF_THICKNESS, ROOF_HEIGHT / 2, UNIT_SIZE]} />
            <meshStandardMaterial color={palette.roofTrim} {...getHighlightProps(highlight)} />
          </mesh>
        </>
      )}
    </group>
  );
};

const TriangleRoof = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => (
  <group position={[0, ROOF_HEIGHT / 2, 0]}>
    <mesh>
      <coneGeometry args={[TRIANGLE_RADIUS, ROOF_HEIGHT, 3]} />
      {isGhost ? (
        <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
      ) : (
        <meshStandardMaterial color={palette.roof} wireframe={wireframe} {...getHighlightProps(highlight)} />
      )}
    </mesh>
  </group>
);

const Stairs = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
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
            <meshStandardMaterial color={palette.incline} wireframe={wireframe} {...getHighlightProps(highlight)} />
          )}
        </mesh>
      ))}
    </group>
  );
};

const Ramp = ({ wireframe, isGhost, isValid = true, highlight, materials, palette }: GeometryProps) => {
  const { length, angle } = useMemo(() => getRampParams(), []);

  return (
    <group>
      <mesh position={[0, WALL_HEIGHT / 2, 0]} rotation={[angle, 0, 0]}>
        <boxGeometry args={[UNIT_SIZE, RAMP_THICKNESS, length]} />
        {isGhost ? (
          <primitive object={getGhostMaterial(materials, isValid)} attach="material" />
        ) : (
          <meshStandardMaterial color={palette.incline} wireframe={wireframe} {...getHighlightProps(highlight)} />
        )}
      </mesh>
      {!wireframe && !isGhost && (
        <>
          <mesh position={[-UNIT_SIZE / 2 + 0.1, WALL_HEIGHT / 2, 0]} rotation={[angle, 0, 0]}>
            <boxGeometry args={[RAIL_WIDTH, RAIL_HEIGHT, length]} />
            <meshStandardMaterial color={palette.roofTrim} {...getHighlightProps(highlight)} />
          </mesh>
          <mesh position={[UNIT_SIZE / 2 - 0.1, WALL_HEIGHT / 2, 0]} rotation={[angle, 0, 0]}>
            <boxGeometry args={[RAIL_WIDTH, RAIL_HEIGHT, length]} />
            <meshStandardMaterial color={palette.roofTrim} {...getHighlightProps(highlight)} />
          </mesh>
        </>
      )}
    </group>
  );
};

// =============================================================================
// Building Mesh Component
// =============================================================================

const BuildingMesh = React.forwardRef<THREE.Object3D, BuildingMeshProps>(({
  type,
  position,
  rotation,
  isGhost = false,
  isValid = true,
  id,
  wireframe = false,
  highlight = false,
  materials,
  palette,
}: BuildingMeshProps, ref) => {
  const geometryProps: GeometryProps = { wireframe, isGhost, isValid, highlight, materials, palette };

  // Render the appropriate geometry based on type
  const renderGeometry = () => {
    switch (type) {
      case BuildingType.SQUARE_FOUNDATION:
        return <SquareFoundation {...geometryProps} />;
      case BuildingType.TRIANGLE_FOUNDATION:
        return <TriangleFoundation {...geometryProps} />;
      case BuildingType.CURVED_FOUNDATION:
        return <CurvedFoundation {...geometryProps} />;
      case BuildingType.SQUARE_STRUCTURE:
        return <SquareStructure {...geometryProps} />;
      case BuildingType.TRIANGLE_STRUCTURE:
        return <TriangleStructure {...geometryProps} />;
      case BuildingType.CURVED_STRUCTURE:
        return <CurvedStructure {...geometryProps} />;
      case BuildingType.WALL:
        return <Wall {...geometryProps} />;
      case BuildingType.HALF_WALL:
        return <HalfWall {...geometryProps} />;
      case BuildingType.WINDOW_WALL:
        return <WindowWall {...geometryProps} />;
      case BuildingType.DOORWAY:
        return <Doorway {...geometryProps} />;
      case BuildingType.CURVED_WALL:
        return <CurvedWall {...geometryProps} height={WALL_HEIGHT} />;
      case BuildingType.CURVED_HALF_WALL:
        return <CurvedWall {...geometryProps} height={HALF_WALL_HEIGHT} />;
      case BuildingType.SQUARE_ROOF:
        return <SquareRoof {...geometryProps} />;
      case BuildingType.TRIANGLE_ROOF:
        return <TriangleRoof {...geometryProps} />;
      case BuildingType.STAIRS:
        return <Stairs {...geometryProps} />;
      case BuildingType.STAIRS_2:
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
        ref={ref as React.Ref<THREE.Group>}
        position={[position[0], position[1] + offsetY, position[2]]}
        rotation={rotation}
        userData={{ isBuilding: true, id }}
        raycast={isGhost ? () => null : undefined} // Revert if you want ghost previews to be raycast targets.
      >
        {renderGeometry()}
      </group>
    );
  }

  // Simple mesh types
  return (
    <mesh
      ref={ref as React.Ref<THREE.Mesh>}
      position={[position[0], position[1] + offsetY, position[2]]}
      rotation={rotation}
      userData={{ isBuilding: true, id }}
      raycast={isGhost ? () => null : undefined}
    >
      {renderGeometry()}
    </mesh>
  );
});

BuildingMesh.displayName = 'BuildingMesh';

// =============================================================================
// Socket Debug Visualizer
// =============================================================================

const SocketDebugVisualizer = () => {
  const { buildings } = useGameStore();

  // Edge role colors: BASE=red, RIGHT=blue, LEFT=gray, SIDE=gold
  const getEdgeColor = (edgeRole: EdgeRole): string => {
    switch (edgeRole) {
      case EdgeRole.BASE: return '#FF0000';   // Red
      case EdgeRole.RIGHT: return '#0000FF';  // Blue
      case EdgeRole.LEFT: return '#808080';   // Gray
      case EdgeRole.SIDE: return '#FFD700';   // Gold (for squares/curves)
      default: return '#FFFFFF';
    }
  };

  return (
    <group>
      {buildings.map((building) => {
        // FOUNDATIONS: Show 3 points per edge (start, center, end)
        const isWallLike =
          building.type === BuildingType.WALL ||
          building.type === BuildingType.HALF_WALL ||
          building.type === BuildingType.WINDOW_WALL ||
          building.type === BuildingType.DOORWAY;
        if (utilUsesEdgeSockets(building.type) && !isWallLike) { // Revert to hard-coded list if you want to limit debug output.
          const edges = getWorldEdgeSockets(building);
          return (
            <group key={`edges-${building.id}`}>
              {edges.map((edge, idx) => {
                const color = getEdgeColor(edge.edgeRole);
                const y = 0.15; // Height above foundation

                return (
                  <group key={`edge-${building.id}-${idx}`}>
                    {/* Start point sphere */}
                    <mesh position={[edge.start.x, edge.start.y + y, edge.start.z]}>
                      <sphereGeometry args={[0.12, 8, 8]} />
                      <meshBasicMaterial color={color} transparent opacity={0.9} />
                    </mesh>

                    {/* Center point sphere (slightly smaller) */}
                    <mesh position={[edge.center.x, edge.center.y + y, edge.center.z]}>
                      <sphereGeometry args={[0.10, 8, 8]} />
                      <meshBasicMaterial color={color} transparent opacity={0.9} />
                    </mesh>

                    {/* End point sphere */}
                    <mesh position={[edge.end.x, edge.end.y + y, edge.end.z]}>
                      <sphereGeometry args={[0.12, 8, 8]} />
                      <meshBasicMaterial color={color} transparent opacity={0.9} />
                    </mesh>

                    {/* Line connecting start to center */}
                    <line>
                      <bufferGeometry>
                        <bufferAttribute
                          attach="attributes-position"
                          args={[new Float32Array([
                            edge.start.x, edge.start.y + y, edge.start.z,
                            edge.center.x, edge.center.y + y, edge.center.z
                          ]), 3]}
                        />
                      </bufferGeometry>
                      <lineBasicMaterial color={color} linewidth={2} />
                    </line>

                    {/* Line connecting center to end */}
                    <line>
                      <bufferGeometry>
                        <bufferAttribute
                          attach="attributes-position"
                          args={[new Float32Array([
                            edge.center.x, edge.center.y + y, edge.center.z,
                            edge.end.x, edge.end.y + y, edge.end.z
                          ]), 3]}
                        />
                      </bufferGeometry>
                      <lineBasicMaterial color={color} linewidth={2} />
                    </line>
                  </group>
                );
              })}
            </group>
          );
        }

        // WALLS/ROOFS: Show point sockets (legacy system)
        const sockets = getWorldSockets(building);
        const socketColors: Record<string, string> = {
          FOUNDATION_TOP: '#00FF00',     // Green
          WALL_BOTTOM: '#FF00FF',        // Magenta
          WALL_SIDE: '#00FFFF',          // Cyan
          WALL_TOP: '#FF8C00',           // Orange
          ROOF_EDGE: '#FF0000',          // Red
          INCLINE_BOTTOM: '#1E90FF',     // Dodger Blue
          INCLINE_TOP: '#9400D3',        // Dark Violet
        };

        return (
          <group key={`sockets-${building.id}`}>
            {sockets.map((socket: any, idx: number) => {
              // Skip FOUNDATION_EDGE sockets for non-foundations (shouldn't exist, but just in case)
              if (socket.socketType === 'FOUNDATION_EDGE') return null;

              const color = socketColors[socket.socketType as keyof typeof socketColors] || '#FFFFFF';

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
// Snap Collider System
// =============================================================================

/**
 * Invisible colliders placed at socket locations to catch raycasts.
 * Solves the issue of "thin air" snaps being twitchy by giving them volume.
 */
const SnapColliders = () => {
  const { buildings, activeType } = useGameStore();
  const compatibleTypes = useMemo(() => getCompatibleSocketTypes(activeType), [activeType]);

  // Don't render if nothing to snap to
  if (compatibleTypes.length === 0) return null;

  return (
    <group>
      {buildings.map((building) => {
        // If building uses edge sockets (foundations), check if we can snap to edges
        // (Simplified: if we are a foundation, we snap to edges. logic handled in getCompatibleSocketTypes)
        // However, getWorldEdgeSockets is expensive to call every frame? Memoized in geometry logic hopefully.
        // Actually, we just render colliders for ALL compatible sockets.

        const sockets = getWorldSockets(building);

        return (
          <group key={`colliders-${building.id}`}>
            {sockets.map((socket: any, idx: number) => {
              if (!compatibleTypes.includes(socket.socketType)) return null;

              return (
                <mesh
                  key={`collider-${building.id}-${idx}`}
                  position={[socket.position.x, socket.position.y, socket.position.z]}
                  visible={false} // Invisible raycast target
                >
                  <sphereGeometry args={[0.4, 8, 8]} /> {/* 0.4 radius = 80cm target */}
                  <meshBasicMaterial color="pink" wireframe />
                </mesh>
              );
            })}

            {/* Also render edge midpoints as colliders if compatible */}
            {utilUsesEdgeSockets(building.type) && compatibleTypes.includes('FOUNDATION_EDGE' as any) && (
              getWorldEdgeSockets(building).map((edge, idx) => (
                <mesh
                  key={`edge-collider-${building.id}-${idx}`}
                  position={[edge.center.x, edge.center.y, edge.center.z]}
                  visible={false}
                >
                  <boxGeometry args={[edge.edgeLength * 0.8, 0.5, 0.5]} />
                  <meshBasicMaterial color="cyan" wireframe />
                  {/* Rotate towards edge alignment? Ideally yes, but sphere/box approximation is okay for now 
                        since we just want to catch the mouse near the edge.
                        Actually, box without rotation might be weird. Let's use Sphere at center for now.
                    */}
                </mesh>
              ))
            )}
          </group>
        );
      })}
    </group>
  );
};

// =============================================================================
// Planner Component (handles placement logic)
// =============================================================================

interface PlannerProps {
  materials: MaterialsType;
  debugRecorder?: {
    isRecording: boolean;
    addFrame: (frame: any) => void;
  };
}

const Planner = ({ materials, debugRecorder }: PlannerProps) => {
  const {
    buildings,
    addBuilding,
    removeBuilding,
    activeType,
    showWireframe,
    showSocketDebug,
    autoHeight,
    manualHeight,
    activeBuildingSet,
    setActiveType,
    interactionMode,
    toggleInteractionMode,
    isDevMode,
    toggleAutoHeight,
  } = useGameStore();
  const palette = PALETTES[activeBuildingSet];
  const { camera, raycaster, mouse } = useThree();
  const [ghostIsValid, setGhostIsValid] = useState(true);
  const [manualRot, setManualRot] = useState(0);
  const [verticalOffset, setVerticalOffset] = useState(0);

  const groupRef = useRef<THREE.Group>(null);
  const ghostRef = useRef<THREE.Object3D | null>(null);
  const hoveredObjectRef = useRef<THREE.Object3D | null>(null);
  const hoverPointRef = useRef(new THREE.Vector3());
  const hoverNormalRef = useRef(new THREE.Vector3(0, 1, 0));
  const hoverBoxRef = useRef(new THREE.Box3());
  const hoverCenterRef = useRef(new THREE.Vector3());
  const hoverPlaneRef = useRef(new THREE.Plane());
  const ghostPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const ghostRotRef = useRef<[number, number, number]>([0, 0, 0]);
  const ghostIsValidRef = useRef(true);
  const lastMousePos = useRef<[number, number]>([0, 0]);
  const lastSnapTargetRef = useRef<PreferredSnapTarget | null>(null);
  const ghostOffsetY = useMemo(() => getYOffset(activeType), [activeType]);

  // Reset vertical offset when changing building type
  useEffect(() => {
    setVerticalOffset(0);
  }, [activeType]);

  useEffect(() => {
    if (interactionMode === 'build') {
      hoveredObjectRef.current = null;
      hoverPointRef.current.set(0, 0, 0);
      hoverNormalRef.current.set(0, 1, 0);
    }
  }, [interactionMode]);

  // Handle keyboard controls (Rotation and Vertical Stacking)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (key === 'v' || key === 'a') {
        toggleInteractionMode();
        return;
      }

      if (key === 'h') {
        toggleAutoHeight();
        return;
      }

      // Rotation
      if (key === 'r') {
        const rotIncrement = getRotationIncrement(activeType);
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
            keyPress: { key: 'r', action: 'rotate' },
          });
        }
      }

      // Vertical Stacking (Arrow Keys) - only if manualHeight is enabled
      if (manualHeight) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setVerticalOffset((prev) => prev + HALF_WALL_HEIGHT);
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setVerticalOffset((prev) => prev - HALF_WALL_HEIGHT);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manualRot, activeType, debugRecorder, manualHeight, toggleInteractionMode, toggleAutoHeight]);

  // Update ghost position based on mouse
  useFrame(() => {
    if (!groupRef.current) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(groupRef.current.children, true);

    // Track mouse position for recording
    lastMousePos.current = [mouse.x, mouse.y];

    if (interactionMode === 'select') {
      let nextHovered: THREE.Object3D | null = null;
      for (const hit of intersects) {
        const root = getBuildingRootFromObject(hit.object);
        if (root) {
          nextHovered = root;
          if (hit.face) {
            hoverNormalRef.current.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
          } else {
            hoverNormalRef.current.set(0, 1, 0);
          }
          hoverBoxRef.current.setFromObject(root);
          hoverBoxRef.current.getCenter(hoverCenterRef.current);
          hoverPlaneRef.current.setFromNormalAndCoplanarPoint(hoverNormalRef.current, hit.point);
          hoverPlaneRef.current.projectPoint(hoverCenterRef.current, hoverPointRef.current);
          break;
        }
      }
      hoveredObjectRef.current = nextHovered;
      return;
    }

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

      const distanceToLastTarget = lastSnapTargetRef.current
        ? targetPoint.distanceTo(lastSnapTargetRef.current.position)
        : Infinity;
      const preferredTarget =
        distanceToLastTarget < 4.5 ? lastSnapTargetRef.current : null;
      if (!preferredTarget) {
        lastSnapTargetRef.current = null;
      }

      const snap = calculateSnap(
        targetPoint,
        buildings,
        activeType,
        manualRot,
        debugCallback,
        preferredTarget || undefined
      );
      if (snap) {
        if (snap.snappedToSocket && snap.snapTarget) {
          lastSnapTargetRef.current = snap.snapTarget;
        } else if (!snap.snappedToSocket) {
          lastSnapTargetRef.current = null;
        }
        // Calculate base Y position
        // If autoHeight is ON and we snapped to a socket, use socket's world Y
        // Otherwise use snap.position.y (which is 0 for grid fallback)
        let baseY = snap.position.y;
        if (autoHeight && snap.socketWorldY !== null) {
          baseY = snap.socketWorldY;
        }

        // Apply manual offset only if manualHeight is enabled
        const finalY = manualHeight ? baseY + verticalOffset : baseY;

        ghostPosRef.current = [snap.position.x, finalY, snap.position.z];
        ghostRotRef.current = [snap.rotation.x, snap.rotation.y, snap.rotation.z];
        if (ghostRef.current) {
          ghostRef.current.position.set(snap.position.x, finalY + ghostOffsetY, snap.position.z);
          ghostRef.current.rotation.set(snap.rotation.x, snap.rotation.y, snap.rotation.z);
        }
        if (ghostIsValidRef.current !== snap.isValid) {
          ghostIsValidRef.current = snap.isValid;
          setGhostIsValid(snap.isValid);
        }
      }
    }
  });

  // Handle building placement or demolition (Shift+Click)
  const handlePlace = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5) return; // Ignore if dragging
    if (e.button !== 0) return; // Only left click

    e.stopPropagation();

    const isSelectMode = interactionMode === 'select';

    // Cmd/Ctrl + Click = Demolish mode
    if (e.nativeEvent.metaKey || e.nativeEvent.ctrlKey) {
      // Find the building that was clicked by checking intersection
      const clickedObject = e.object;
      // Traverse up to find the building group with userData.buildingId
      let current: THREE.Object3D | null = clickedObject;
      while (current) {
        if (current.userData?.buildingId) {
          handleRemoveBuilding(current.userData.buildingId, e);
          return;
        }
        current = current.parent;
      }
      return;
    }

    // Avoid accidental placement while using navigation modifiers
    if (e.nativeEvent.shiftKey || e.nativeEvent.altKey) return;

    if (isSelectMode) return;

    // Normal placement
    if (ghostIsValidRef.current) {
      const [ghostX, ghostY, ghostZ] = ghostPosRef.current;
      const [ghostRotX, ghostRotY, ghostRotZ] = ghostRotRef.current;
      const newBuilding: BuildingData = {
        id: crypto.randomUUID(),
        type: activeType,
        position: [ghostX, ghostY, ghostZ],
        rotation: [ghostRotX, ghostRotY, ghostRotZ],
      };
      addBuilding(newBuilding);

      // Record placement
      if (debugRecorder?.isRecording) {
        debugRecorder.addFrame({
          timestamp: Date.now(),
          cursorPosition: [ghostX, ghostY, ghostZ],
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
  const handleRemoveBuilding = (id: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const removedBuilding = buildings.find((b) => b.id === id);
    removeBuilding(id);

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

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 1) return; // Middle click only
    e.stopPropagation();
    const nativeEvent = e.nativeEvent as PointerEvent;
    nativeEvent.preventDefault?.();

    let current: THREE.Object3D | null = e.object;
    let buildingId: string | null = null;
    while (current) {
      if (current.userData?.buildingId) {
        buildingId = current.userData.buildingId;
        break;
      }
      if (current.userData?.isBuilding && current.userData?.id) {
        buildingId = current.userData.id;
        break;
      }
      current = current.parent;
    }
    if (!buildingId) return;
    const building = buildings.find((b) => b.id === buildingId);
    if (!building) return;

    setActiveType(building.type);
    if (interactionMode === 'select') {
      toggleInteractionMode();
    }
  };

  return (
    <group ref={groupRef} onClick={handlePlace} onPointerDown={handlePointerDown}>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#E6C288" roughness={0.9} />
      </mesh>

      {/* Grid */}
      <gridHelper args={[1000, 250, 0x000000, 0x6b5c45]} position={[0, 0.01, 0]} />

      {/* Placed buildings */}
      {buildings.map((b) => (
        <group key={b.id} userData={{ buildingId: b.id }}>
          <BuildingMesh {...b} wireframe={showWireframe} materials={materials} palette={palette} />
        </group>
      ))}

      {/* Socket debug visualization */}
      {isDevMode && showSocketDebug && <SocketDebugVisualizer />}

      <HoverMarkerHelper targetRef={hoveredObjectRef} pointRef={hoverPointRef} normalRef={hoverNormalRef} />

      {/* Snap Colliders (Invisible) */}
      {interactionMode === 'build' && <SnapColliders />}

      {/* Ghost preview */}
      {interactionMode === 'build' && (
        <BuildingMesh
          ref={ghostRef}
          type={activeType}
          position={ghostPosRef.current}
          rotation={ghostRotRef.current}
          isGhost
          isValid={ghostIsValid}
          materials={materials}
          palette={palette}
        />
      )}
    </group>
  );
};

// =============================================================================
// Camera Controller for 2D Mode
// =============================================================================

interface CameraControllerProps {
  is2DMode: boolean;
  controlsRef: React.RefObject<any>;
}

const CameraController = ({ is2DMode, controlsRef }: CameraControllerProps) => {
  const { camera } = useThree();

  useEffect(() => {
    if (is2DMode) {
      // Top-down orthographic-like view
      camera.position.set(0, 30, 0.001); // Small Z offset to avoid gimbal lock
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    } else {
      // Default 3D view
      camera.position.set(10, 15, 10);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [is2DMode, camera, controlsRef]);

  return null;
};

const HoverMarkerHelper = ({
  targetRef,
  pointRef,
  normalRef,
  color = '#FFD54A',
  ringInner = 0.16,
  ringOuter = 0.24,
  dotRadius = 0.12,
  stemRadius = 0.035,
  stemLength = 0.14,
}: {
  targetRef: React.RefObject<THREE.Object3D | null>;
  pointRef: React.RefObject<THREE.Vector3>;
  normalRef: React.RefObject<THREE.Vector3>;
  color?: string;
  ringInner?: number;
  ringOuter?: number;
  dotRadius?: number;
  stemRadius?: number;
  stemLength?: number;
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const quatRef = useRef(new THREE.Quaternion());
  const normalTmpRef = useRef(new THREE.Vector3());
  const zAxisRef = useRef(new THREE.Vector3(0, 0, 1));

  const ringGeometry = useMemo(() => new THREE.RingGeometry(ringInner, ringOuter, 24), [ringInner, ringOuter]);
  const dotGeometry = useMemo(() => new THREE.SphereGeometry(dotRadius, 12, 12), [dotRadius]);
  const stemGeometry = useMemo(() => new THREE.CylinderGeometry(stemRadius, stemRadius, stemLength, 10), [stemRadius, stemLength]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }), [color]);

  useEffect(() => {
    return () => {
      ringGeometry.dispose();
      dotGeometry.dispose();
      stemGeometry.dispose();
      material.dispose();
    };
  }, [ringGeometry, dotGeometry, stemGeometry, material]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const target = targetRef.current;
    if (!target) {
      group.visible = false;
      return;
    }
    group.visible = true;
    group.position.copy(pointRef.current);
    const normal = normalTmpRef.current.copy(normalRef.current).normalize();
    quatRef.current.setFromUnitVectors(zAxisRef.current, normal);
    group.quaternion.copy(quatRef.current);
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={999}>
      <mesh geometry={ringGeometry} material={material} position={[0, 0, 0.01]} />
      <mesh geometry={stemGeometry} material={material} position={[0, 0, 0.01 + stemLength / 2]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={dotGeometry} material={material} position={[0, 0, 0.01 + stemLength + dotRadius]} />
    </group>
  );
};

const OrbitDragThreshold = ({
  threshold = 6,
}: {
  threshold?: number;
}) => {
  const { gl } = useThree();
  const activeRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startRef = useRef(new THREE.Vector2());

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (e.shiftKey) return; // Allow shift+drag orbit immediately.
      activeRef.current = true;
      pointerIdRef.current = e.pointerId;
      startRef.current.set(e.clientX, e.clientY);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!activeRef.current) return;
      if (pointerIdRef.current !== e.pointerId) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < threshold * threshold) {
        e.stopImmediatePropagation();
        e.preventDefault();
      } else {
        activeRef.current = false;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (pointerIdRef.current === e.pointerId) {
        activeRef.current = false;
        pointerIdRef.current = null;
      }
    };

    gl.domElement.addEventListener('pointerdown', handlePointerDown, true);
    const doc = gl.domElement.ownerDocument;
    doc.addEventListener('pointermove', handlePointerMove, true);
    doc.addEventListener('pointerup', handlePointerUp, true);
    doc.addEventListener('pointercancel', handlePointerUp, true);
    return () => {
      gl.domElement.removeEventListener('pointerdown', handlePointerDown, true);
      doc.removeEventListener('pointermove', handlePointerMove, true);
      doc.removeEventListener('pointerup', handlePointerUp, true);
      doc.removeEventListener('pointercancel', handlePointerUp, true);
    };
  }, [gl, threshold]);

  return null;
};

// =============================================================================
// Compass Component - shows N/S/E/W in the scene
// =============================================================================

const Compass = () => {
  const compassSize = 3;
  const arrowLength = 2;
  const labelOffset = 2.5;

  return (
    <group position={[-12, 0.1, -12]}>
      {/* Compass circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[compassSize - 0.1, compassSize, 32]} />
        <meshBasicMaterial color="#333" side={THREE.DoubleSide} />
      </mesh>

      {/* North arrow (+Z direction in Three.js when looking down) */}
      <group>
        <mesh position={[0, 0.05, arrowLength / 2]}>
          <boxGeometry args={[0.15, 0.1, arrowLength]} />
          <meshBasicMaterial color="#FF0000" />
        </mesh>
        <mesh position={[0, 0.05, arrowLength]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.3, 0.5, 8]} />
          <meshBasicMaterial color="#FF0000" />
        </mesh>
        {/* N label */}
        <mesh position={[0, 0.1, labelOffset]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.8]} />
          <meshBasicMaterial color="#FF0000" transparent opacity={0.9} />
        </mesh>
      </group>

      {/* South arrow (-Z direction) */}
      <group>
        <mesh position={[0, 0.05, -arrowLength / 2]}>
          <boxGeometry args={[0.1, 0.08, arrowLength]} />
          <meshBasicMaterial color="#666" />
        </mesh>
      </group>

      {/* East arrow (+X direction) */}
      <group>
        <mesh position={[arrowLength / 2, 0.05, 0]}>
          <boxGeometry args={[arrowLength, 0.08, 0.1]} />
          <meshBasicMaterial color="#0066FF" />
        </mesh>
        <mesh position={[arrowLength, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.2, 0.4, 8]} />
          <meshBasicMaterial color="#0066FF" />
        </mesh>
      </group>

      {/* West arrow (-X direction) */}
      <group>
        <mesh position={[-arrowLength / 2, 0.05, 0]}>
          <boxGeometry args={[arrowLength, 0.08, 0.1]} />
          <meshBasicMaterial color="#666" />
        </mesh>
      </group>

      {/* Direction labels using simple colored planes */}
      {/* N = Red (+Z) */}
      <group position={[0, 0.2, labelOffset + 0.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial color="#FF0000" />
        </mesh>
      </group>
      {/* E = Blue (+X) */}
      <group position={[labelOffset + 0.5, 0.2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial color="#0066FF" />
        </mesh>
      </group>
      {/* S = Gray (-Z) */}
      <group position={[0, 0.2, -labelOffset - 0.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial color="#666" />
        </mesh>
      </group>
      {/* W = Gray (-X) */}
      <group position={[-labelOffset - 0.5, 0.2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial color="#666" />
        </mesh>
      </group>
    </group>
  );
};

// =============================================================================
// Axis Labels - shows +X, -X, +Z, -Z labels at grid edges
// =============================================================================

const AxisLabels = ({ is2DMode }: { is2DMode: boolean }) => {
  if (!is2DMode) return null;

  const gridExtent = 10;

  return (
    <group>
      {/* +X label (East/Right) */}
      <group position={[gridExtent + 1, 0.5, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 0.8]} />
          <meshBasicMaterial color="#0066FF" transparent opacity={0.8} />
        </mesh>
      </group>

      {/* -X label (West/Left) */}
      <group position={[-gridExtent - 1, 0.5, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 0.8]} />
          <meshBasicMaterial color="#666" transparent opacity={0.8} />
        </mesh>
      </group>

      {/* +Z label (North/Up on screen) */}
      <group position={[0, 0.5, gridExtent + 1]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 0.8]} />
          <meshBasicMaterial color="#FF0000" transparent opacity={0.8} />
        </mesh>
      </group>

      {/* -Z label (South/Down on screen) */}
      <group position={[0, 0.5, -gridExtent - 1]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 0.8]} />
          <meshBasicMaterial color="#666" transparent opacity={0.8} />
        </mesh>
      </group>
    </group>
  );
};

// =============================================================================
// Main Scene Export
// =============================================================================

export interface GameSceneProps {
  debugRecorder?: {
    isRecording: boolean;
    addFrame: (frame: any) => void;
  };
}

export const GameScene = ({ debugRecorder }: GameSceneProps) => {
  const { is2DMode, controlScheme } = useGameStore();

  const materials = useMemo(
    () => ({
      ghost: new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.5 }),
      error: new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.5 }),
    }),
    []
  );

  const controlsRef = useRef<any>(null);

  return (
    <Canvas shadows camera={{ position: is2DMode ? [0, 30, 0.001] : [10, 15, 10], fov: 50 }}>
      <color attach="background" args={[is2DMode ? '#1a1a2e' : '#87CEEB']} />
      {/* Fog disabled for now; re-enable if we want atmospheric depth */}
      {/* {!is2DMode && <fog attach="fog" args={['#E6C288', 20, 100]} />} */}
      <ambientLight intensity={is2DMode ? 1.0 : 0.6} />
      <directionalLight position={[10, 20, 10]} intensity={is2DMode ? 0.5 : 1} castShadow />
      {!is2DMode && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
      <CameraController is2DMode={is2DMode} controlsRef={controlsRef} />
      <OrbitDragThreshold threshold={8} />
      <Compass />
      <AxisLabels is2DMode={is2DMode} />
      <Planner materials={materials} debugRecorder={debugRecorder} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={!is2DMode}
        maxPolarAngle={is2DMode ? 0 : Math.PI / 2 - 0.1}
        minPolarAngle={is2DMode ? 0 : 0}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: undefined,
          RIGHT: controlScheme === 'right-orbit' ? THREE.MOUSE.ROTATE : undefined,
        }}
      />
    </Canvas>
  );
};
