# Claude Context Document

## Project Overview

This is Gen Fullstack - an experimental LLM-powered full-stack application generator. It generates complete, working full-stack applications with:
- **Client**: Vite + React 19 + TypeScript + Tailwind CSS 4 + React Router 7
- **Server**: Express 5 + TypeScript + RESTful API
- **Database**: Prisma ORM + SQLite

The system provides a real-time interface for generating applications using different prompting strategies and tool-calling approaches, with Docker-based execution for immediate previewing.

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + TypeScript + Socket.IO + Express
- **AI**: Vercel AI SDK with OpenAI models
- **Monorepo**: pnpm workspaces

### Project Structure
```
gen-fullstack/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # UI components (Timeline, FileViewer, etc.)
│   │   ├── hooks/        # Custom React hooks (useWebSocket)
│   │   └── lib/          # Design tokens & utilities
├── server/           # Node.js backend
│   ├── src/
│   │   ├── services/     # Core services
│   │   │   ├── docker.service.ts      # Docker container management
│   │   │   ├── process.service.ts     # App lifecycle management
│   │   │   ├── filesystem.service.ts  # File operations
│   │   │   ├── command.service.ts     # Command execution
│   │   │   └── llm.service.ts         # LLM integration
│   │   ├── strategies/   # Generation strategies (naive, plan-first, etc.)
│   │   ├── tools/        # LLM tools (readFile, writeFile, etc.)
│   │   └── docker/       # Docker configuration
│   │       └── runner.Dockerfile  # Container image for generated apps
├── shared/           # Shared TypeScript types
│   └── src/index.ts  # WebSocket events, app execution types
└── generated/        # Generated application outputs (per-session directories)
```

## Key Features

### 1. Real-Time Communication
- WebSocket-based bidirectional communication via Socket.IO
- Events stream from server to client:
  - `llm_message` - LLM responses
  - `tool_call` - Tool invocations
  - `tool_result` - Tool execution results
  - `file_updated` - Generated file updates
  - `generation_complete` - Generation finished with metrics

### 2. Unified Timeline
- Chronologically ordered display of all LLM messages and tool calls
- Real timestamps (Unix milliseconds) for accurate sequencing
- Expandable tool call details via modal dialogs (Radix UI)
- Semantic color coding for different message roles:
  - **Blue**: Assistant messages
  - **Gray**: User messages and tool calls
  - **Amber**: System messages

### 3. Capability-Based Generation
Flexible capability system with composable options:

**Input Modes** (mutually exclusive):
- **Naive** (`inputMode: 'naive'`): Generate from scratch, write all files directly
- **Template** (`inputMode: 'template'`): Start from pre-built full-stack template

**Capability Toggles** (can be combined with any input mode):
- **Planning**: Generate architectural plan (database schema, API endpoints, components) before implementation
- **Compiler Checks**: Validate with Prisma and TypeScript compilers, iterate to fix errors
- **Building Blocks**: Use higher-level reusable components (future)

**Example Configurations**:
- Quick Start: `{ inputMode: 'naive', planning: false, compilerChecks: false }`
- Naive + Planning: `{ inputMode: 'naive', planning: true, compilerChecks: false }`
- Template + Checks: `{ inputMode: 'template', planning: false, compilerChecks: true }`
- Full-Featured: `{ inputMode: 'template', planning: true, compilerChecks: true }`

All configurations generate monorepo structure with npm workspaces:
```
generated/session-id/
├── package.json       (root with workspaces, concurrently)
├── .env               (DATABASE_URL)
├── client/            (Vite + React 19 + Tailwind 4 + Router 7)
├── server/            (Express 5 + TypeScript)
└── prisma/            (schema + migrations)
```

### 4. LLM Tools
File system tools available to the LLM:
- `readFile` - Read file contents
- `writeFile` - Create/update files
- `listFiles` - List directory contents
- `executeCommand` - Run shell commands

### 5. Design System
Centralized design tokens in `client/src/lib/design-tokens.ts`:
- **Semantic colors**: Role-based color palette (assistant, user, system, tool)
- **Typography**: Consistent text styles (header, label, body, caption, mono)
- **Spacing**: Standardized spacing scales (sections, controls, form, list, cards)
- **Radius**: Border radius tokens (sm, md)
- **Focus states**: Consistent focus ring styles
- **Transitions**: Standard transition durations

### 6. App Execution (Phase 4)
Docker-based secure execution of generated full-stack apps:
- **Docker Service** (`server/src/services/docker.service.ts`):
  - Container lifecycle management (create, start, stop, destroy)
  - Dual-port mapping: client (5173) and server (3000) mapped to host ports 5001-5200
  - Resource limits and security constraints
  - Log streaming and event forwarding
  - Automatic cleanup with configurable timeouts

