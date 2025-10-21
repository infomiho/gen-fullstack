-- Migration: Add unique constraint for message_id per session
-- This prevents duplicate messages from being inserted due to race conditions
-- in the upsertMessage function during streaming

CREATE UNIQUE INDEX IF NOT EXISTS timeline_items_session_message_idx
ON timeline_items(session_id, message_id)
WHERE message_id IS NOT NULL;
