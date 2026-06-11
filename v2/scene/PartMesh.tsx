import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PARTS } from '../registry/parts';
import { MaterialOverrideDef, MeshVisualDef, PartDefinition, PartId, Transform2D } from '../types';

const HARKONNEN_EXTERIOR_MATERIAL: Required<MaterialOverrideDef> = {
  color: '#050505',
  metalness: 0.35,
  roughness: 0.7,
};

const HARKONNEN_INTERIOR_MATERIAL: Required<MaterialOverrideDef> = {
  color: '#9a9a9a',
  metalness: 0.45,
  roughness: 0.55,
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
  partOverride?: MaterialOverrideDef
) => {
  if (originalMaterialName.includes('_Ext')) {
    return HARKONNEN_EXTERIOR_MATERIAL;
  }

  if (originalMaterialName.includes('_Int')) {
    return HARKONNEN_INTERIOR_MATERIAL;
  }

  return partOverride;
};

const createMaterial = (
  ghost: boolean,
  valid: boolean,
  override?: MaterialOverrideDef,
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
  });
  material.name = sourceName ? `${sourceName}:v2-override` : 'v2-override';
  return material;
};

const createVisualMaterial = (
  sourceMaterial: THREE.Material | null | undefined,
  ghost: boolean,
  valid: boolean,
  partOverride?: MaterialOverrideDef
) => {
  const sourceName = sourceMaterial?.name ?? '';
  const override = ghost
    ? partOverride
    : resolveMaterialOverride(sourceName, partOverride);

  return createMaterial(ghost, valid, override, sourceName);
};

const applyVisualMaterials = (
  root: THREE.Object3D,
  ghost: boolean,
  valid: boolean,
  override?: MaterialOverrideDef
) => {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const sourceMaterial = mesh.material;
    mesh.material = Array.isArray(sourceMaterial)
      ? sourceMaterial.map((material) => createVisualMaterial(material, ghost, valid, override))
      : createVisualMaterial(sourceMaterial, ghost, valid, override);
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
}: {
  visualDef: MeshVisualDef;
  debugVisuals: boolean;
  ghost: boolean;
  valid: boolean;
}) => {
  const gltf = useGLTF(visualDef.url);
  const visual = useMemo(() => {
    const clone = cloneSkeleton(gltf.scene);
    applyVisualMaterials(clone, ghost, valid, visualDef.materialOverride);
    return clone;
  }, [gltf.scene, ghost, valid, visualDef.materialOverride]);

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
  const helper = useMemo(() => new THREE.BoxHelper(object, color), [color, object]);

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
}: {
  part: PartDefinition;
  debugVisuals: boolean;
  ghost: boolean;
  valid: boolean;
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

export const PartMesh = ({
  partId,
  transform,
  debugVisuals = false,
  ghost = false,
  valid = true,
}: {
  partId: PartId;
  transform: Transform2D;
  debugVisuals?: boolean;
  ghost?: boolean;
  valid?: boolean;
}) => {
  const part = PARTS[partId];
  const hasRenderableVisuals = Boolean(part.mesh || part.meshes?.length);

  return (
    <group
      position={[transform.position[0], transform.position[1] + part.yOffset, transform.position[2]]}
      rotation={[0, transform.rotationY, 0]}
    >
      {hasRenderableVisuals ? (
        <GltfVisuals part={part} debugVisuals={debugVisuals} ghost={ghost} valid={valid} />
      ) : (
        <PlaceholderVisual part={part} ghost={ghost} valid={valid} />
      )}
    </group>
  );
};

useGLTF.preload('/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_Wall_01.glb');
useGLTF.preload('/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_WallCorner_Tall.glb');
useGLTF.preload('/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_WallInclined_Tall.glb');
useGLTF.preload('/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_DoorFrame.glb');
useGLTF.preload('/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_Door.glb');
useGLTF.preload('/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_Floor.glb');
useGLTF.preload('/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_Foundation.glb');
useGLTF.preload('/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_FloorWedge.glb');
useGLTF.preload('/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_FoundationWedge.glb');
