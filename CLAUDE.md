# Claude Context Document

## Project Overview

This is Gen Fullstack - an experimental LLM-powered full-stack application generator. It provides a real-time interface for generating complete applications using different prompting strategies and tool-calling approaches.

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

### 3. Generation Strategies
Multiple approaches to code generation (extensible):
- **Naive**: Direct prompt-to-code generation
- **Plan First**: Generate plan before implementation
- **With Template**: Start from pre-built template
- **Compiler Checks**: Self-correct with TypeScript errors
- **Building Blocks**: Use higher-level components

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
Docker-based secure execution of generated apps:
- **Docker Service** (`server/src/services/docker.service.ts`):
  - Container lifecycle management (create, start, stop, destroy)
  - Resource limits and security constraints
  - Log streaming and event forwarding
  - Automatic cleanup with configurable timeouts

- **Process Service** (`server/src/services/process.service.ts`):
  - Simplified API for app execution
  - Dependency installation (pnpm install)
  - Dev server management (pnpm dev)
  - Event forwarding to WebSocket clients

- **Preview Proxy** (`server/src/index.ts`):
  - HTTP proxy: `/preview/:sessionId/*` → container ports
  - WebSocket proxy for Vite HMR
  - Error handling and status checks

- **Security Model**:
  - Isolated Docker containers per session
  - Non-root user execution
  - Dropped Linux capabilities
  - Resource limits (512MB RAM, 1 CPU)
  - Network isolation via Docker
  - Read-only root filesystem

## Recent Changes

### Phase 4: Docker-Based App Execution (Latest - Production Ready ✅)
- **Docker Service**: Production-ready container management with comprehensive security
  - Build and manage runner images with automatic detection (Colima, Docker Desktop, Linux)
  - Socket path validation with symlink resolution (TOCTOU attack prevention)
  - Path whitelisting (/var/run, ~/.colima, ~/.docker only)
  - Create isolated containers with resource limits (512MB RAM, 1 CPU core)
  - Port mapping for Vite dev servers (ports 5000-5100)
  - Real-time log streaming with correct Docker multiplexed stream format
  - Buffer accumulation for partial stream chunks
  - Memory leak prevention: cleanup functions for all event listeners, timers, streams
  - Automatic cleanup with configurable timeouts (10 min max runtime)
  - Security: non-root user, dropped all capabilities, no-new-privileges flag

- **Process Service**: High-level app lifecycle management
  - Start/stop/restart apps with full error handling
  - Install dependencies (pnpm install) with 2-minute timeout
  - Start dev servers (pnpm dev) with readiness detection
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

## Development Commands

```bash
# Install dependencies
pnpm install

# Run both client and server in dev mode
pnpm dev

# Run client only
pnpm dev:client

# Run server only
pnpm dev:server

# Type check
pnpm typecheck

# Run tests
pnpm test

# Format code
pnpm format

# Build for production
pnpm build
```

## Environment Variables

Server requires `.env` file:
```
OPENAI_API_KEY=your_api_key_here
PORT=3001
```

## Testing

- Server tests in `server/src/**/__tests__/*.test.ts`
- Uses Vitest 3.2 for testing
- **Current test suite: 133/133 tests passing** ✅
  - Strategy tests: 88/88 passing ✅
  - Docker service tests: 24/24 passing ✅
  - Process service tests: 21/21 passing ✅
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

1. No persistence - all data lost on page refresh
2. Single active generation at a time
3. File viewer uses client-side syntax highlighting (limited language support)
4. No authentication or multi-user support
5. Frontend UI for app execution not yet implemented (Phase 4 backend complete, WebSocket events ready)
6. Docker required for app execution:
   - Automatic detection supports Docker Desktop, Colima, and standard Linux Docker
   - Clear error messages if Docker is unavailable
   - No WebContainer fallback for browser-based execution (future consideration)

## Future Considerations

- Add generation history/persistence
- Implement streaming for large file outputs
- Add diff view for file changes
- Support for multiple concurrent generations
- Cost tracking and budgeting features
- More sophisticated strategy implementations
- Frontend UI components for app execution (AppControls, AppPreview, LogViewer)
- Docker availability detection and fallback handling
- Multi-container support for full-stack apps (frontend + backend containers)
- WebContainer integration as Docker alternative for browser-based execution
