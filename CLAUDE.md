# Claude Context Document

## Project Overview

This is Gen Fullstack - an experimental LLM-powered full-stack application generator. It generates complete, working full-stack applications with:
- **Client**: Vite + React 19 + TypeScript + Tailwind CSS 4 + React Router 7
- **Server**: Express 5 + TypeScript + RESTful API
- **Database**: Prisma ORM + SQLite

The system provides a real-time interface for generating applications using different capability configurations and tool-calling approaches, with Docker-based execution for immediate previewing.

## Architecture

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
│   │   ├── capabilities/ # Capability implementations (unified code generation)
│   │   ├── tools/        # LLM tools (readFile, writeFile, etc.)
│   │   └── docker/       # Docker configuration
│   │       └── runner.Dockerfile  # Container image for generated apps
├── shared/           # Shared TypeScript types
│   └── src/index.ts  # WebSocket events, app execution types
└── generated/        # Generated application outputs (per-session directories)
```

### Generation Architecture
The system uses a unified orchestrator pattern for code generation:

**UnifiedOrchestrator** (`server/src/orchestrator/unified-orchestrator.ts`):
- Single orchestrator for all generation modes
- Composes capabilities dynamically based on configuration
- Manages LLM streaming, tool execution, and event emission
- Handles error recovery and timeout management

**Capability System** (`server/src/capabilities/`):
- **BaseCapability**: Core file system operations (read, write, getFileTree, executeCommand)
- **UnifiedCodeGenerationCapability**: Main generation logic with composable features
- **TemplateCapability**: Template-specific operations (npm dependencies)
- Tools are filtered based on capability configuration (naive vs template, planning, compiler checks, building blocks)

**Prompt Builder** (`server/src/config/prompt-builder.ts`):
- Constructs system prompts based on capability configuration
- Includes dependency versions, file structure, and mode-specific instructions
- Adapts instructions for planning, compiler checks, and building blocks

## Key Features

### 1. Real-Time Communication
- WebSocket-based bidirectional communication via Socket.IO
- Events stream from server to client for:
  - LLM responses and tool execution
  - File updates and generation progress
  - App execution status and logs
  - Build events and error notifications
  - Generation lifecycle (start, complete, error)
- Event definitions: `server/src/websocket.ts` and `shared/src/index.ts`

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
- **Building Blocks**: Use higher-level reusable components (requestBlock tool)

**Example Configurations**:
- Quick Start: `{ inputMode: 'naive', planning: false, compilerChecks: false }`
- Naive + Planning: `{ inputMode: 'naive', planning: true, compilerChecks: false }`
- Template + Checks: `{ inputMode: 'template', planning: false, compilerChecks: true }`
- Full-Featured: `{ inputMode: 'template', planning: true, compilerChecks: true }`

All configurations generate the same monorepo structure (see Project Structure above).

### 4. LLM Tools
Tools available to the LLM, organized by capability configuration:

**Base Tools** (always available):
- `readFile` - Read file contents
- `writeFile` - Create/update files
- `getFileTree` - List directory contents and file structure
- `executeCommand` - Run shell commands

**Planning Tools** (available when `planning: true`):
- `planArchitecture` - Generate architectural plan (database schema, API endpoints, components)

**Template Tools** (available when `inputMode: 'template'`):
- `installNpmDep` - Install npm dependencies to package.json

**Compiler Check Tools** (available when `compilerChecks: true`):
- `validatePrismaSchema` - Validate Prisma schema for errors
- `validateTypeScript` - Run TypeScript compiler checks

**Building Block Tools** (available when `buildingBlocks: true`):
- `requestBlock` - Copy pre-built reusable components

Tool definitions: `server/src/tools/index.ts`

### 5. Design System
Centralized design tokens in `client/src/lib/design-tokens.ts`:
- **Semantic colors**: Role-based color palette (assistant, user, system, tool)
- **Typography**: Consistent text styles (header, label, body, caption, mono)
- **Spacing**: Standardized spacing scales (sections, controls, form, list, cards)
- **Radius**: Border radius tokens (sm, md)
- **Focus states**: Consistent focus ring styles
- **Transitions**: Standard transition durations

### 6. State Management
Client-side state managed with Zustand stores:
- **App state** - App execution status, ports, logs
- **Connection state** - WebSocket connection management
- **Generation state** - Generation progress, timeline, files
- **Presentation state** - Presentation mode, overlays, effects
- **Replay state** - Session replay controls and playback
- **UI state** - Modal dialogs, toasts, loading states

Store definitions: `client/src/stores/`

### 7. App Execution
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

### 8. Presentation Mode (Fighting Game Arena)
Full-screen, stage-ready presentation mode for live demos and conference presentations:

**Features**:
- **Dramatic Overlays** with fighting game aesthetics (Tekken/Street Fighter inspired):
  - GenerationStartOverlay - "READY... FIGHT!" sequence with capability config
  - ToolCallHUD - Live tool call tracking with combo counter and budget
  - FileCreatedOverlay - Achievement toasts with confetti particle effects
  - ErrorOverlay - "K.O." screen with screen shake and glitch effects
  - VictoryOverlay - Final stats screen with animated counters and fireworks
  - ValidationOverlay, TemplateLoadingOverlay, BlockRequestOverlay, PlanningOverlay, and more
  - See `client/src/components/presentation/` for complete list
- **Keyboard Controls**:
  - `P` - Toggle presentation mode on/off
  - `M` - Toggle audio mute (when active)
  - `Escape` - Exit presentation mode
- **Real-Time Event Wiring**: Tracks generation/replay events and triggers overlays
- **Works with Both Modes**:
  - **Live generations**: Real-time WebSocket events as generation happens
  - **Replay mode**: Syncs with 10x replay playback speed

**Technical Stack**:
- Zustand stores for state management (presentation, replay, generation)
- tsParticles for confetti/fireworks effects
- Motion library for smooth animations
- React hooks for keyboard shortcuts and event handling

**Design Tokens** (`client/src/lib/presentation-tokens.ts`):
- Neon color palette (cyan, magenta, yellow, gold)
- Stage-visible typography (readable from 20+ feet)
- Semantic spacing and timing values
- Z-index layering for overlays

**Usage**: Press `P` on any SessionPage (live or completed) to activate presentation mode. In replay mode, press the play button to see overlays animate with the replay.

### 9. Storybook Component Development
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

### GitHub-Based Workflow

**IMPORTANT**: All future work, planning, and task tracking should be done in GitHub issues, NOT in markdown files.

**DO:**
- ✅ Use `gh issue create` to track new features, bugs, or ideas
- ✅ Use `gh issue comment` to add notes, updates, or implementation details
- ✅ Use labels to organize issues (bug, enhancement, refactoring, etc.)
- ✅ Reference issues in commit messages (e.g., "Fixes #8")

**DON'T:**
- ❌ Create new markdown files for planning (PLAN_V2.md, TODO.md, etc.)
- ❌ Create analysis documents (ANALYSIS.md, RESEARCH.md, etc.)
- ❌ Create temporary notes files that accumulate over time

**Exception**: Only update existing documentation files (CLAUDE.md, DESIGN.md, TESTING.md, README.md)

**Common Commands:**
```bash
# View all open issues
gh issue list

