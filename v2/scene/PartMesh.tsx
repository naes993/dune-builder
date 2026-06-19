import { useEffect, useMemo } from 'react';
import { preloadObfuscatedGltf, useObfuscatedGltf } from './obfuscatedGltf';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PARTS } from '../registry/parts';
import { useV2BuilderStore } from '../store/builderStore';
import { MaterialOverrideDef, MeshVisualDef, PartDefinition, PartId, Transform2D } from '../types';

type VisualMaterialProfile = MaterialOverrideDef & {
  emissive?: string;
  emissiveIntensity?: number;
};

const interpolateHexColor = (from: string, to: string, amount: number) => {
  const start = new THREE.Color(from);
  const end = new THREE.Color(to);
  return `#${start.lerp(end, amount).getHexString()}`;
};

const getHarkonnenExteriorMaterial = (
  darkDetail: number,
  adminHueEnabled: boolean,
  adminHue: number
): Required<VisualMaterialProfile> => {
  const amount = THREE.MathUtils.clamp(darkDetail / 100, 0, 1);
  const color = adminHueEnabled
    ? new THREE.Color().setHSL(adminHue / 360, 0.42, THREE.MathUtils.lerp(0.05, 0.28, amount))
    : new THREE.Color(interpolateHexColor('#050505', '#313a45', amount));
  const emissive = adminHueEnabled
    ? new THREE.Color().setHSL(adminHue / 360, 0.36, THREE.MathUtils.lerp(0.015, 0.09, amount))
    : new THREE.Color(interpolateHexColor('#000000', '#111821', amount));

  return {
    color: `#${color.getHexString()}`,
    metalness: THREE.MathUtils.lerp(0.22, 0.04, amount),
    roughness: THREE.MathUtils.lerp(0.72, 0.84, amount),
    emissive: `#${emissive.getHexString()}`,
    emissiveIntensity: THREE.MathUtils.lerp(0.02, 0.38, amount),
  };
};

const HARKONNEN_INTERIOR_MATERIAL: Required<VisualMaterialProfile> = {
  color: '#9a9a9a',
  metalness: 0.45,
  roughness: 0.55,
  emissive: '#000000',
  emissiveIntensity: 0,
};