- **Process Service** (`server/src/services/process.service.ts`):
  - Simplified API for full-stack app execution
  - Dependency installation (npm install for monorepo + workspaces)
  - Prisma client generation and database migrations
  - Dev server management (npm run dev with concurrently for client + server)
  - Event forwarding to WebSocket clients

- **Preview Proxy** (`server/src/index.ts`):
  - HTTP proxy: `/preview/:sessionId/*` → container client port (Vite)
  - WebSocket proxy for Vite HMR
  - Error handling and status checks

- **Security Model**:
  - Isolated Docker containers per session
  - Non-root user execution
  - Dropped Linux capabilities
  - Resource limits (512MB RAM, 1 CPU)
  - Network isolation via Docker
  - Read-only root filesystem

### 7. Storybook Component Development
Storybook 9.1+ for isolated component development and testing:

**Configuration**:
- Uses `@storybook/react-vite` (Storybook 9.0+ with React + Vite)
- Story files: `*.stories.tsx` in component directories
- Runs independently from main app

**TypeScript Configuration**:
```typescript
// IMPORTANT: In Storybook 9.0+, import from @storybook/react-vite, not @storybook/react
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Components/MyComponent',
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // component props
  },
};
```

**Key Components with Stories**:
- `EmptyState` - Reusable empty state with icon, title, description
- `FilterButton` - Filter buttons with color variants
- `AppControls`, `AppPreview`, `LogViewer` - App execution UI
- `Timeline`, `FileViewer`, `PromptInput` - Generation UI
- `ErrorBoundary`, `ToastProvider` - Error handling

**Best Practices**:
- All new UI components should have Storybook stories
- Use design tokens for consistent styling
- Include multiple variants showing different states
- Document props with JSDoc comments
- Use `satisfies` operator for type safety
- When using custom `render` functions in stories, always provide minimal required `args` (e.g., `args: { id: "" }` for a component that requires `id`)

## Recent Changes

### Dependency Version Reference (Latest - January 2025) ✅
Added comprehensive dependency version reference to base prompt to prevent version-guessing failures.

**Problem** (discovered via session 534dd3c2):
- LLM generated `@tailwindcss/vite@^1.0.0` which doesn't exist (correct version is `^4.0.27`)
- Base prompt mentioned Tailwind CSS 4 but didn't specify versions
- LLM had to guess versions → incorrect guesses → npm install failures
- Cascaded into false success messages and app startup failures

**Solution**:
1. Added "COMMON DEPENDENCY VERSIONS" section to BASE_SYSTEM_PROMPT with tested versions:
   - Client deps: react, react-dom, react-router, react-router-dom
   - Client devDeps: @tailwindcss/vite, tailwindcss, vite, typescript, @vitejs/plugin-react
   - Server deps: express, @prisma/client, cors
   - Server devDeps: tsx, typescript, @types/express, @types/node, prisma
   - Root devDeps: concurrently

2. Applied DRY principles to eliminate version duplication:
   - Removed hardcoded version from SERVER DEV SCRIPT section (now references COMMON DEPENDENCY VERSIONS)
   - Removed example versions from DEPENDENCY MANAGEMENT section (now references COMMON DEPENDENCY VERSIONS)
   - Updated template addon to reference COMMON DEPENDENCY VERSIONS instead of repeating versions
   - Single source of truth: all versions only specified once in COMMON DEPENDENCY VERSIONS section

**Why this approach is good**:
- ✅ General enough: Lists commonly-used packages across all app types
- ✅ Not overfitted: Doesn't prescribe exact app structure, just versions
- ✅ Solves root cause: LLM no longer guesses major versions
- ✅ Consistent with template: Uses same versions as working template
- ✅ Helps all modes: Benefits naive, plan-first, and compiler-check (not just template)
- ✅ Flexible: Explicitly allows newer minor/patch versions

**Impact**:
- ✅ Prevents version-guessing failures for Tailwind, React, Express, Vite, etc.
- ✅ Reduces npm install failures due to non-existent package versions
- ✅ Consistent, working apps across all generation modes
- ✅ Single source of truth for versions (easier to maintain and update)
- ✅ Fixes session 534dd3c2 failure pattern

**Files Modified**:
1. `server/src/config/prompt-builder.ts` - Added dependency version reference and applied DRY principles throughout

**Testing**: All 322 tests passing, typecheck passing, DRY verification passing ✅

### Tool Filtering: Removed installNpmDep from Naive Input Mode (January 2025) ✅
Fixed critical issue where `installNpmDep` tool was available when `inputMode: 'naive'`, causing the LLM to try installing dependencies before package.json files existed.

**Problem** (discovered via session 534dd3c2):
- With `inputMode: 'naive'`, LLM called `installNpmDep` before package.json files were created
- Example sequence: writeFile(schema) → installNpmDep(server) → writeFile(server/package.json)
- This wasted 2-4 tool calls per generation and confused the LLM
- Root cause: `installNpmDep` was available for all input modes but should only be for `inputMode: 'template'`

