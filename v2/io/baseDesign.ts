import { PARTS } from '../registry/parts';
import { AnchorBinding, PartId, PartInstance, PlacementMode, SnapChannel, Vec3 } from '../types';
import { V2_BUILD } from '../version';

export const BASE_DESIGN_SCHEMA = 'dune-builder-v2.base-design';
export const BASE_DESIGN_SCHEMA_VERSION = 1;

export interface BaseDesignDocument {
  schema: typeof BASE_DESIGN_SCHEMA;
  schemaVersion: typeof BASE_DESIGN_SCHEMA_VERSION;
  appBuild: string;
  exportedAt: string;
  instances: PartInstance[];
}

export interface ParsedBaseDesign {
  instances: PartInstance[];
  warnings: string[];
}

const PLACEMENT_MODES: PlacementMode[] = ['support-edge', 'wall-run', 'free-ground'];
const SNAP_CHANNELS: SnapChannel[] = ['foundation-structure', 'floor-support', 'wall-support', 'incline-edge'];

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isPartId = (value: unknown): value is PartId => {
  return typeof value === 'string' && value in PARTS;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isVec3 = (value: unknown): value is Vec3 => {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
};

const asOptionalString = (value: unknown) => (typeof value === 'string' ? value : undefined);

const asOptionalBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);

const asOptionalStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((entry): entry is string => typeof entry === 'string');
  return strings.length === value.length ? strings : undefined;
};

const sanitizeBinding = (value: unknown): AnchorBinding | undefined => {
  if (!isObject(value)) return undefined;
  const placementMode = value.placementMode;
  if (!PLACEMENT_MODES.includes(placementMode as PlacementMode)) return undefined;

  const snapChannel = value.snapChannel;

  return {
    placementMode: placementMode as PlacementMode,
    snapChannel: SNAP_CHANNELS.includes(snapChannel as SnapChannel) ? (snapChannel as SnapChannel) : undefined,
    sourceAnchorId: asOptionalString(value.sourceAnchorId),
    sourceEndpointId: asOptionalString(value.sourceEndpointId),
    targetInstanceId: asOptionalString(value.targetInstanceId),
    targetAnchorId: asOptionalString(value.targetAnchorId),
    targetWallInstanceId: asOptionalString(value.targetWallInstanceId),
    targetWallEndpointId: asOptionalString(value.targetWallEndpointId),
    occupancyKey: asOptionalString(value.occupancyKey),
    occupancyKeys: asOptionalStringArray(value.occupancyKeys),
    targetOccupied: asOptionalBoolean(value.targetOccupied),
  };
};

const sanitizeInstance = (value: unknown, index: number): PartInstance => {
  if (!isObject(value)) throw new Error(`Part ${index + 1} is not an object.`);
  if (!isPartId(value.partId)) throw new Error(`Part ${index + 1} uses an unknown part id.`);

  const transform = value.transform;
  if (!isObject(transform) || !isVec3(transform.position) || !isFiniteNumber(transform.rotationY)) {
    throw new Error(`Part ${index + 1} has an invalid transform.`);
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID();

  return {
    id,
    partId: value.partId,
    transform: {
      position: [...transform.position],
      rotationY: transform.rotationY,
    },
    binding: sanitizeBinding(value.binding),
  };
};

export const createBaseDesignDocument = (instances: PartInstance[]): BaseDesignDocument => ({
  schema: BASE_DESIGN_SCHEMA,
  schemaVersion: BASE_DESIGN_SCHEMA_VERSION,
  appBuild: V2_BUILD.id,
  exportedAt: new Date().toISOString(),
  instances,
});

export const serializeBaseDesign = (instances: PartInstance[]) => {
  return `${JSON.stringify(createBaseDesignDocument(instances), null, 2)}\n`;
};

export const parseBaseDesign = (jsonText: string): ParsedBaseDesign => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  if (!isObject(parsed)) throw new Error('Base design must be a JSON object.');
  if (parsed.schema !== BASE_DESIGN_SCHEMA) throw new Error('This is not a Dune Builder V2 base design file.');
  if (parsed.schemaVersion !== BASE_DESIGN_SCHEMA_VERSION) {
    throw new Error(`Unsupported base design schema version: ${String(parsed.schemaVersion)}.`);
  }
  if (!Array.isArray(parsed.instances)) throw new Error('Base design is missing its parts list.');

  const seenIds = new Set<string>();
  const instances = parsed.instances.map((entry, index) => {
    const instance = sanitizeInstance(entry, index);
    if (seenIds.has(instance.id)) {
      instance.id = crypto.randomUUID();
    }
    seenIds.add(instance.id);
    return instance;
  });

  return {
    instances,
    warnings: [],
  };
};

export const baseDesignFilename = () => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `dune-base-${stamp}.json`;
};
