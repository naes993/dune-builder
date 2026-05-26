import { getOccupancyConflicts } from './occupancy';
import { PartDefinition, PartInstance, PartRegistry, Transform2D } from '../types';

export const validatePlacement = (
  part: PartDefinition,
  transform: Transform2D,
  instances: PartInstance[],
  registry: PartRegistry
) => {
  const reasons: string[] = [];
  const conflicts = getOccupancyConflicts(part, transform, instances, registry);

  if (conflicts.length > 0) {
    reasons.push('Footprint overlaps an existing part on this layer.');
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
};