# View issues by label
gh issue list --label "bug"
gh issue list --label "enhancement"

# Create issue
gh issue create --title "Issue title" --body "Description..."

# Add updates
gh issue comment <number> --body "Update..."

# Close when done
gh issue close <number> --comment "Completed"
```

### Completed Major Features

✅ **Foundation**: Basic harness, LLM integration, file system, Docker execution
✅ **Session Persistence**: Drizzle ORM database, session recovery with React Router 7
✅ **Capability System**: Input modes (naive/template) and toggles (planning/compiler checks/building blocks)
✅ **State Management**: Complete Zustand migration with specialized stores
✅ **File Editing**: CodeMirror editor, tabs, resizable panels
✅ **Presentation Mode**: Full-screen fighting game aesthetics for live demos

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
- To gather evidence for improving prompts or capabilities
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
- Comprehensive test suite with all tests passing
  - TypeScript strict mode enabled
  - Full coverage of capabilities, Docker service, process service, and session reliability
- Comprehensive test coverage:
  - Capability implementations and tool execution
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
- [Bug fixes](https://github.com/infomiho/gen-fullstack/labels/bug)
- [New features & enhancements](https://github.com/infomiho/gen-fullstack/labels/enhancement)
- [Refactoring tasks (Code quality)](https://github.com/infomiho/gen-fullstack/labels/refactoring)
- [Prompt engineering improvements](https://github.com/infomiho/gen-fullstack/labels/prompt-engineering)
