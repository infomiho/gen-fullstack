-- Migration: Add unique constraint for stage_id per session
-- This enables UPSERT operations for pipeline stages, allowing them to update
-- in-place (e.g., "started" → "completed") while preserving timeline position

CREATE UNIQUE INDEX IF NOT EXISTS timeline_items_session_stage_idx
ON timeline_items(session_id, stage_id)
WHERE stage_id IS NOT NULL;