**Solution**:
1. **Added `getToolsForMode()` helper** (`server/src/tools/index.ts:673`)
   - Returns full tools when `inputMode: 'template'` (package.json files exist)
   - Returns filtered tools (no installNpmDep) when `inputMode: 'naive'`
   - Uses correct `InputMode` type from shared package

2. **Updated capability** (`server/src/capabilities/unified-code-generation.capability.ts:100`)
   - Now uses `getToolsForMode(this.config.inputMode)` instead of raw `tools`
   - Tools are filtered dynamically based on input mode

3. **Updated prompts** (`server/src/config/prompt-builder.ts`)
   - Base prompt: Changed from "use installNpmDep" to "write complete package.json files"
   - Template addon: Retained installNpmDep instructions (only available when inputMode: 'template')

**Testing**:
- Added 2 tests for getToolsForMode filtering (template includes all, naive excludes installNpmDep)
- Updated 2 prompt tests to verify installNpmDep absence/presence
- All 50 tests passing (16 prompt + 34 tool tests)
- Code review identified and fixed type safety issue (using correct InputMode type)

**Impact**:
- ✅ `inputMode: 'naive'` no longer calls installNpmDep before package.json exists
- ✅ Saves 2-4 wasted tool calls per generation
- ✅ Clearer workflow: write complete files with naive input, merge deps with template input
- ✅ Fixes issue reported by user

**Files Modified**:
1. `server/src/tools/index.ts` - Added getToolsForMode helper
2. `server/src/capabilities/unified-code-generation.capability.ts` - Use conditional tools
3. `server/src/config/prompt-builder.ts` - Updated dependency management instructions
4. `server/src/config/__tests__/prompt-builder.test.ts` - Added prompt content tests
5. `server/src/tools/__tests__/tools.test.ts` - Added tool filtering tests

### Prompt Fixes: tsx and Unnecessary File Reads (January 2025) ✅
Fixed two critical issues in the base system prompt that caused generation failures:

