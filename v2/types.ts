export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export type PartId =
  | 'floor.harkonnen.level3.square'
  | 'floor.harkonnen.level3.wedge'
  | 'foundation.harkonnen.level3.square'
  | 'foundation.harkonnen.level3.wedge'
  | 'wall.harkonnen.level3.straight'
  | 'wall.harkonnen.level3.corner.tall'
  | 'wall.harkonnen.level3.inclined.tall'
  | 'wall.harkonnen.level3.door';
export type PartCategory = 'foundation' | 'floor' | 'wall' | 'wall-corner' | 'wall-door';
export type OccupancyLayer = 'foundation' | 'wall-edge';
export type AnchorKind = 'edge';
export type AnchorRole = 'foundation-edge';
export type PlacementMode = 'support-edge' | 'wall-run' | 'free-ground';
export type SnapChannel = 'foundation-structure' | 'floor-support' | 'wall-support';
export type SnapProfile = 'floor' | 'foundation' | 'wall';

export interface EdgeAnchorDef {
  id: string;
  kind: AnchorKind;
  role: AnchorRole;
  start: Vec3;
  end: Vec3;
  normal: Vec3;
  /** Snap channels this edge exposes as a target. Empty array = source-only edge. */
  channels?: SnapChannel[];
  /** Whether this edge may be used as a source anchor on the active part. Default true. */
  source?: boolean;
}

export interface FootprintDef {
  type: 'polygon';
  points: Vec2[];
}

export interface PlaceholderMeshDef {
  type: 'box' | 'triangle-prism';
  size: Vec3;
}

export interface MaterialOverrideDef {
  color?: string;
  metalness?: number;
  roughness?: number;
}

export interface MeshVisualDef {
  url: string;
  scale?: Vec3;
  offset?: Vec3;
  rotation?: Vec3;
  materialOverride?: MaterialOverrideDef;
}

export interface PartDefinition {
  id: PartId;
  name: string;
  category: PartCategory;
  occupancyLayer: OccupancyLayer;
  snapProfile: SnapProfile;
  snapSourceChannels: SnapChannel[];
  snapTargetChannels: SnapChannel[];
  height: number;
  yOffset: number;
  allowedRotations: number[];
  anchors: EdgeAnchorDef[];
  footprint: FootprintDef;
  placeholderMesh: PlaceholderMeshDef;
  mesh?: MeshVisualDef;
  meshes?: MeshVisualDef[];
}

export interface Transform2D {
  position: Vec3;
  rotationY: number;
}

export interface PartInstance {
  id: string;
  partId: PartId;
  transform: Transform2D;
  binding?: AnchorBinding;
}

export interface WorldEdgeAnchor extends EdgeAnchorDef {
  partId: PartId;
  instanceId?: string;
  startWorld: Vec3;
  endWorld: Vec3;
  centerWorld: Vec3;
  normalWorld: Vec3;
  length: number;
}

export interface AnchorBinding {
  placementMode: PlacementMode;
  snapChannel?: SnapChannel;
  sourceAnchorId?: string;
  sourceEndpointId?: string;
  targetInstanceId?: string;
  targetAnchorId?: string;
  targetWallInstanceId?: string;
  targetWallEndpointId?: string;
  occupancyKey?: string;
  occupancyKeys?: string[];
  targetOccupied?: boolean;
}

export interface PlacementCandidate {
  transform: Transform2D;
  isValid: boolean;
  reasons: string[];
  snapped: boolean;
  placementMode: PlacementMode;
  binding?: AnchorBinding;
}

export interface SnapSolverInput {
  cursor: Vec3;
  activePartId: PartId;
  rotationY: number;
  instances: PartInstance[];
  snapRadius?: number;
}

export type PartRegistry = Record<PartId, PartDefinition>;
