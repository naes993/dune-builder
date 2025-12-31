import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { BuildingType, BuildingData, UNIT_SIZE, FOUNDATION_HEIGHT, TRIANGLE_RADIUS, WALL_HEIGHT, HALF_WALL_HEIGHT, CURVE_RADIUS } from '../types';
import { calculateSnap } from '../utils/geometry';

interface SceneProps {
  buildings: BuildingData[];
  setBuildings: React.Dispatch<React.SetStateAction<BuildingData[]>>;
  activeType: BuildingType;
  showWireframe: boolean;
  materials: {
    ghost: THREE.MeshBasicMaterial;
    error: THREE.MeshBasicMaterial;
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
  materials: {
    ghost: THREE.MeshBasicMaterial;
    error: THREE.MeshBasicMaterial;
  };
}

const BuildingMesh = ({ type, position, rotation, isGhost, isValid = true, id, wireframe, materials }: BuildingMeshProps) => {
  // Helper to create geometries
  const content = useMemo(() => {
    if (type === BuildingType.SQUARE_FOUNDATION) {
       return (
         <>
           <boxGeometry args={[UNIT_SIZE, FOUNDATION_HEIGHT, UNIT_SIZE]} />
           <meshStandardMaterial color="#7c7c7c" roughness={0.8} wireframe={wireframe} />
           {!isGhost && <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(UNIT_SIZE, FOUNDATION_HEIGHT, UNIT_SIZE)]} /><meshBasicMaterial color="black" /></lineSegments>}
         </>
       );
    } else if (type === BuildingType.TRIANGLE_FOUNDATION) {
       return (
         <>
            <cylinderGeometry args={[TRIANGLE_RADIUS, TRIANGLE_RADIUS, FOUNDATION_HEIGHT, 3]} />
            <meshStandardMaterial color="#7c7c7c" roughness={0.8} wireframe={wireframe} />
            {!isGhost && <lineSegments><edgesGeometry args={[new THREE.CylinderGeometry(TRIANGLE_RADIUS, TRIANGLE_RADIUS, FOUNDATION_HEIGHT, 3)]} /><meshBasicMaterial color="black" /></lineSegments>}
         </>
       )
    } else if (type === BuildingType.CURVED_FOUNDATION) {
       // Quarter circle foundation - centered so straight edges align with square foundation edges
       // The piece is centered at origin, with the arc in the +X/+Z quadrant
       // Straight edges run along -X (at z=-halfSize) and -Z (at x=-halfSize)
       const halfSize = UNIT_SIZE / 2;
       const shape = new THREE.Shape();
       shape.moveTo(-halfSize, -halfSize);  // Corner at (-2, -2)
       shape.lineTo(halfSize, -halfSize);   // Along -Z edge to (+2, -2)
       shape.absarc(-halfSize, -halfSize, UNIT_SIZE, 0, Math.PI / 2, false); // Arc from (+2,-2) to (-2,+2)
       shape.lineTo(-halfSize, -halfSize);  // Back to corner

       const extrudeSettings = { depth: FOUNDATION_HEIGHT, bevelEnabled: false };
       return (
         <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -FOUNDATION_HEIGHT / 2, 0]}>
           <mesh>
             <extrudeGeometry args={[shape, extrudeSettings]} />
             {isGhost ? (
               <primitive object={isValid ? materials.ghost : materials.error} attach="material" />
             ) : (
               <meshStandardMaterial color="#7c7c7c" roughness={0.8} wireframe={wireframe} />
             )}
           </mesh>
         </group>
       );
    } else if (type === BuildingType.WALL) {
       return (
         <>
           <boxGeometry args={[UNIT_SIZE, WALL_HEIGHT, 0.2]} />
           <meshStandardMaterial color="#8a6e4b" roughness={0.9} wireframe={wireframe} />
         </>
       );
    } else if (type === BuildingType.HALF_WALL) {
       return (
         <>
           <boxGeometry args={[UNIT_SIZE, HALF_WALL_HEIGHT, 0.2]} />
           <meshStandardMaterial color="#8a6e4b" roughness={0.9} wireframe={wireframe} />
         </>
       );
    } else if (type === BuildingType.WINDOW_WALL) {
        return (
            <group>
                 <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[UNIT_SIZE, WALL_HEIGHT, 0.2]} />
                    <meshStandardMaterial color="#5a4e3b" roughness={0.9} transparent opacity={0.9} wireframe={wireframe} />
                 </mesh>
                 {!wireframe && <mesh position={[0, 0, 0.05]}>
                     <boxGeometry args={[UNIT_SIZE * 0.6, 1.5, 0.22]} />
                     <meshStandardMaterial color="#87CEEB" />
                 </mesh>}
            </group>
        );
    } else if (type === BuildingType.DOORWAY) {
        // Wall with door opening
        const wallShape = new THREE.Shape();
        const halfW = UNIT_SIZE / 2;
        const halfH = WALL_HEIGHT / 2;
        wallShape.moveTo(-halfW, -halfH);
        wallShape.lineTo(halfW, -halfH);
        wallShape.lineTo(halfW, halfH);
        wallShape.lineTo(-halfW, halfH);
        wallShape.lineTo(-halfW, -halfH);
        
        // Door hole
        const doorHole = new THREE.Path();
        const doorWidth = 1.2;
        const doorHeight = 2.4;
        doorHole.moveTo(-doorWidth / 2, -halfH);
        doorHole.lineTo(doorWidth / 2, -halfH);
        doorHole.lineTo(doorWidth / 2, -halfH + doorHeight);
        doorHole.lineTo(-doorWidth / 2, -halfH + doorHeight);
        doorHole.lineTo(-doorWidth / 2, -halfH);
        wallShape.holes.push(doorHole);
        
        const extrudeSettings = { depth: 0.2, bevelEnabled: false };
        return (
          <group rotation={[0, 0, 0]} position={[0, 0, -0.1]}>
            <mesh>
              <extrudeGeometry args={[wallShape, extrudeSettings]} />
              {isGhost ? (
                <primitive object={isValid ? materials.ghost : materials.error} attach="material" />
              ) : (
                <meshStandardMaterial color="#8a6e4b" roughness={0.9} wireframe={wireframe} />
              )}
            </mesh>
          </group>
        );
    } else if (type === BuildingType.SQUARE_ROOF) {
        return null;
    } else if (type === BuildingType.TRIANGLE_ROOF) {
         return (
             <group position={[0, 1.5, 0]}>
                 <mesh>
                    <coneGeometry args={[TRIANGLE_RADIUS, 3, 3]} />
                    {isGhost ? (
                        <primitive object={isValid ? materials.ghost : materials.error} attach="material" />
                    ) : (
                        <meshStandardMaterial color="#5D4037" wireframe={wireframe} />
                    )}
                 </mesh>
             </group>
         )
    } else if (type === BuildingType.STAIRS) {
        const steps = [];
        for(let i=0; i<8; i++) {
            steps.push(
                <mesh key={i} position={[0, (i * (3/8)) + (3/16), -2 + (i * 0.5) + 0.25]}>
                    <boxGeometry args={[4, 3/8, 0.5]} />
                    {isGhost ? 
                        <primitive object={isValid ? materials.ghost : materials.error} attach="material" /> : 
                        <meshStandardMaterial color="#6d5e4d" wireframe={wireframe} />
                    }
                </mesh>
            );
        }
        return <group>{steps}</group>;
    } else if (type === BuildingType.RAMP) {
        // Simple ramp - angled plane
        const rampLength = Math.sqrt(UNIT_SIZE * UNIT_SIZE + WALL_HEIGHT * WALL_HEIGHT);
        const rampAngle = Math.atan2(WALL_HEIGHT, UNIT_SIZE);
        return (
            <group>
                <mesh position={[0, WALL_HEIGHT / 2, 0]} rotation={[rampAngle, 0, 0]}>
                    <boxGeometry args={[UNIT_SIZE, 0.2, rampLength]} />
                    {isGhost ? 
                        <primitive object={isValid ? materials.ghost : materials.error} attach="material" /> : 
                        <meshStandardMaterial color="#6d5e4d" wireframe={wireframe} />
                    }
                </mesh>
                {/* Side rails */}
                {!wireframe && !isGhost && (
                    <>
                        <mesh position={[-UNIT_SIZE/2 + 0.1, WALL_HEIGHT / 2, 0]} rotation={[rampAngle, 0, 0]}>
                            <boxGeometry args={[0.2, 0.5, rampLength]} />
                            <meshStandardMaterial color="#4e3b2e" />
                        </mesh>
                        <mesh position={[UNIT_SIZE/2 - 0.1, WALL_HEIGHT / 2, 0]} rotation={[rampAngle, 0, 0]}>
                            <boxGeometry args={[0.2, 0.5, rampLength]} />
                            <meshStandardMaterial color="#4e3b2e" />
                        </mesh>
                    </>
                )}
            </group>
        );
    }
  }, [type, wireframe, isGhost, isValid, materials]);

  if (type === BuildingType.SQUARE_ROOF) {
      return (
          <group 
            position={position} 
            rotation={rotation}
            raycast={isGhost ? () => null : undefined}
          >
               <mesh position={[0, 1.5, 0]} rotation={[-Math.atan(3/4), 0, 0]}> 
                  <boxGeometry args={[4, 5, 0.2]} />
                   {isGhost ? (
                       <primitive object={isValid ? materials.ghost : materials.error} attach="material" />
                   ) : (
                       <meshStandardMaterial color="#5D4037" wireframe={wireframe} />
                   )}
               </mesh>
               {!wireframe && !isGhost && (
                   <group>
                       <mesh position={[-1.9, 0.75, 0.5]}>
                            <boxGeometry args={[0.2, 1.5, 4]} />
                            <meshStandardMaterial color="#4e3b2e" />
                       </mesh>
                       <mesh position={[1.9, 0.75, 0.5]}>
                            <boxGeometry args={[0.2, 1.5, 4]} />
                            <meshStandardMaterial color="#4e3b2e" />
                       </mesh>
                   </group>
               )}
          </group>
      )
  }

  let offsetY = 0;
  let geomRotationY = 0;
  if (type === BuildingType.SQUARE_FOUNDATION) offsetY = FOUNDATION_HEIGHT / 2;
  else if (type === BuildingType.TRIANGLE_FOUNDATION) {
      offsetY = FOUNDATION_HEIGHT / 2;
      geomRotationY = Math.PI;
  }
  else if (type === BuildingType.CURVED_FOUNDATION) {
      offsetY = FOUNDATION_HEIGHT / 2;
  }
  else if (type === BuildingType.WALL || type === BuildingType.WINDOW_WALL || type === BuildingType.DOORWAY) offsetY = WALL_HEIGHT / 2;
  else if (type === BuildingType.HALF_WALL) offsetY = HALF_WALL_HEIGHT / 2;

  return (
    <mesh
      position={[position[0], position[1] + offsetY, position[2]]}
      rotation={[rotation[0], rotation[1] + geomRotationY, rotation[2]]}
      userData={{ isBuilding: true, id }}
      raycast={isGhost ? () => null : undefined}
    >
      {isGhost && type !== BuildingType.STAIRS && type !== BuildingType.TRIANGLE_ROOF && type !== BuildingType.CURVED_FOUNDATION && type !== BuildingType.DOORWAY && type !== BuildingType.RAMP ? (
          <>
             {type === BuildingType.TRIANGLE_FOUNDATION ? 
                <cylinderGeometry args={[TRIANGLE_RADIUS, TRIANGLE_RADIUS, FOUNDATION_HEIGHT, 3]} /> :
                <boxGeometry args={[4, type === BuildingType.WALL || type === BuildingType.WINDOW_WALL ? 3 : type === BuildingType.HALF_WALL ? HALF_WALL_HEIGHT : 0.2, type === BuildingType.WALL || type === BuildingType.WINDOW_WALL || type === BuildingType.HALF_WALL ? 0.2 : 4]} />
             }
             <primitive object={isValid ? materials.ghost : materials.error} attach="material" />
          </>
      ) : content}
    </mesh>
  );
};

