#!/bin/bash
SESSION_ID="$1"
DB_PATH="/Users/ilakovac/dev/gen-fullstack/server/data/gen-fullstack.db"
GEN_PATH="/Users/ilakovac/dev/gen-fullstack/generated"

if [ -z "$SESSION_ID" ]; then
  echo "Usage: ./analyze-session.sh <session-id>"
  exit 1
fi

echo "========================================="
echo "SESSION ANALYSIS: $SESSION_ID"
echo "========================================="
echo

echo "=== 1. SESSION OVERVIEW ==="
sqlite3 "$DB_PATH" <<EOF
.headers on
.mode list
SELECT
  'Prompt: ' || prompt || '
Strategy: ' || capability_config || '
Status: ' || status || '
Error: ' || COALESCE(error_message, 'None') || '
Duration: ' || duration_ms || 'ms
Steps: ' || step_count
FROM sessions WHERE id = '$SESSION_ID';
EOF
echo

echo "=== 2. PROMPT ANALYSIS (CRITICAL!) ==="
echo "--- Checking if prompts are saved ---"
SYSTEM_PROMPT=$(sqlite3 "$DB_PATH" "SELECT system_prompt FROM sessions WHERE id = '$SESSION_ID';")
if [ -n "$SYSTEM_PROMPT" ]; then
  echo "✅ System prompt found in database"
  echo ""
  echo "--- Checking for common issues ---"
  echo "$SYSTEM_PROMPT" | grep -q "tsx" && echo "✅ tsx mentioned" || echo "⚠️  tsx NOT mentioned (might use ts-node-dev)"
  echo "$SYSTEM_PROMPT" | grep -q "COMMON DEPENDENCY VERSIONS" && echo "✅ Dependency versions specified" || echo "⚠️  No dependency versions (LLM will guess)"
  echo "$SYSTEM_PROMPT" | grep -q "installNpmDep" && echo "⚠️  installNpmDep mentioned (check if naive mode)" || echo "✅ No installNpmDep mention"
  echo ""
  echo "--- First 30 lines of system prompt ---"
  echo "$SYSTEM_PROMPT" | head -30
  echo ""
  echo "💡 TIP: To see full system prompt, run:"
  echo "   sqlite3 \"$DB_PATH\" \"SELECT system_prompt FROM sessions WHERE id = '$SESSION_ID';\" | less"
else
  echo "❌ System prompt not found (old session before prompt tracking was added)"
fi
echo

echo "=== 3. TIMELINE SUMMARY ==="
sqlite3 "$DB_PATH" <<EOF
.headers on
.mode column
SELECT
  type,
  COUNT(*) as count
FROM timeline_items
WHERE session_id = '$SESSION_ID'
GROUP BY type;
EOF
echo

echo "=== 4. ERRORS FOUND ==="
sqlite3 "$DB_PATH" <<EOF
.headers off
.mode list
SELECT
  '[ERROR]
' || result
FROM timeline_items
WHERE session_id = '$SESSION_ID'
  AND type = 'tool_result'
  AND is_error = 1
ORDER BY timestamp ASC;
EOF
echo

echo "=== 5. GENERATED FILES ==="
sqlite3 "$DB_PATH" <<EOF
.headers on
.mode column
SELECT
  path,
  length(content) as size
FROM files
WHERE session_id = '$SESSION_ID'
ORDER BY path;
EOF
echo

echo "=== 6. DISK CHECK ==="
if [ -d "$GEN_PATH/$SESSION_ID" ]; then
  echo "✅ Generated directory exists"
  ls -lh "$GEN_PATH/$SESSION_ID" | head -20
else
  echo "❌ Generated directory not found"
fi
echo

echo "=== 7. NAVIGATION ANALYSIS ==="
echo "--- Routes Defined ---"
grep -r "path=" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null | grep -E "<Route" | head -10
echo "--- Navigate Calls ---"
grep -rn "navigate(" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null | wc -l | xargs -I {} echo "{} navigate() calls found"
echo "--- Query Params ---"
grep -rn "useParams\|useSearchParams" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null | wc -l | xargs -I {} echo "{} param hooks found"
echo

echo "=== 8. COORDINATION CHECK ==="
echo "--- Polling Logic ---"
grep -rn "setInterval\|useInterval" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null | wc -l | xargs -I {} echo "{} intervals found"
echo "--- WebSocket ---"
grep -rn "socket\|ws:" "$GEN_PATH/$SESSION_ID" 2>/dev/null | wc -l | xargs -I {} echo "{} WebSocket references found"
echo "--- Key Pages ---"
ls "$GEN_PATH/$SESSION_ID/client/src/pages" 2>/dev/null | head -10
echo

echo "=== 9. INTEGRATION CHECK ==="
echo "--- API Endpoints ---"
grep -rn "router\.\(get\|post\|put\|delete\)" "$GEN_PATH/$SESSION_ID/server/src" 2>/dev/null | wc -l | xargs -I {} echo "{} API endpoints defined"
echo "--- Frontend API Calls ---"
grep -rn "fetch(" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null | wc -l | xargs -I {} echo "{} fetch() calls found"
echo

echo "========================================="
echo "Analysis complete. Check above for issues."
echo "========================================="
echo
echo "⚠️  CRITICAL: Check Section 2 (Prompt Analysis) first!"
echo "   Most failures stem from incorrect system prompts."
echo
echo "💡 TIP: For multi-user apps, also verify:"
echo "   - Are all routes reachable via navigate() or <Link>?"
echo "   - Do lobby pages poll for state changes?"
echo "   - Are query params (playerId, etc.) passed through?"
echo "   - Is critical data (prompts, scores) displayed?"
echo
echo "📖 See Step 3 (Prompt Analysis) in SESSION-ANALYSIS-COOKBOOK.md"
echo "   for detailed prompt checking guidance."
echo "📖 See Steps 11-15 for coordination and navigation checks."
