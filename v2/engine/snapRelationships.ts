import { EdgeAnchorDef, PartDefinition, SnapChannel } from '../types';

/**
 * Resolve the snap channel for a source part connecting to a specific target
 * edge. Edges declare their own exposed channels; an edge without explicit
 * channels falls back to the part-level target channels.
 */
export const getAnchorSnapChannel = (
  sourcePart: PartDefinition,
  targetPart: PartDefinition,
  targetAnchor: Pick<EdgeAnchorDef, 'channels'>
): SnapChannel | undefined => {
  const targetChannels = targetAnchor.channels ?? targetPart.snapTargetChannels;
  return sourcePart.snapSourceChannels.find((channel) => targetChannels.includes(channel));
};