const triangleGeometry = (part: PartDefinition) => {
  const points = part.footprint.points;
  const halfHeight = part.height / 2;
  const vertices = new Float32Array([
    points[0][0], halfHeight, points[0][1],
    points[1][0], halfHeight, points[1][1],
    points[2][0], halfHeight, points[2][1],
    points[0][0], -halfHeight, points[0][1],
    points[2][0], -halfHeight, points[2][1],
    points[1][0], -halfHeight, points[1][1],
    points[0][0], halfHeight, points[0][1],
    points[0][0], -halfHeight, points[0][1],
    points[1][0], -halfHeight, points[1][1],
    points[0][0], halfHeight, points[0][1],
    points[1][0], -halfHeight, points[1][1],
    points[1][0], halfHeight, points[1][1],
    points[1][0], halfHeight, points[1][1],
    points[1][0], -halfHeight, points[1][1],
    points[2][0], -halfHeight, points[2][1],
    points[1][0], halfHeight, points[1][1],
    points[2][0], -halfHeight, points[2][1],
    points[2][0], halfHeight, points[2][1],
    points[2][0], halfHeight, points[2][1],
    points[2][0], -halfHeight, points[2][1],
    points[0][0], -halfHeight, points[0][1],
    points[2][0], halfHeight, points[2][1],
    points[0][0], -halfHeight, points[0][1],
    points[0][0], halfHeight, points[0][1],
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
};

const resolveMaterialOverride = (
  originalMaterialName: string,
  partOverride: MaterialOverrideDef | undefined,
  darkDetail: number,
  adminHueEnabled: boolean,
  adminHue: number
): VisualMaterialProfile | undefined => {
  if (originalMaterialName.includes('_Ext')) {
    return getHarkonnenExteriorMaterial(darkDetail, adminHueEnabled, adminHue);
  }

  if (originalMaterialName.includes('_Int')) {
    return HARKONNEN_INTERIOR_MATERIAL;
  }

  return partOverride;
};

const createMaterial = (
  ghost: boolean,
  valid: boolean,
  override?: VisualMaterialProfile,
  sourceName?: string
) => {
  if (ghost) {
    const material = new THREE.MeshStandardMaterial({
      color: valid ? '#59e38a' : '#f05252',
      transparent: true,
      opacity: 0.48,
      roughness: 0.8,
      metalness: 0,
    });
    material.name = sourceName ? `${sourceName}:v2-ghost` : 'v2-ghost';
    return material;
  }

  const material = new THREE.MeshStandardMaterial({
    color: override?.color ?? '#8c8c8c',
    metalness: override?.metalness ?? 0,
    roughness: override?.roughness ?? 0.8,
    emissive: override?.emissive ?? '#000000',
    emissiveIntensity: override?.emissiveIntensity ?? 0,
  });
  material.name = sourceName ? `${sourceName}:v2-override` : 'v2-override';
  return material;
};

const createVisualMaterial = (
  sourceMaterial: THREE.Material | null | undefined,
  ghost: boolean,
  valid: boolean,
  partOverride: MaterialOverrideDef | undefined,
  darkDetail: number,
  adminHueEnabled: boolean,
  adminHue: number
) => {
  const sourceName = sourceMaterial?.name ?? '';
  const override = ghost
    ? partOverride
    : resolveMaterialOverride(sourceName, partOverride, darkDetail, adminHueEnabled, adminHue);

  return createMaterial(ghost, valid, override, sourceName);
};

const applyVisualMaterials = (
  root: THREE.Object3D,
  ghost: boolean,
  valid: boolean,
  override: MaterialOverrideDef | undefined,
  darkDetail: number,
  adminHueEnabled: boolean,
  adminHue: number
) => {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const sourceMaterial = mesh.material;
    mesh.material = Array.isArray(sourceMaterial)
      ? sourceMaterial.map((material) =>
          createVisualMaterial(material, ghost, valid, override, darkDetail, adminHueEnabled, adminHue)
        )
      : createVisualMaterial(sourceMaterial, ghost, valid, override, darkDetail, adminHueEnabled, adminHue);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
};

const isReferenceCollisionVisual = (visual: MeshVisualDef) => visual.url.includes('_COL');

const GltfVisual = ({
  visualDef,
  debugVisuals,
  ghost,
  valid,
  darkDetail,
  adminHueEnabled,
  adminHue,
}: {
  visualDef: MeshVisualDef;
  debugVisuals: boolean;
  ghost: boolean;
  valid: boolean;
  darkDetail: number;
  adminHueEnabled: boolean;
  adminHue: number;
}) => {
  const gltf = useObfuscatedGltf(visualDef.url);
  const visual = useMemo(() => {
    const clone = cloneSkeleton(gltf.scene);
    applyVisualMaterials(clone, ghost, valid, visualDef.materialOverride, darkDetail, adminHueEnabled, adminHue);
    return clone;
  }, [gltf.scene, ghost, valid, visualDef.materialOverride, darkDetail, adminHueEnabled, adminHue]);

  const scale = visualDef.scale ?? [1, 1, 1];
  const offset = visualDef.offset ?? [0, 0, 0];
  const rotation = visualDef.rotation ?? [0, 0, 0];

  useEffect(() => {
    return () => {
      visual.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else {
          material.dispose();
        }
      });
    };
  }, [visual]);

  return (
    <group position={offset} rotation={rotation} scale={scale}>
      <primitive object={visual} />
      {debugVisuals && <VisualBounds object={visual} color={ghost ? (valid ? '#59e38a' : '#f05252') : '#38bdf8'} />}
    </group>
  );
};

const VisualBounds = ({ object, color }: { object: THREE.Object3D; color: string }) => {
  const helper = useMemo(() => {
    const boxHelper = new THREE.BoxHelper(object, color);
    // Debug decoration only — must never be a cursor raycast target, or it would
    // shadow real geometry and hijack placement when Debug is on.
    boxHelper.raycast = () => null;
    return boxHelper;
  }, [color, object]);

  useFrame(() => {
    helper.update();
  });

  useEffect(() => {
    return () => {
      helper.geometry.dispose();
      (helper.material as THREE.Material).dispose();
    };
  }, [helper]);

  return <primitive object={helper} />;
};

const GltfVisuals = ({
  part,
  debugVisuals,
  ghost,
  valid,
  darkDetail,
  adminHueEnabled,
  adminHue,
}: {
  part: PartDefinition;
  debugVisuals: boolean;
  ghost: boolean;
  valid: boolean;
  darkDetail: number;
  adminHueEnabled: boolean;
  adminHue: number;
}) => {
  const visualDefs = part.meshes ?? (part.mesh ? [part.mesh] : []);
  const renderableVisuals = visualDefs.filter((visualDef) => !isReferenceCollisionVisual(visualDef));

  if (renderableVisuals.length === 0) {
    return null;
  }

  return (
    <>
      {renderableVisuals.map((visualDef) => (
        <GltfVisual
          key={visualDef.url}
          visualDef={visualDef}
          debugVisuals={debugVisuals}
          ghost={ghost}
          valid={valid}
          darkDetail={darkDetail}
          adminHueEnabled={adminHueEnabled}
          adminHue={adminHue}
        />
      ))}
    </>
  );
};

