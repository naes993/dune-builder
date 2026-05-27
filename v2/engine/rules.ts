import { getOccupancyConflicts } from './occupancy';
import { AnchorBinding, PartDefinition, PartInstance, PartRegistry, Transform2D } from '../types';
import { getWorldEdgeAnchors } from './anchors';

export const isWallEdgePart = (part: PartDefinition) => part.occupancyLayer === 'wall-edge';

const normalizeCoordinate = (value: number) => {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return (Math.round(normalized * 100) / 100).toFixed(2);
};

const normalizePoint = ([x, , z]: [number, number, number]) => {
  return `${normalizeCoordinate(x)},${normalizeCoordinate(z)}`;
};

export const getSupportEdgeSlotKey = (supportInstanceId: string, supportEdgeId: string) => {
  return `${supportInstanceId}:${supportEdgeId}`;
};

export const getWallSegmentKey = (
  part: PartDefinition,
  transform: Transform2D,
  sourceAnchorId?: string
) => {
  const anchor = getWorldEdgeAnchors(part, transform).find((candidate) => {
    return sourceAnchorId ? candidate.id === sourceAnchorId : true;
  });

  if (!anchor) return undefined;

  const endpoints = [normalizePoint(anchor.startWorld), normalizePoint(anchor.endWorld)].sort();
  return `wall-segment:${endpoints[0]}:${endpoints[1]}`;
};

const getInstanceWallSegmentKeys = (instance: PartInstance, registry: PartRegistry) => {
  const part = registry[instance.partId];
  if (!isWallEdgePart(part)) return [];

  return getWorldEdgeAnchors(part, instance.transform, instance.id).map((anchor) => {
    const endpoints = [normalizePoint(anchor.startWorld), normalizePoint(anchor.endWorld)].sort();
    return `wall-segment:${endpoints[0]}:${endpoints[1]}`;
  });
};

export const getOccupiedPlacementKeys = (instances: PartInstance[], registry: PartRegistry) => {
  const occupied = new Set<string>();

  for (const instance of instances) {
    const part = registry[instance.partId];
    if (!isWallEdgePart(part)) continue;

    for (const key of instance.binding?.occupancyKeys ?? []) {
      occupied.add(key);
    }
    if (instance.binding?.occupancyKey) {
      occupied.add(instance.binding.occupancyKey);
    }
    for (const key of getInstanceWallSegmentKeys(instance, registry)) {
      occupied.add(key);
    }
  }

  return occupied;
};

export const validatePlacement = (
  part: PartDefinition,
  transform: Transform2D,
  instances: PartInstance[],
  registry: PartRegistry,
  binding?: AnchorBinding
) => {
  const reasons: string[] = [];
  const occupiedPlacementKeys = getOccupiedPlacementKeys(instances, registry);
  const candidateKeys = binding?.occupancyKeys ?? (binding?.occupancyKey ? [binding.occupancyKey] : []);
  const placementKeyOccupied = candidateKeys.some((key) => occupiedPlacementKeys.has(key));
  const primaryKeyOccupied = Boolean(binding?.occupancyKey && occupiedPlacementKeys.has(binding.occupancyKey));

  if (isWallEdgePart(part) && candidateKeys.length > 0 && placementKeyOccupied) {
    reasons.push(
      binding?.placementMode === 'support-edge' && primaryKeyOccupied
        ? 'This foundation edge already has a wall or door.'
        : 'This wall segment is already occupied.'
    );
  }

  const useFootprintOccupancy = !isWallEdgePart(part) || candidateKeys.length === 0;
  const conflicts = useFootprintOccupancy ? getOccupancyConflicts(part, transform, instances, registry) : [];

  if (conflicts.length > 0) {
    reasons.push('Footprint overlaps an existing part on this layer.');
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
};
