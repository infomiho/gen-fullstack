# Session Analysis Cookbook

**A step-by-step guide for analyzing Gen Fullstack sessions to understand failures and improve the system.**

## Quick Reference

```bash
# Database location
DB_PATH="/Users/ilakovac/dev/gen-fullstack/server/data/gen-fullstack.db"

# Generated files location
GEN_PATH="/Users/ilakovac/dev/gen-fullstack/generated"

# Example session ID
SESSION_ID="5083b604-8829-4fae-93b3-af8fad133c82"
```

## Database Schema Reference

### sessions table
```
id                  TEXT PRIMARY KEY
prompt              TEXT NOT NULL (original user input)
full_user_prompt    TEXT (full prompt sent to LLM, may include context)
system_prompt       TEXT (system prompt sent to LLM)
capability_config   TEXT NOT NULL (JSON)
status              TEXT NOT NULL (pending/generating/completed/failed/cancelled)
created_at          INTEGER (timestamp_ms)
updated_at          INTEGER (timestamp_ms)
completed_at        INTEGER (timestamp_ms)
error_message       TEXT
input_tokens        INTEGER
output_tokens       INTEGER
total_tokens        INTEGER
cost                TEXT
duration_ms         INTEGER
step_count          INTEGER
```

**Note**: `system_prompt` and `full_user_prompt` were added recently. Older sessions will have NULL values for these columns.

### timeline_items table
```
id                  INTEGER PRIMARY KEY
session_id          TEXT NOT NULL
timestamp           INTEGER NOT NULL (timestamp_ms)
type                TEXT NOT NULL (message/tool_call/tool_result)
-- For type='message':
message_id          TEXT
role                TEXT (user/assistant/system)
content             TEXT
-- For type='tool_call':
tool_call_id        TEXT
tool_name           TEXT
tool_args           TEXT (JSON)
tool_reason         TEXT
-- For type='tool_result':
tool_result_id      TEXT
tool_result_for     TEXT (references tool_call_id)
result              TEXT
is_error            INTEGER (0 or 1)
```

### files table
```
id                  INTEGER PRIMARY KEY
session_id          TEXT NOT NULL
path                TEXT NOT NULL
content             TEXT NOT NULL
created_at          INTEGER (timestamp_ms)
updated_at          INTEGER (timestamp_ms)
```

---

## Step-by-Step Analysis Process

### Step 1: Get Session Overview

**Purpose**: Understand what was requested, what strategy was used, and whether it succeeded.

```bash
sqlite3 "$DB_PATH" <<EOF
.headers on
.mode column
SELECT
  id,
  substr(prompt, 1, 80) || '...' as prompt_preview,
  capability_config,
  status,
  datetime(created_at/1000, 'unixepoch', 'localtime') as created,
  datetime(completed_at/1000, 'unixepoch', 'localtime') as completed,
  error_message,
  input_tokens,
  output_tokens,
  duration_ms,
  step_count
FROM sessions
WHERE id = '$SESSION_ID';
EOF
```

**What to check**:
- ✅ **status**: 'completed' = success, 'failed' = something went wrong
- ✅ **error_message**: If status='failed', this tells you what broke
- ✅ **capability_config**: Which strategy was used (naive, plan-first, template, compiler-check)
- ✅ **duration_ms**: How long it took (timeouts are often >120000ms)
- ✅ **step_count**: How many LLM interactions happened

---

### Step 2: Get Full User Prompt

**Purpose**: See exactly what the user asked for.

```bash
sqlite3 "$DB_PATH" <<EOF
.headers off
.mode list
SELECT prompt FROM sessions WHERE id = '$SESSION_ID';
EOF
```

**What to check**:
- Is the prompt clear and specific?
- Does it ask for too many features at once?
- Are there ambiguous requirements?

---

### Step 3: Analyze System and User Prompts (Critical for Finding Root Causes!)

**Purpose**: Examine the actual prompts sent to the LLM to identify incorrect instructions, missing guidance, or contradictions.

**Why this matters**: Many failures stem from **what the LLM was told to do**, not what it actually did. If the system prompt says "use ts-node-dev" but the template uses "tsx", the LLM will generate broken apps no matter how smart it is.

#### 3a. Extract System Prompt

```bash
# System prompt is stored in the database (added recently, older sessions may not have it)
sqlite3 "$DB_PATH" <<EOF
.headers off
.mode list
SELECT COALESCE(system_prompt, '❌ System prompt not found (old session)')
FROM sessions
WHERE id = '$SESSION_ID';
EOF
```