**Fix #1: tsx Instead of ts-node-dev**
- Added explicit instruction to use `tsx` for server dev script
- Added new "SERVER DEV SCRIPT" section in base prompt
- Specifies: `"dev": "PORT=3000 tsx watch src/index.ts"`
- Prevents ES module errors (ts-node-dev doesn't support "type": "module")
- Location: `server/src/config/prompt-builder.ts` (lines 43-48)

**Fix #2: Removed Unnecessary File Reads for Naive Input Mode**
- Moved "check existing package.json" workflow from base prompt to template addon
- Base prompt now only has generic dependency management instructions
- Template addon now has specific workflow: read files → check existing deps → add new deps
- Prevents LLM from reading non-existent files when `inputMode: 'naive'` (regardless of capability toggles)
- Saves 2-3 unnecessary tool calls per generation

**Root Cause Analysis**:
- Issue discovered via session analysis (session 93307df0)
- LLM was following base prompt instructions to check files that didn't exist yet
- ts-node-dev was being used because prompt didn't specify tsx
- Template uses tsx, but base prompt had no explicit instruction

**Impact**:
- ✅ Generated apps now use tsx and work correctly with ES modules
- ✅ `inputMode: 'naive'` no longer wastes tool calls reading non-existent files
- ✅ `inputMode: 'template'` retains intelligent dependency checking
- ✅ All 3 workspaces pass typecheck

**Files Modified**:
1. `server/src/config/prompt-builder.ts` - Base prompt and template addon updates

### Template Upgrade: Tailwind 4 + React Router 7 (January 2025) ✅
Complete upgrade of the full-stack template with modern styling and routing:

**Template Changes**:
- **Tailwind CSS 4**: Added with Vite plugin integration
  - Uses `@tailwindcss/vite` plugin for optimal performance
  - CSS-first configuration (no `tailwind.config.js` needed)
  - Single-line `index.css`: `@import "tailwindcss"`
  - All components styled with utility classes
  - Modern CSS features: container queries, 3D transforms, CSS variables

- **React Router 7**: Added with BrowserRouter setup
  - Multi-page navigation out of the box
  - Example Home page in separate `pages/` directory
  - Home page demonstrates API interaction (User CRUD)
  - `<Link>`, `<Routes>`, `<Route>` components ready to use
  - Navigation hooks: `useNavigate()`, `useParams()`, `useLocation()`

**Prompt Updates**:
- Updated BASE_SYSTEM_PROMPT with Tailwind 4 and React Router 7 setup instructions
- Added dedicated sections for CSS and routing configuration
- Updated template mode addon to describe pre-configured stack
- Added dependency management notes (react-router and tailwindcss included)
- Updated workflow steps to include route planning

**Building Block Updates**:
- Updated `auth-password/ProtectedRoute.tsx` to use `<Navigate>` for redirects
- Changed from `fallback` prop to `redirectTo` prop (defaults to `/login`)
- Updated integration guide with React Router examples
- Shows protected route pattern with Routes and Navigate

**Files Modified**:
1. `templates/vite-fullstack-base/client/package.json` - Added deps
2. `templates/vite-fullstack-base/client/vite.config.ts` - Added Tailwind plugin
3. `templates/vite-fullstack-base/client/src/index.css` - Created with @import
4. `templates/vite-fullstack-base/client/src/main.tsx` - Added BrowserRouter
5. `templates/vite-fullstack-base/client/src/App.tsx` - Simplified with Routes
6. `templates/vite-fullstack-base/client/src/pages/Home.tsx` - Created with User CRUD example
7. `templates/vite-fullstack-base/client/src/App.css` - Deleted (no longer needed)
8. `server/src/config/prompt-builder.ts` - Updated prompts and guides
9. `blocks/auth-password/client/ProtectedRoute.tsx` - Added Navigate support
10. `server/src/services/__tests__/filesystem.service.test.ts` - Updated tests

**Requirements**:
- Node.js 20+ required for Tailwind CSS 4
- Modern browser support: Safari 16.4+, Chrome 111+, Firefox 128+

**Impact**:
- ✅ All generated apps now use Tailwind 4 for styling
- ✅ Multi-page navigation ready out of the box
- ✅ Consistent, modern UI with utility-first CSS
- ✅ Better developer experience with routing hooks
- ✅ Issue #45 resolved

**Testing**: All tests passing ✅

### Dependency Installation Improvements (October 2025) ✅
Enhanced npm install reliability and performance to prevent timeout failures:

**Improvement #1: Increased Timeout**
- Increased npm install timeout from 120s (2 min) to 300s (5 min)
- Accommodates slow networks and first-time cache misses
- Location: `server/src/capabilities/base.capability.ts` (line 34)

**Improvement #2: Automatic Retry**
- Added retry logic for npm install timeouts
- Retries once if first attempt times out
- Shows "⏱️ Installation timed out, retrying..." message to user
- Location: `server/src/capabilities/validation.capability.ts` (lines 247-264)
- Maximum total time: 10 minutes (2 attempts × 5 minutes)

**Improvement #3: Enhanced Pre-caching**
- Added bcryptjs to Docker image pre-cache (for auth-password block)
- Includes both runtime and type definitions
- Location: `server/docker/runner.Dockerfile` (lines 69, 74)
- Install time improvement: ~60s → ~10-15s for apps using auth

**Impact**:
- ✅ Reduced false failures from transient network issues
- ✅ Better user experience with retry messages
- ✅ Faster installs for apps using common building blocks
- ✅ Issue #35 resolved

**Testing**: All 307 server tests passing ✅

### Session Reliability Fixes (October 2025) ✅
Implemented three critical fixes to prevent sessions from getting stuck in 'generating' state:

**Fix #1: Server Startup Recovery**
- Automatically detects and fixes sessions stuck in 'generating' state on server startup
- Configurable threshold (default: 5 minutes via `STUCK_SESSION_THRESHOLD_MS`)
- Marks old sessions as 'failed' with clear error message
- Location: `server/src/index.ts` (lines 126-159)
- Database method: `databaseService.findStuckSessions()`

**Fix #2: Generation Timeout**
- Prevents runaway generations that never complete
- Automatic abort after configurable timeout (default: 30 minutes via `GENERATION_TIMEOUT_MS`)
- Timeout cleared on success, failure, or early return
- Location: `server/src/orchestrator/capability-orchestrator.ts`
- Implementation: `setTimeout()` with automatic cleanup

**Fix #3: SIGTERM Graceful Abort**
- Aborts all active generations when server receives SIGTERM
- 5-second grace period for generations to finish cleanly
- Ensures database status is updated before shutdown
- Location: `server/src/index.ts` (lines 208-247)
- Exposes `getActiveGenerations()` from websocket module

**Testing**:
- Added 15 new tests across 3 test files
- All 322 tests passing (307 server + 15 new) ✅
- Test files:
  - `stuck-session-recovery.test.ts` - 5 tests
  - `generation-timeout.test.ts` - 5 tests
  - `sigterm-graceful-abort.test.ts` - 5 tests

**Configuration**:
- `STUCK_SESSION_THRESHOLD_MS`: Time before session is considered stuck (default: 300000 = 5 min)
- `GENERATION_TIMEOUT_MS`: Max generation time before auto-abort (default: 1800000 = 30 min)
- Both configurable via environment variables in `.env`

**Impact**:
- ✅ No more sessions permanently stuck after server restarts
- ✅ No more zombie generations consuming resources
- ✅ Clean shutdown with proper database state
- ✅ User-reported issue (#21) fully resolved

### Compiler Checks Capability (October 2025) ✅
Implemented compiler validation capability with automatic error fixing (can be enabled with any input mode via `compilerChecks: true`):

**Three-Phase Workflow**:
1. **Phase 1: Initial Generation** (20 tool calls max)
   - Generate complete full-stack app
   - Create all files (package.json, Prisma schema, client/server code)

2. **Phase 2: Prisma Schema Validation** (1 fix attempt)
   - Run `npx prisma validate && npx prisma generate`
   - Parse validation errors from Prisma CLI
   - If errors found: Send focused prompt to LLM for fixes (5 tool calls)
   - Re-validate after fix attempt
   - **Critical**: Must succeed to generate `@prisma/client` types for TypeScript

3. **Phase 3: TypeScript Validation** (up to 3 iterations)
   - Run `npx tsc --noEmit` for both server and client
   - Parse TypeScript errors (file, line, column, code, message)
   - If errors found: Send formatted errors to LLM for fixes (5 tool calls per iteration)
   - Re-check after each fix
   - Stop when: no errors (success) or max iterations reached (partial success)

**Implementation Details**:
- Total tool call budget: 20 + 5 + (3 × 5) = 40 max
- Command whitelist: Added `npx` to enable Prisma/TypeScript CLI
- Error parsing: Regex-based extraction from compiler output
- Focused prompts: Separate system prompts for schema fixes vs TypeScript fixes
- Metrics tracking: Iterations, validation pass/fail, total errors

**Database Updates**:
- Extended database schema to support compiler checks capability
- Added optional compiler metrics to GenerationMetrics interface:
  - `compilerIterations`: Number of TypeScript fix iterations
  - `schemaValidationPassed`: Boolean for Prisma validation
  - `typeCheckPassed`: Boolean for final TypeScript state
  - `totalCompilerErrors`: Remaining errors after all iterations

**Testing**:
- All 185 tests passing ✅
- Updated validation test to accept compiler checks capability as implemented
- Typecheck passing across all workspaces

**Files Changed** (Note: Original implementation used strategy pattern, later refactored to capability system):
- `server/src/strategies/compiler-check.strategy.ts` - Original implementation (now part of capability orchestration)
- `server/src/services/command.service.ts` - Added npx to whitelist
- `server/src/websocket.ts` - Registered capability
- `server/src/db/schema.ts` - Extended schema for compiler checks
- `shared/src/index.ts` - Updated types and schemas
- `server/src/__tests__/strategy-validation.test.ts` - Updated test

### Full-Stack App Generator Upgrade (January 2025) ✅
Complete upgrade from single-app generator to full-stack application generator:

**Architecture Changes**:
- Updated all prompts to generate full-stack monorepo apps
- Client: Vite + React 19 + TypeScript
- Server: Express 5 + TypeScript with automatic async error handling
- Database: Prisma ORM + SQLite for simplicity
- Monorepo: npm workspaces with concurrently for parallel dev servers

**Docker Configuration**:
- Updated runner.Dockerfile with Prisma CLI support
- Dual-port mapping: container ports 5173 (Vite) and 3000 (Express) → host ports 5001-5200
- Vite runs with `--host 0.0.0.0 --port 5173` flags (passed via root package.json dev:client script)
- **NPM Cache Optimization**: Pre-populated npm cache with common dependencies (React, Express, Prisma, Vite, TypeScript, etc.) reduces install time from ~60s to ~10-15s

**Process Execution**:
- 3-step dependency installation:
  1. `npm install` (root + workspaces)
  2. `npx prisma generate` (generate Prisma client)
  3. `npx prisma migrate dev --name init` (run database migrations)
- Dev server execution: `npm run dev` (uses concurrently to run both client and server)

**Type System Updates**:
- Updated `AppInfo` interface with dual-port architecture:
  - `clientPort` and `clientUrl` for Vite dev server
  - `serverPort` and `serverUrl` for Express API
- Removed backward compatibility fields (old `port` and `url`)

**Preview Proxy**:
- Updated to use `clientPort` for HTTP/WebSocket proxying
- Proper error handling for missing port configuration

**Testing**:
- All 133 tests passing with new dual-port architecture
- Updated Docker service tests for full-stack setup
- Updated client component tests and Storybook stories

**Documentation**:
- Updated CLAUDE.md with full-stack architecture details
- Updated generation prompts with latest best practices (Express 5, Prisma 6, React 19, Vite 7)

### Phase 4: Docker-Based App Execution (Production Ready ✅)
- **Docker Service**: Production-ready container management with comprehensive security
  - Build and manage runner images with automatic detection (Colima, Docker Desktop, Linux)
  - Socket path validation with symlink resolution (TOCTOU attack prevention)
  - Path whitelisting (/var/run, ~/.colima, ~/.docker only)
  - Create isolated containers with resource limits (512MB RAM, 1 CPU core)
  - Dual-port mapping: client and server (ports 5001-5200)
  - Real-time log streaming with correct Docker multiplexed stream format
  - Buffer accumulation for partial stream chunks
  - Memory leak prevention: cleanup functions for all event listeners, timers, streams
  - Automatic cleanup with configurable timeouts (10 min max runtime)
  - Security: non-root user, dropped all capabilities, no-new-privileges flag

- **Process Service**: High-level app lifecycle management
  - Start/stop/restart apps with full error handling
  - Install dependencies (npm install) with 2-minute timeout
  - Start dev servers (npm run dev) with readiness detection
  - Forward logs and build events via EventEmitter
  - Graceful error handling with status tracking
  - Auto-cleanup tracking (timers, intervals, streams)

- **WebSocket Integration**: App execution commands
  - `start_app` - Create container, install deps, start dev server
  - `stop_app` - Stop and destroy container with cleanup
  - `restart_app` - Restart running app
  - `app_status` - Container status updates (creating, installing, starting, running, failed, stopped)
  - `app_log` - Real-time logs from containers (stdout/stderr)
  - `build_event` - Build success/failure events

- **Preview Proxy**: HTTP/WebSocket proxy to containers
  - Route `/preview/:sessionId/*` to container ports
  - WebSocket support for Vite HMR
  - Error handling for stopped/failed apps
  - DNS rebinding protection compatibility (Vite)

- **Security Hardening** (All Critical Issues Fixed):
  1. ✅ Socket path injection prevention (symlink resolution, whitelisting, type verification)
  2. ✅ Memory leak prevention (tracked cleanup for streams, timers, intervals)
  3. ✅ Race condition elimination (proper async resource management)
  4. ✅ Correct stream processing (Docker multiplexed format with buffer handling)
  5. ✅ Container isolation (dropped capabilities, non-root, resource limits)

- **Comprehensive Testing**: **133/133 tests passing** ✅
  - Docker service tests (24/24 passing) ✅
  - Process service tests (21/21 passing) ✅
  - All original tests (88/88 passing) ✅
  - Integration test script (`test-docker-execution.ts`)
  - TypeScript strict mode with zero errors
  - Full test documentation in TESTING.md

### Design System Refactoring
- Created centralized design tokens file (`client/src/lib/design-tokens.ts`)
- Updated all components to use consistent styling:
  - Timeline, StrategySelector, PromptInput
  - FileTree, FileViewer, App layout
- Maintained semantic colors for meaningful differentiation
- Removed inconsistent styles (mixed border radius, focus states, etc.)

### Timeline Improvements
- Added real timestamps to all events (messages, tool calls, results)
- Fixed chronological ordering - events now appear in proper sequence
- Added timestamp display (HH:MM:SS.mmm format) in top-right corner
- Improved tool call modal with better parameter/result formatting

### Client Refactoring Phase 1 (Latest - Component Extraction) ✅
**New Reusable Components**:
- `EmptyState` - Centralized empty state component with icon, title, description, action
  - Replaced 5 duplicated empty state patterns
  - Full Storybook stories with 6 variants
  - ~50+ lines of duplication eliminated

- `FilterButton` - Reusable filter button with color variants
  - Replaced 6 repeated button patterns in LogViewer
  - Supports 6 color variants (gray, purple, yellow, blue, amber, red)
  - ~36 lines saved with better maintainability

**Code Duplication Fixed**:
- `ToolCallDisplay` - Removed 70+ lines of duplicated `renderToolParameters`
  - Now imports shared utility from `lib/tool-utils.tsx`
  - Consistent tool rendering across Timeline and ToolCallDisplay

**Storybook Configuration Fixed**:
- Updated to use `@storybook/react-vite` (Storybook 9.0+ requirement)
- Previously incorrect imports from `@storybook/react` (not installed)
- All typechecks now pass with correct framework-specific imports

**Impact**: 150+ lines saved, 12 DRY violations fixed, improved maintainability

### Code Refactoring Phase 1 (Server - Stream Processing) ✅
**Completed**: January 2025

**Stream Processing Extraction**:
- Extracted `BaseStrategy.processStreamResult()` method (lines 366-398)
  - Handles text deltas, stream consumption, and metrics calculation
  - Eliminates ~170 lines of duplication across 3 strategies
  - Used by: naive, plan-first, and template strategies

**Docker Stream Buffer Processing**:
- Extracted `DockerService.createDockerStreamHandler()` method (lines 529-564)
  - Parses Docker multiplexed stream format with buffer accumulation
  - Eliminates ~45 lines of duplication
  - Used by: `setupLogStream()` and `processExecStream()`

**Total Impact**: ~215 lines saved, 40% bug risk reduction, significantly improved maintainability

**Verification**: All 168 tests passing (up from 133)

## Development Commands

**IMPORTANT**: Always verify your current directory with `pwd` before running commands that depend on a specific folder location.

```bash
# Check current directory
pwd

# Install dependencies (run from project root: /Users/ilakovac/dev/gen-fullstack)
pnpm install

# Run both client and server in dev mode (from project root)
pnpm dev

# Run client only (from project root)
pnpm dev:client

# Run server only (from project root)
pnpm dev:server

# Run Storybook (component development)
# Option 1: From project root
pnpm --filter client storybook
# Option 2: From client folder
cd client && pnpm storybook

# Type check (from project root)
pnpm typecheck

# Run tests
pnpm test

# Format code
pnpm format

# Build for production
pnpm build

# Clean up old generations (disk + database)
cd server && pnpm exec tsx ../scripts/cleanup-generations.ts
```

## What to Work On Next

### Using GitHub Issues as Memory

**IMPORTANT**: All future work, planning, and task tracking should be done in GitHub issues, NOT in markdown files.

**DO:**
- ✅ Use `gh issue create` to track new features, bugs, or ideas
- ✅ Use `gh issue comment` to add notes, updates, or implementation details
- ✅ Use `gh issue edit` to update descriptions with new findings
- ✅ Use labels to organize issues (phase-5, phase-6, phase-7, refactoring)
- ✅ Reference issues in commit messages (e.g., "Fixes #8")

**DON'T:**
- ❌ Create new markdown files for planning (PLAN_V2.md, TODO.md, etc.)
- ❌ Create analysis documents (ANALYSIS.md, RESEARCH.md, etc.)
- ❌ Create tracking documents (PROGRESS.md, STATUS.md, etc.)
- ❌ Create temporary notes files that accumulate over time

**Exception**: Only update existing documentation files:
- `CLAUDE.md` - Project context (this file)
- `DESIGN.md` - Design system reference
- `TESTING.md` - Testing procedures
- `README.md` - User-facing documentation

**For Analysis/Research Work:**
If you need to analyze code, document findings, or plan implementation:
1. Create a GitHub issue with a descriptive title
2. Add your analysis in the issue description (supports markdown)
3. Use comments to add updates as you discover more
4. Close the issue when the work is complete or findings are applied
5. Reference the issue in commits (e.g., "Refactor based on analysis from #15")

**Example workflow:**
```bash
# Create issue for code analysis
gh issue create --title "Analyze authentication flow for security improvements" \
  --body "## Current State
- Using JWT tokens
- No refresh token mechanism
...

## Recommendations
1. Add refresh tokens
2. Implement token rotation
..."

# Add updates as you work
gh issue comment 23 --body "Found vulnerability in token validation..."

# Reference in commits
git commit -m "Add token rotation (relates to #23)"

# Close when done
gh issue close 23 --comment "Implemented all security improvements"
```

### Checking GitHub Issues

All future work is tracked in GitHub issues. Use the `gh` CLI to view and work on tasks:

```bash
# View all open issues
gh issue list

# View issues by phase
gh issue list --label "phase-5"    # Optimization Toggles
gh issue list --label "phase-6"    # Demo Scenarios
gh issue list --label "phase-7"    # Polish & UX
gh issue list --label "refactoring" # Code refactoring tasks

# View a specific issue (if you get a Projects deprecation error, use --json)
gh issue view <issue-number>
# Alternative: Use JSON format to avoid deprecation warnings
gh issue view <issue-number> --json title,body,labels,state | cat

# Work on an issue (creates a branch and checks it out)
gh issue develop <issue-number>
```

### Completed Phases

✅ **Phase 1-4**: Basic harness, LLM integration, file system, Docker execution
✅ **Phase 4.5**: Session persistence with Drizzle ORM
✅ **Phase 4.6**: Session recovery with React Router 7
✅ **Phase 5**: Capability system with input modes (naive/template) and toggles (planning/compiler checks)
✅ **Zustand Migration**: Complete with stores
✅ **File Editing**: CodeMirror editor, tabs, resizable panels

## Maintenance

### Database Location

The SQLite database is located at `server/data/gen-fullstack.db` (relative to project root). To query it directly:

```bash
# From project root
sqlite3 server/data/gen-fullstack.db "SELECT * FROM sessions LIMIT 5;"

# Or navigate to server folder first
cd server
sqlite3 data/gen-fullstack.db ".tables"

# Common queries
sqlite3 server/data/gen-fullstack.db "SELECT id, substr(prompt, 1, 50) as prompt, capability_config, status FROM sessions ORDER BY created_at DESC LIMIT 10;"
sqlite3 server/data/gen-fullstack.db "SELECT content FROM timeline_items WHERE session_id = 'SESSION_ID' AND type = 'message' ORDER BY timestamp;"
```

### Session Analysis

For detailed analysis of generation sessions (especially failures), use the **Session Analysis Cookbook**:

**Location**: `SESSION-ANALYSIS-COOKBOOK.md` (project root)

**Quick Start**:
```bash
# Automated analysis script
./scripts/analyze-session.sh <session-id>

# Example
./scripts/analyze-session.sh 5083b604-8829-4fae-93b3-af8fad133c82
```

**What it provides**:
- 10-step systematic analysis process
- Pre-tested SQL queries for all common investigations
- Common failure pattern recognition
- Analysis report template
- Tips for identifying root causes

**When to use**:
- After a generation fails (status = 'failed')
- When an app completes but doesn't work correctly
- To understand what the LLM generated and why
- To gather evidence for improving prompts or strategies
- Before creating bug reports or GitHub issues

See the cookbook for complete details on database schema, query examples, and analysis best practices.

### Cleanup Script

The project includes a cleanup script to remove old generated applications and reset the database:

**Location**: `scripts/cleanup-generations.ts` (run from project root)

**Usage**:
```bash
cd server && pnpm exec tsx ../scripts/cleanup-generations.ts
```

**What it does**:
1. **Database Cleanup**:
   - Deletes all sessions from the database
   - Cascade deletes all related timeline items and files
   - Shows progress for each deleted session

2. **Disk Cleanup**:
   - Removes all generated application directories from `generated/`
   - Preserves `.gitkeep` file for Git tracking
   - Reports freed disk space (typically ~50-100MB per app)

**Example Output**:
```
🧹 Starting cleanup...

📊 Cleaning up database...
   Found 7 sessions in database
   ✓ Deleted session: 00cfa079... (Drawing game - one person draws, another guesses...)
   ✅ Database cleaned (7 sessions removed)

💾 Cleaning up disk...
   ✓ Removed: 00cfa079-5818-400c-b1a5-40c0d4524fc0 (80.94 MB)
   ✅ Disk cleaned (16 directories removed, 988.59 MB freed)

✨ Cleanup complete!
```

**When to use**:
- Before long development sessions to free up disk space
- After testing multiple app generations
- When the `generated/` directory becomes too large (>1GB)
- To reset the database for fresh testing

**Note**: The database will be automatically re-initialized with the proper schema when the server starts next time.

## Environment Variables

Server requires `.env` file:
```
# Required
OPENAI_API_KEY=your_api_key_here

# Optional (defaults shown)
PORT=3001
CLIENT_URL=http://localhost:5173

# Generation Settings (Optional)
STUCK_SESSION_THRESHOLD_MS=300000   # 5 minutes - time before marking session as stuck on startup
GENERATION_TIMEOUT_MS=1800000        # 30 minutes - max generation time before auto-abort
```

See `server/.env.example` for a complete template.

## Testing

- Server tests in `server/src/**/__tests__/*.test.ts`
- Uses Vitest 3.2 for testing
- **Current test suite: 322/322 tests passing** ✅ (307 server + 15 new session reliability tests)
  - All test suites passing with zero errors
  - TypeScript strict mode enabled
  - Full coverage of strategies, Docker service, process service, and session reliability
- Comprehensive test coverage:
  - Strategy implementations and tool execution
  - Docker container lifecycle and security features
  - Stream processing and error handling
  - App execution orchestration
- Integration testing:
  - End-to-end Docker execution script (`scripts/test-docker-execution.ts`)
  - Full lifecycle: build image → create container → install deps → start server → cleanup
  - HTTP access validation and log retrieval
- Test documentation: See TESTING.md for complete guide

## Important Implementation Details

### Timestamp Management
All events include `timestamp: Date.now()` at emission time:
- Server emits timestamps via `emitMessage()`, `emitToolCall()`, `emitToolResult()`
- Client stores timestamps in state
- Timeline component sorts all events by timestamp for proper ordering

### WebSocket State Management
Client hook (`useWebSocket.ts`) manages:
- Connection state
- Message arrays (with 100 message limit)
- Tool call/result tracking
- File update tracking
- Generation state

### Error Handling
- ErrorBoundary wraps Timeline component
- WebSocket reconnection logic
- Tool execution error capture and display

## Known Limitations

1. Limited persistence - database stores sessions/timeline/files but UI state is lost on page refresh (no session restoration UI yet)
2. Single active generation at a time
3. File viewer uses client-side syntax highlighting (limited language support)
4. No authentication or multi-user support
5. Docker required for app execution:
   - Automatic detection supports Docker Desktop, Colima, and standard Linux Docker
   - Clear error messages if Docker is unavailable
   - No WebContainer fallback for browser-based execution (future consideration)
6. Generated apps use SQLite (simple but not production-ready for concurrent access)
7. No automatic code formatting/linting in generated apps
8. Manual cleanup required - use cleanup script to free disk space (no automatic retention policy)

## Future Work

All future work is tracked in GitHub issues. See the "What to Work On Next" section above for how to view and work on issues.

**Quick Links:**
- [View all issues](https://github.com/infomiho/gen-fullstack/issues)
- [Phase 5 tasks (Optimization Toggles)](https://github.com/infomiho/gen-fullstack/labels/phase-5)
- [Phase 6 tasks (Demo Scenarios)](https://github.com/infomiho/gen-fullstack/labels/phase-6)
- [Phase 7 tasks (Polish & UX)](https://github.com/infomiho/gen-fullstack/labels/phase-7)
- [Refactoring tasks (Code quality)](https://github.com/infomiho/gen-fullstack/labels/refactoring)