const Planner = ({ buildings, setBuildings, activeType, showWireframe, materials }: SceneProps) => {
  const { camera, raycaster, mouse } = useThree();
  const [ghostPos, setGhostPos] = useState<[number, number, number]>([0, 0, 0]);
  const [ghostRot, setGhostRot] = useState<[number, number, number]>([0, 0, 0]);
  const [ghostIsValid, setGhostIsValid] = useState(true);
  const [manualRot, setManualRot] = useState(0);

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        setManualRot(prev => prev + Math.PI / 2); // 90° rotation steps
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(groupRef.current.children, true);
    
    if (intersects.length > 0) {
       const targetPoint = intersects[0].point;
       const snap = calculateSnap(targetPoint, buildings, activeType, manualRot);
       if (snap) {
         setGhostPos([snap.position.x, snap.position.y, snap.position.z]);
         setGhostRot([snap.rotation.x, snap.rotation.y, snap.rotation.z]);
         setGhostIsValid(snap.isValid);
       }
    }
  });

  const handlePlace = (e: any) => {
    if (e.delta > 5) return;
    if (e.button === 0 && ghostIsValid) {
       e.stopPropagation();
       // FIX: Assign ghostPos and ghostRot directly to match BuildingData tuple type [number, number, number]
       const newBuilding: BuildingData = {
           id: crypto.randomUUID(),
           type: activeType,
           position: ghostPos,
           rotation: ghostRot,
       };
       setBuildings(prev => [...prev, newBuilding]);
    }
  };

  const removeBuilding = (id: string, e: any) => {
      e.stopPropagation();
      setBuildings(buildings.filter(b => b.id !== id));
  }

  return (
    <group ref={groupRef} onClick={handlePlace}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color="#E6C288" roughness={0.9} />
        </mesh>
        <gridHelper args={[1000, 250, 0x000000, 0x6b5c45]} position={[0, 0.01, 0]} />

        {buildings.map(b => (
          <group key={b.id} onContextMenu={(e) => removeBuilding(b.id, e)}>
             <BuildingMesh {...b} wireframe={showWireframe} materials={materials} />
          </group>
        ))}

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

export const GameScene = (props: Omit<SceneProps, 'materials'>) => {
  const materials = useMemo(() => ({
    ghost: new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.5 }),
    error: new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.5 })
  }), []);

  return (
    <Canvas shadows camera={{ position: [10, 15, 10], fov: 50 }}>
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#E6C288', 20, 100]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Planner {...props} materials={materials} />
      <OrbitControls 
        makeDefault 
        maxPolarAngle={Math.PI / 2 - 0.1}
        mouseButtons={{
            LEFT: -1 as any,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: THREE.MOUSE.PAN
        }}
      />
    </Canvas>
  );
};