**Alternative** (save to file for easier reading):
```bash
sqlite3 "$DB_PATH" "SELECT system_prompt FROM sessions WHERE id = '$SESSION_ID';" > /tmp/system-prompt.txt
cat /tmp/system-prompt.txt
```

**What to check**:
- ✅ **Dependency versions**: Does it specify exact versions or let LLM guess?
  - ❌ BAD: "Use Tailwind CSS 4" (LLM guesses `@tailwindcss/vite@^1.0.0` which doesn't exist)
  - ✅ GOOD: "Use @tailwindcss/vite@^4.0.27 and tailwindcss@^4.0.27"

- ✅ **Tool availability**: Does it mention tools that aren't available for this input mode?
  - ❌ BAD: Prompt for `inputMode: 'naive'` says "use installNpmDep" but tool is filtered out
  - ✅ GOOD: Prompt for `inputMode: 'naive'` says "write complete package.json", prompt for `inputMode: 'template'` says "use installNpmDep"

- ✅ **Dev script instructions**: Does it specify the correct dev runner?
  - ❌ BAD: No mention of tsx vs ts-node-dev (LLM guesses wrong one)
  - ✅ GOOD: "Use tsx for server dev script: `PORT=3000 tsx watch src/index.ts`"

- ✅ **Configuration consistency**: Do instructions match the actual template?
  - ❌ BAD: Prompt says "use Vite 5" but template has Vite 7
  - ✅ GOOD: Prompt versions match template's package.json

- ✅ **Contradictions**: Are there conflicting instructions?
  - ❌ BAD: Base prompt says "write package.json with writeFile" AND "use installNpmDep" (which should it do?)
  - ✅ GOOD: Clear separation - naive uses writeFile, template uses installNpmDep

#### 3b. Extract User Prompts (from database)

```bash
# Original user input
echo "=== Original User Prompt ==="
sqlite3 "$DB_PATH" <<EOF
.headers off
.mode list
SELECT prompt FROM sessions WHERE id = '$SESSION_ID';
EOF

echo ""
echo "=== Full User Prompt (sent to LLM) ==="
# This includes any system-added context or formatting
sqlite3 "$DB_PATH" <<EOF
.headers off
.mode list
SELECT COALESCE(full_user_prompt, '❌ Full prompt not found (old session)')
FROM sessions WHERE id = '$SESSION_ID';
EOF
```

**What to check**:
- Is it asking for features that require multi-user coordination?
- Does it mention specific tech (React Router, Tailwind) that might need special handling?
- Are there implied requirements not explicitly stated?
- Does the full prompt add helpful context, or does it confuse the LLM?

#### 3c. Compare Against Template (if inputMode: 'template')

```bash
# Check what versions the template actually uses
echo "=== Template Versions ==="
cat "$GEN_PATH/../templates/vite-fullstack-base/client/package.json" | grep -A20 '"dependencies":'
cat "$GEN_PATH/../templates/vite-fullstack-base/server/package.json" | grep -A15 '"dependencies":'
```

**What to check**:
- Do system prompt versions match template versions?
- Does the prompt mention template features (Tailwind 4, React Router 7)?
- Are there mismatches that would confuse the LLM?

#### 3d. Check Capability Config (what configuration was used)

```bash
sqlite3 "$DB_PATH" <<EOF
.headers off
.mode list
SELECT capability_config FROM sessions WHERE id = '$SESSION_ID';
EOF
```

**What to check**:
- `inputMode`: 'naive' or 'template'
- `planning`: true/false
- `compilerChecks`: true/false
- `buildingBlocks`: true/false

**Cross-check**: Does the system prompt match the inputMode?
- `inputMode: 'naive'` should NOT mention template-specific features
- `inputMode: 'template'` should NOT tell LLM to create config files (they already exist)

#### 3e. Common Prompt Issues (Real Examples)

**Issue 1: Version Guessing** (Session 534dd3c2)
```
❌ PROBLEM: Prompt said "Use Tailwind CSS 4" without version
🤖 LLM GUESSED: @tailwindcss/vite@^1.0.0 (doesn't exist!)
💥 RESULT: npm install failed with "404 Not Found"

✅ FIX: Added "COMMON DEPENDENCY VERSIONS" section to base prompt
```

**Issue 2: Wrong Dev Runner** (Session 93307df0)
```
❌ PROBLEM: Prompt didn't specify tsx vs ts-node-dev
🤖 LLM GUESSED: ts-node-dev (doesn't work with ES modules!)
💥 RESULT: "Must use import to load ES Module" error

✅ FIX: Added "SERVER DEV SCRIPT" section mandating tsx
```

**Issue 3: Tool Availability Mismatch** (Session 534dd3c2)
```
❌ PROBLEM: Base prompt mentioned installNpmDep in naive mode
🤖 LLM CALLED: installNpmDep before package.json existed
💥 RESULT: Tool failed, wasted tool calls, confused LLM

✅ FIX: Filtered installNpmDep from naive mode, updated base prompt
```

**Issue 4: Missing Coordination Guidance** (Session 5083b604)
```
❌ PROBLEM: No prompt guidance on multi-user state sync
🤖 LLM GENERATED: Perfect components but no polling logic
💥 RESULT: Players stuck in lobby, can't detect when host starts round

✅ FIX: Need to add multi-user patterns to system prompt (TODO)
```

#### 3f. Prompt Analysis Checklist

When analyzing prompts, check these critical areas:

**Dependency Management**:
- [ ] Exact versions specified for all major dependencies?
- [ ] Versions match template (if template mode)?
- [ ] Versions are actually published to npm?

**Tool Instructions**:
- [ ] Tool availability matches inputMode (naive vs template)?
- [ ] Clear workflow (write vs merge dependencies)?
- [ ] No contradictory instructions?

**Configuration**:
- [ ] Dev scripts specified (tsx, not ts-node-dev)?
- [ ] Vite config mentioned (especially for Tailwind 4)?
- [ ] React Router setup explained?

**Multi-User Guidance** (for apps with multiple user roles):
- [ ] Polling/coordination patterns mentioned?
- [ ] State sync requirements explained?
- [ ] Query param flow guidance?

**Architecture Patterns**:
- [ ] Monorepo structure clear?
- [ ] File organization specified?
- [ ] API endpoint conventions mentioned?

---

### Step 4: Analyze Timeline (Overview)

**Purpose**: See the flow of messages and tool calls.

**Note**: Steps 3a-3f above are CRITICAL for finding root causes. Don't skip prompt analysis!

```bash
sqlite3 "$DB_PATH" <<EOF
.headers on
.mode column
SELECT
  id,
  datetime(timestamp/1000, 'unixepoch', 'localtime') as time,
  type,
  role,
  tool_name,
  CASE
    WHEN type = 'message' THEN substr(content, 1, 60) || '...'
    WHEN type = 'tool_call' THEN tool_name || '(' || substr(tool_args, 1, 40) || '...)'
    WHEN type = 'tool_result' AND is_error = 1 THEN 'ERROR: ' || substr(result, 1, 60)
    WHEN type = 'tool_result' THEN 'Success'
  END as summary
FROM timeline_items
WHERE session_id = '$SESSION_ID'
ORDER BY timestamp ASC;
EOF
```

**What to check**:
- ✅ **Flow**: user message → assistant message → tool calls → tool results → repeat
- ✅ **Errors**: Look for `is_error = 1` in tool_result rows
- ✅ **Stuck patterns**: Same tool called repeatedly with errors
- ✅ **Abrupt ending**: Generation ended without completion message

---

### Step 4: Deep Dive into Messages

**Purpose**: See what the LLM was thinking and planning.

```bash
sqlite3 "$DB_PATH" <<EOF
.headers on
.mode list
.separator '\n---\n'
SELECT
  '[' || datetime(timestamp/1000, 'unixepoch', 'localtime') || '] ' ||
  role || ': ' || content
FROM timeline_items
WHERE session_id = '$SESSION_ID' AND type = 'message'
ORDER BY timestamp ASC;
EOF
```

**What to check**:
- First assistant message often contains the plan
- Look for misunderstandings or wrong assumptions
- Check if LLM acknowledged all requirements from prompt

---

### Step 5: Deep Dive into Tool Calls

**Purpose**: See what files were created and what commands were run.

```bash
# Get all tool calls with their arguments
sqlite3 "$DB_PATH" <<EOF
.headers on
.mode list
SELECT
  '[' || tool_name || ']
Reason: ' || tool_reason || '
Args: ' || tool_args || '
---'
FROM timeline_items
WHERE session_id = '$SESSION_ID' AND type = 'tool_call'
ORDER BY timestamp ASC;
EOF
```

**What to check**:
- ✅ **writeFile**: Check file paths and content being written
- ✅ **readFile**: See what files LLM is reading (debugging itself?)
- ✅ **getFileTree**: Check if LLM is exploring the directory structure
- ✅ **validateTypeScript/validatePrismaSchema**: Check validation results (if enabled)
- ℹ️ **executeCommand** (deprecated): Old sessions may have this; command execution now happens in Docker phases

---

### Step 6: Deep Dive into Tool Results (Errors)

**Purpose**: Find the actual errors that stopped generation.

```bash
sqlite3 "$DB_PATH" <<EOF
.headers on
.mode list
SELECT
  '[ERROR in ' || tool_result_for || ']
' || result || '
---'
FROM timeline_items
WHERE session_id = '$SESSION_ID'
  AND type = 'tool_result'
  AND is_error = 1
ORDER BY timestamp ASC;
EOF
```

**What to check**:
- ✅ **File system errors**: Permission denied, path not found
- ✅ **Command errors**: npm install failures, TypeScript errors
- ✅ **Syntax errors**: Malformed JSON, invalid file paths
- ✅ **Timeout errors**: Commands taking too long

---

### Step 7: Check Generated Files

**Purpose**: See what files were actually created on disk.

```bash
# List all files in the generated session directory
ls -lR "$GEN_PATH/$SESSION_ID" 2>/dev/null || echo "❌ Generated directory not found"

# Check if key files exist
echo "=== Key Files ==="
test -f "$GEN_PATH/$SESSION_ID/package.json" && echo "✅ package.json" || echo "❌ package.json"
test -f "$GEN_PATH/$SESSION_ID/client/package.json" && echo "✅ client/package.json" || echo "❌ client/package.json"
test -f "$GEN_PATH/$SESSION_ID/server/package.json" && echo "✅ server/package.json" || echo "❌ server/package.json"
test -f "$GEN_PATH/$SESSION_ID/prisma/schema.prisma" && echo "✅ prisma/schema.prisma" || echo "❌ prisma/schema.prisma"
```

**What to check**:
- ✅ **Directory structure**: Does it match the expected monorepo layout?
- ✅ **File presence**: Are all critical files there?
- ✅ **File sizes**: Are any files suspiciously small (empty) or large (too much code)?

---

### Step 8: Read Specific Generated Files

**Purpose**: Examine the actual code to find issues.

```bash
# Check package.json files
echo "=== Root package.json ==="
cat "$GEN_PATH/$SESSION_ID/package.json"

echo "=== Prisma Schema ==="
cat "$GEN_PATH/$SESSION_ID/prisma/schema.prisma"

echo "=== Server main file ==="
cat "$GEN_PATH/$SESSION_ID/server/src/index.ts" 2>/dev/null || echo "Not found"

echo "=== Client main file ==="
cat "$GEN_PATH/$SESSION_ID/client/src/main.tsx" 2>/dev/null || echo "Not found"
```

**What to check**:
- ✅ **Dependencies**: Are all required packages in package.json?
- ✅ **Prisma schema**: Valid syntax? Missing fields?
- ✅ **Imports**: Are paths correct?
- ✅ **API endpoints**: Do they match the schema?

---

### Step 9: Query Database for Files (Alternative)

**Purpose**: Check what files are stored in the database (may differ from disk).

```bash
sqlite3 "$DB_PATH" <<EOF
.headers on
.mode column
SELECT
  path,
  length(content) as size_bytes,
  datetime(updated_at/1000, 'unixepoch', 'localtime') as last_updated
FROM files
WHERE session_id = '$SESSION_ID'
ORDER BY path;
EOF
```

**What to check**:
- ✅ **File count**: Should have 10-20 files for a typical app
- ✅ **Zero-size files**: Indicates writeFile might have failed
- ✅ **File paths**: Should match expected structure

---

### Step 10: Read File Content from Database

**Purpose**: Get exact file content as written by LLM.

```bash
# Example: Read package.json from database
sqlite3 "$DB_PATH" <<EOF
.headers off
.mode list
SELECT content
FROM files
WHERE session_id = '$SESSION_ID'
  AND path = 'package.json';
EOF
```

---

### Step 11: Navigation Path Analysis (Critical for Multi-Page Apps)

**Purpose**: Verify all routes are reachable and query params flow correctly.

```bash
# Extract all routes and navigation calls
echo "=== Defined Routes ==="
grep -r "path=" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null | grep -E "<Route"

echo "=== Navigation Calls ==="
grep -rn "navigate(" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null

echo "=== Link Components ==="
grep -rn "<Link to=" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null

echo "=== useParams() Usage ==="
grep -rn "useParams" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null
```

**What to check**:
- ❌ **Orphaned routes**: Routes defined in `<Route>` but no `navigate()` or `<Link>` points to them
- ❌ **Missing params**: Route expects `:playerId` but navigation doesn't pass `?playerId=...`
- ❌ **Broken chains**: User journey requires params to flow from Page A → B → C, but B doesn't pass params to C
- ❌ **Dead ends**: Page has no way to navigate away (no links, no back button logic)

**Example Issue**:
```tsx
// Route defined: /play/:code/rounds/:roundId
<Route path="/play/:code/rounds/:roundId" element={<PlayerRound />} />

// But NO navigation to it anywhere in PlayerLobby!
// Players can never reach this page → orphaned route
```

---

### Step 12: Multi-User Coordination Check (Critical for Multi-Player Apps)

**Purpose**: Detect missing real-time sync logic between different user roles.

```bash
echo "=== Polling/Interval Logic ==="
grep -rn "setInterval\|useEffect.*async" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null

echo "=== WebSocket Usage ==="
grep -rn "WebSocket\|socket\.io\|ws:" "$GEN_PATH/$SESSION_ID" 2>/dev/null

echo "=== Fetch Calls ==="
grep -rn "fetch(" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null | head -20
```

**What to check**:
- ❌ **No polling for state changes**: Player lobby only fetches once, doesn't detect when host starts round
- ❌ **Static pages**: Multi-user page that should update in real-time but has no useEffect polling
- ❌ **Wrong polling target**: Polls `/players` endpoint but should poll `/game` for full state
- ❌ **Missing auto-navigation**: Detects state change but doesn't navigate user to new page

**Example Issue**:
```tsx
// BAD: PlayerLobby only polls for players, won't detect rounds
useEffect(() => {
  const fetchPlayers = async () => {
    const res = await fetch(`/api/games/${code}/players`);
    // Missing: check for game.rounds to detect active round
  };
  setInterval(fetchPlayers, 2000);
}, [code]);

// GOOD: Poll full game state and auto-navigate
useEffect(() => {
  const checkGame = async () => {
    const res = await fetch(`/api/games/${code}`);
    const game = await res.json();
    if (game.rounds.find(r => r.isActive)) {
      navigate(`/play/${code}/rounds/${r.id}?playerId=${playerId}`);
    }
  };
  setInterval(checkGame, 2000);
}, [code, playerId]);
```

---

### Step 13: User Flow Verification (End-to-End Journey)

**Purpose**: Trace the actual user journey to find gaps where users get stuck.

```bash
# Read key pages that coordinate multi-user flows
echo "=== Host Flow Pages ==="
cat "$GEN_PATH/$SESSION_ID/client/src/pages/Home.tsx" 2>/dev/null | grep -A5 "createGame\|navigate"
cat "$GEN_PATH/$SESSION_ID/client/src/pages/HostLobby.tsx" 2>/dev/null | grep -A5 "useEffect\|navigate"

echo "=== Player Flow Pages ==="
cat "$GEN_PATH/$SESSION_ID/client/src/pages/PlayerLobby.tsx" 2>/dev/null | grep -A5 "useEffect\|navigate"
cat "$GEN_PATH/$SESSION_ID/client/src/pages/PlayerRound.tsx" 2>/dev/null | grep -A5 "fetch\|submit"
```

**What to check (trace each user role's journey)**:

**Host Journey**:
1. ✅ Home → Create game → Navigate to HostLobby (check if code is passed)
2. ✅ HostLobby → Start round → Navigate to HostRound (check if roundId is passed)
3. ✅ HostRound → End round → Navigate to Results (check if all params present)
4. ❓ Results → Back to lobby or start new round (is there a navigation path?)

**Player Journey**:
1. ✅ Home → Join game → Navigate to PlayerLobby (check if playerId is stored/passed)
2. ❌ **CRITICAL GAP**: PlayerLobby → detect active round → auto-navigate to PlayerRound?
3. ❓ PlayerRound → Submit answer → what happens next? (wait for results? poll for results?)
4. ❓ Results → Back to lobby? (navigation path exists?)

---

### Step 14: Integration Gap Detection (Component-Level)

**Purpose**: Find features that work in isolation but can't be triggered in the full system.

```bash
# Check if backend endpoints have corresponding frontend calls
echo "=== Backend Endpoints ==="
grep -rn "router\.\(get\|post\|put\|delete\)" "$GEN_PATH/$SESSION_ID/server/src" 2>/dev/null | head -20

echo "=== Frontend API Calls ==="
grep -rn "fetch.*\/api\/" "$GEN_PATH/$SESSION_ID/client/src" 2>/dev/null
```

**What to check**:
- ❌ **Unused API endpoints**: Backend has `POST /games/:code/rounds` but no frontend ever calls it
- ❌ **Missing UI triggers**: API exists but no button/form to invoke it
- ❌ **Incomplete forms**: Form exists but doesn't capture all required API params
- ❌ **Display gaps**: Data is fetched but never rendered (e.g., fetches round.prompt but doesn't display it)

**Example Issue**:
```tsx
// Backend has endpoint to create rounds:
router.post('/:code/rounds', async (req, res) => {
  const { prompt, type } = req.body;
  // ...creates round
});

// But HostLobby has no form to create rounds!
// Endpoint is unreachable → feature doesn't work
```

---

### Step 15: Data Flow Verification

**Purpose**: Ensure critical data (prompt, scores, etc.) actually gets displayed to users.

```bash
# Check if fetched data is actually rendered
echo "=== Data Fetching ==="
grep -rn "const.*=.*await.*json()" "$GEN_PATH/$SESSION_ID/client/src/pages" 2>/dev/null

echo "=== Data Rendering ==="
grep -rn "\.map(\|\.filter(\|{.*\..*}" "$GEN_PATH/$SESSION_ID/client/src/pages" 2>/dev/null | head -30
```

**What to check**:
- ❌ **Fetched but not displayed**: Round has `prompt` field but page doesn't show it
- ❌ **Display placeholder**: Hard-coded text like "Question: [PROMPT]" instead of actual prompt
- ❌ **Missing state updates**: Fetches data but doesn't update useState/useEffect
- ❌ **Conditional rendering bugs**: Data hidden by incorrect `if (!data) return null` check

---

## Common Failure Patterns

### Pattern 1: Dependency Installation Timeout
**Symptoms**:
- `error_message` contains "npm install" or "timeout"
- `duration_ms` is high (>120000)
- Tool result has "Command timed out"

**What to look for**:
- Check if package.json has valid dependencies
- Look for network-related errors in tool results
- Check if too many dependencies were specified

**Fix**: Increase timeout or pre-cache dependencies in Docker image

---

### Pattern 2: Prisma Schema Errors
**Symptoms**:
- Tool result contains "prisma validate" or "prisma generate" errors
- Status is 'failed' with Prisma-related error_message

**What to look for**:
- Read prisma/schema.prisma from files table
- Check for syntax errors (missing @id, invalid types)
- Look for invalid relation definitions

**Fix**: Improve Prisma examples in system prompt

---

### Pattern 3: TypeScript Compilation Errors
**Symptoms**:
- Tool result contains "npx tsc --noEmit" errors
- Multiple type errors listed

**What to look for**:
- Read the actual source files
- Check for missing imports
- Look for type mismatches (e.g., using Prisma client before generation)

**Fix**: Ensure compiler-check strategy is used, or improve type definitions in prompts

---

### Pattern 4: Incomplete File Structure
**Symptoms**:
- status = 'completed' but app doesn't work
- Missing key files (vite.config.ts, server/src/index.ts)

**What to look for**:
- Compare file list from Step 9 against expected structure
- Check if generation was cut short (step_count too low)

**Fix**: Increase token budget or tool call limits

---

### Pattern 5: Malformed JSON in package.json
**Symptoms**:
- npm install fails with JSON parse error
- Tool result shows "Invalid JSON"

**What to look for**:
- Read package.json content from database
- Check for trailing commas, missing quotes, invalid characters

**Fix**: Add validation layer before writing JSON files

---

### Pattern 6: Locally Correct, Globally Broken (Most Insidious!)
**Symptoms**:
- status = 'completed' (no errors!)
- All files present and syntactically correct
- Backend endpoints work when tested directly
- UI components render without errors
- **BUT** the app doesn't function as a whole

**What to look for**:
- **Missing coordination logic**: Multi-user apps where users can't sync state
  - Example: Host starts round but players never know about it
- **Orphaned pages**: Routes exist but are unreachable through normal navigation
  - Example: PlayerRound page exists but no link/navigation from PlayerLobby
- **Incomplete user flows**: Journey starts but gets stuck halfway
  - Example: Player joins lobby → ??? → can't reach the game
- **Missing data display**: Data fetched but not rendered
  - Example: Round prompt exists in DB but PlayerRound doesn't display it
- **Broken param chains**: Query params required but not passed through navigation
  - Example: playerId needed for voting but lost after page transitions

**How to detect**:
1. Run Step 11-15 (Navigation, Coordination, User Flow analysis)
2. Trace each user role's journey from start to finish
3. Look for pages that should update in real-time but have no polling
4. Check if all `<Route>` paths have incoming `navigate()` or `<Link>` calls
5. Verify critical data (prompts, scores) is actually rendered

**Why it happens**:
- LLM generates components in isolation without thinking about coordination
- Planning tool captures static structure (models, routes, pages) but misses dynamic flows
- System prompt lacks guidance on multi-user patterns and state synchronization
- No validation step to check end-to-end user journeys

**Fix (multiple approaches needed)**:
1. **Enhanced planning**: Add `userFlows` and `coordinationRequirements` to planArchitecture tool
2. **Prompt guidance**: Add multi-user coordination patterns to BASE_SYSTEM_PROMPT
3. **Post-gen validation**: Run automated navigation and coordination checks
4. **Building blocks**: Create reusable multi-user-sync patterns

**Example from real session** (5083b604-8829-4fae-93b3-af8fad133c82):
```
Problem: Jackbox-style party game generated successfully but players can't play

Root Cause: PlayerLobby only polls for player list, not game state
- Host creates round → stored in DB ✅
- PlayerLobby never detects new round ❌
- Players stuck in lobby forever, can't reach PlayerRound page ❌

Fix needed: Add polling + auto-navigation in PlayerLobby:
  useEffect(() => {
    const checkForRound = setInterval(async () => {
      const game = await fetch(`/api/games/${code}`).then(r => r.json());
      const activeRound = game.rounds.find(r => r.isActive);
      if (activeRound) navigate(`/play/${code}/rounds/${activeRound.id}?playerId=${playerId}`);
    }, 2000);
    return () => clearInterval(checkForRound);
  }, [code, playerId]);
```

---

## Analysis Report Template

After running through the steps above, summarize findings:

```markdown
## Session Analysis: [SESSION_ID]

### Overview
- **Prompt**: [Brief description]
- **Strategy**: [naive/plan-first/template/compiler-check]
- **Status**: [completed/failed]
- **Duration**: [X seconds]
- **Steps**: [N tool calls]

### Prompt Analysis (Step 3 - CRITICAL!)

**System Prompt Issues**:
- [ ] Dependency versions specified? → [List any version-guessing issues]
- [ ] Tool availability matches mode? → [installNpmDep in naive? Other mismatches?]
- [ ] Dev script instructions correct? → [tsx vs ts-node-dev issue?]
- [ ] Contradictory instructions? → [List any conflicts between base and addons]

**Configuration Mismatches**:
- [ ] Prompt versions match template? → [List any version discrepancies]
- [ ] Mode-specific guidance correct? → [Naive vs template confusion?]

**Missing Guidance**:
- [ ] Multi-user coordination patterns? → [Needed but not mentioned?]
- [ ] Architecture guidance? → [File structure, naming conventions clear?]

**If prompt issues found**: These are usually the ROOT CAUSE. Fix the prompt before analyzing code.

### Technical Status
✅ **What Works**:
- List only if relevant (e.g., "All files generated", "TypeScript compiles", "Prisma schema valid")

❌ **What's Broken** (focus here!):
- [Specific technical errors]
- [Compilation failures]
- [Missing dependencies]

### Critical Gaps (Steps 11-15)

**Navigation Issues**:
- [ ] All routes reachable? → [List orphaned routes if any]
- [ ] Query params flow correctly? → [List broken param chains if any]
- [ ] Dead ends exist? → [List pages with no exit path if any]

**Coordination Issues** (for multi-user apps):
- [ ] Polling for state changes? → [Which pages should poll but don't]
- [ ] Auto-navigation on state change? → [Which transitions are missing]
- [ ] WebSocket or interval logic present? → [Yes/No, details]

**User Flow Completeness**:
- [ ] Host journey: [Trace from start to end, mark ❌ where it breaks]
- [ ] Player journey: [Trace from start to end, mark ❌ where it breaks]
- [ ] Admin journey (if applicable): [...]

**Integration Gaps**:
- [ ] Unused API endpoints: [List endpoints with no frontend calls]
- [ ] Missing UI triggers: [List features that can't be invoked]
- [ ] Data not displayed: [List fetched but not rendered data]

**Verdict**:
- [ ] Technically correct, functionally complete → Ship it! ✅
- [ ] Technically correct, coordination gaps → "Locally correct, globally broken" (Pattern 6) ⚠️
- [ ] Technical errors → Fix compilation/runtime issues first ❌

### Root Cause
[What actually went wrong - be specific. Focus on MISSING logic, not just errors]

### Evidence
- **Navigation gap**: [Specific route/page that's unreachable]
- **Coordination gap**: [Specific useEffect or polling that's missing]
- **User flow break**: [Point in journey where user gets stuck]
- **Timeline observation**: [Relevant pattern from timeline if technical error]
- **Error message**: [Exact error from tool_result or error_message if technical error]

### Why It Happened
[Explain the underlying reason]
- Is this a prompt gap? (missing guidance on multi-user patterns)
- Is this a planning gap? (planArchitecture doesn't capture flows)
- Is this an LLM reasoning gap? (component-by-component thinking)
- Is this a validation gap? (no automated check for this issue)

### Recommendations
1. **Prompt improvement**: [How to improve system prompt - be specific]
2. **Planning tool enhancement**: [What to add to planArchitecture]
3. **Validation**: [New automated check to add]
4. **Building block**: [Reusable pattern to create]

### Related Issues
- Issue #XX - Similar failure pattern
- Issue #YY - Related to [component]

### Success Criteria for Re-Test
After implementing fixes, re-run the same prompt and verify:
- [ ] [Specific gap fixed - e.g., "PlayerLobby polls for game state"]
- [ ] [Specific navigation works - e.g., "Players auto-navigate to rounds"]
- [ ] [Specific data displayed - e.g., "Round prompt shown on PlayerRound"]
- [ ] [End-to-end journey works - e.g., "Host → Player full game loop"]
```

---

## Quick Analysis Script

Save this as `analyze-session.sh` for even faster analysis:

```bash
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
  echo "   sqlite3 \\"$DB_PATH\\" \\"SELECT system_prompt FROM sessions WHERE id = '$SESSION_ID';\\" | less"
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
```

Make it executable:
```bash
chmod +x analyze-session.sh
./analyze-session.sh 5083b604-8829-4fae-93b3-af8fad133c82
```

---

## Tips for Effective Analysis

1. **Start broad, then narrow**: Begin with session overview, then drill into specific errors
2. **Check timing**: Use timestamps to see how long each phase took
3. **Compare with successful sessions**: Look at a working session to see what differs
4. **Cross-reference**: Database content vs actual files on disk may differ
5. **Look for patterns**: If multiple sessions fail the same way, it's a systemic issue
6. **Test the fix**: After identifying root cause, test with a similar prompt
7. **Document findings**: Create a GitHub issue with your analysis

### 🎯 Focus on What's MISSING, Not What's Present

**DO** look for:
- ❌ Orphaned routes with no navigation path
- ❌ Missing polling logic in multi-user pages
- ❌ Broken query param chains
- ❌ Fetched data that's never displayed
- ❌ API endpoints with no frontend calls
- ❌ Pages with no exit/back navigation
- ❌ State changes with no coordination

**DON'T** waste time praising:
- ✅ "Clean code structure" (irrelevant if it doesn't work)
- ✅ "Good use of TypeScript" (doesn't matter if flows are broken)
- ✅ "Proper REST API design" (useless if frontend can't call it)
- ✅ "Modern React patterns" (not helpful if coordination is missing)

**Remember**:
> An app with perfect syntax but missing coordination logic is **MORE BROKEN** than an app with type errors but complete user flows.
> Type errors can be fixed in 5 minutes. Missing coordination logic requires redesigning the architecture.

**Analysis Goal**:
Identify **gaps that require architectural thinking**, not just syntax fixes. These are the insights that help improve prompts and strategies.

---

## Common SQLite Mistakes to Avoid

❌ **Wrong**: `SELECT strategy FROM sessions` (column doesn't exist)
✅ **Right**: `SELECT capability_config FROM sessions`

❌ **Wrong**: `SELECT args FROM timeline_items WHERE type='tool_call'`
✅ **Right**: `SELECT tool_args FROM timeline_items WHERE type='tool_call'`

❌ **Wrong**: `SELECT error FROM timeline_items`
✅ **Right**: `SELECT result FROM timeline_items WHERE is_error = 1`

❌ **Wrong**: Using `created` or `updated` (wrong column names)
✅ **Right**: Use `created_at`, `updated_at`, `completed_at`

❌ **Wrong**: Forgetting to filter by session_id
✅ **Right**: Always include `WHERE session_id = '$SESSION_ID'`
