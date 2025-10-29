import type { PresentationEvent, PresentationOverlayData } from '../stores/presentationStore';

/**
 * Type guards for PresentationEvent discriminated union
 */

// Type guard for events with data field
export function hasEventData(
  event: PresentationEvent,
): event is Extract<PresentationEvent, { data: unknown }> {
  return 'data' in event;
}

// Specific type guards for each event variant with data
export function isPlanningEvent(
  event: PresentationEvent,
): event is Extract<PresentationEvent, { type: 'planning' }> {
  return event.type === 'planning';
}

export function isBlockRequestEvent(
  event: PresentationEvent,
): event is Extract<PresentationEvent, { type: 'block-request' }> {
  return event.type === 'block-request';
}

export function isValidationResultEvent(
  event: PresentationEvent,
): event is Extract<PresentationEvent, { type: 'validation-result' }> {
  return event.type === 'validation-result';
}

export function isComboMilestoneEvent(
  event: PresentationEvent,
): event is Extract<PresentationEvent, { type: 'combo-milestone' }> {
  return event.type === 'combo-milestone';
}

export function isFileCreatedEvent(
  event: PresentationEvent,
): event is Extract<PresentationEvent, { type: 'file-created' }> {
  return event.type === 'file-created';
}

export function isVictoryEvent(
  event: PresentationEvent,
): event is Extract<PresentationEvent, { type: 'victory' }> {
  return event.type === 'victory';
}

/**
 * Helper to extract overlay data from event
 * Converts PresentationEvent to PresentationOverlayData shape
 *
 * This bridges the gap between strictly-typed events and the flexible overlayData
 * used by overlay components.
 */
export function extractOverlayData(event: PresentationEvent): PresentationOverlayData {
  if (!hasEventData(event)) {
    return {};
  }

  // Return the data field as-is (it matches PresentationOverlayData shape)
  return event.data;
}
