import { PartDefinition, SnapChannel } from '../types';

export const FOUNDATION_TARGET_CHANNELS: SnapChannel[] = [
  'foundation-structure',
  'floor-support',
  'wall-support',
];

export const getCompatibleSnapChannels = (
  sourcePart: PartDefinition,
  targetPart: PartDefinition
) => {
  return sourcePart.snapSourceChannels.filter((channel) => {
    return targetPart.snapTargetChannels.includes(channel);
  });
};

export const getSnapRelationship = (
  sourcePart: PartDefinition,
  targetPart: PartDefinition
) => {
  return getCompatibleSnapChannels(sourcePart, targetPart)[0];
};

export const isSnapRelationshipAllowed = (
  sourcePart: PartDefinition,
  targetPart: PartDefinition
) => {
  return Boolean(getSnapRelationship(sourcePart, targetPart));
};