const PlaceholderVisual = ({
  part,
  ghost,
  valid,
}: {
  part: PartDefinition;
  ghost: boolean;
  valid: boolean;
}) => {
  const triangle = useMemo(() => {
    if (part.placeholderMesh.type !== 'triangle-prism') return null;
    return triangleGeometry(part);
  }, [part]);

  const materialColor = ghost
    ? valid ? '#59e38a' : '#f05252'
    : '#8c8c8c';
  const materialOpacity = ghost ? 0.48 : 1;

  useEffect(() => {
    return () => {
      triangle?.dispose();
    };
  }, [triangle]);

  return (
    <>
      {part.placeholderMesh.type === 'box' ? (
        <mesh>
          <boxGeometry args={part.placeholderMesh.size} />
          <meshStandardMaterial color={materialColor} transparent={ghost} opacity={materialOpacity} roughness={0.8} />
        </mesh>
      ) : (
        <mesh geometry={triangle ?? undefined}>
          <meshStandardMaterial color={materialColor} transparent={ghost} opacity={materialOpacity} roughness={0.8} />
        </mesh>
      )}
      {!ghost && (
        <lineSegments>
          {part.placeholderMesh.type === 'box' ? (
            <edgesGeometry args={[new THREE.BoxGeometry(...part.placeholderMesh.size)]} />
          ) : triangle ? (
            <edgesGeometry args={[triangle]} />
          ) : null}
          <lineBasicMaterial color="#151515" />
        </lineSegments>
      )}
    </>
  );
};

const HighlightOverlay = ({ part, color }: { part: PartDefinition; color: string }) => {
  const triangle = useMemo(() => {
    if (part.placeholderMesh.type !== 'triangle-prism') return null;
    return triangleGeometry(part);
  }, [part]);

  useEffect(() => {
    return () => {
      triangle?.dispose();
    };
  }, [triangle]);

  return (
    <mesh raycast={() => null} geometry={triangle ?? undefined}>
      {part.placeholderMesh.type === 'box' && <boxGeometry args={part.placeholderMesh.size} />}
      <meshBasicMaterial color={color} transparent opacity={0.35} depthTest={false} />
    </mesh>
  );
};

export const PartMesh = ({
  partId,
  transform,
  debugVisuals = false,
  ghost = false,
  valid = true,
  highlightColor,
}: {
  partId: PartId;
  transform: Transform2D;
  debugVisuals?: boolean;
  ghost?: boolean;
  valid?: boolean;
  highlightColor?: string;
}) => {
  const part = PARTS[partId];
  const darkDetail = useV2BuilderStore((state) => state.darkDetail);
  const adminHueEnabled = useV2BuilderStore((state) => state.adminHueEnabled);
  const adminHue = useV2BuilderStore((state) => state.adminHue);
  const hasRenderableVisuals = Boolean(part.mesh || part.meshes?.length);

  return (
    <group
      position={[transform.position[0], transform.position[1] + part.yOffset, transform.position[2]]}
      rotation={[0, transform.rotationY, 0]}
    >
      {hasRenderableVisuals ? (
        <GltfVisuals
          part={part}
          debugVisuals={debugVisuals}
          ghost={ghost}
          valid={valid}
          darkDetail={darkDetail}
          adminHueEnabled={adminHueEnabled}
          adminHue={adminHue}
        />
      ) : (
        <PlaceholderVisual part={part} ghost={ghost} valid={valid} />
      )}
      {highlightColor && <HighlightOverlay part={part} color={highlightColor} />}
    </group>
  );
};

// Preload every GLB referenced by the registry so selecting a part never blocks
// on a first-time load. Without this, an unloaded GLB suspends the ghost mesh
// and (absent a Suspense boundary) freezes cursor-driven preview updates until
// the load finishes — making newly-added parts appear to "snap wrong" until a
// re-render flushed the stale preview. See SnapPreview Suspense in BuilderCanvas.
for (const part of Object.values(PARTS)) {
  const visualDefs = part.meshes ?? (part.mesh ? [part.mesh] : []);
  for (const visualDef of visualDefs) {
    if (!isReferenceCollisionVisual(visualDef)) {
      preloadObfuscatedGltf(visualDef.url);
    }
  }
}
