# Demo Tool Implementation Plan

## Overview

Build a demonstration harness for showcasing iterative improvements in full-stack app generation using LLMs. The tool will allow toggling different optimization strategies and displaying real-time LLM interactions.

## Architecture

### Tech Stack (Latest 2025 Versions)

- **Backend**: Node.js 22+, Express 5.0, Socket.io 4.8, TypeScript 5.9
- **Frontend**: React 19.2, Vite 7.1, Tailwind CSS 4.1, TypeScript 5.9
- **Package Manager**: pnpm 9+ with workspaces
- **Validation**: Zod 3.24 + Prettier 3.4
- **Unit Tests**: Vitest 3.2 with @testing-library/react 16
- **LLM Integration**: Vercel AI SDK 5.0 + OpenAI provider
- **Models**: GPT-5-mini (default), GPT-5 (premium), GPT-5-nano (budget)
- **Generated Apps**: Vite-based full-stack apps

### Architecture Decision: Vercel AI SDK

**Decision**: Use Vercel AI SDK instead of raw OpenAI Node SDK

**Rationale**:
1. **Built-in streaming** - `streamText()` handles SSE natively with multiple consumption modes (textStream, fullStream)
2. **Tool call streaming** - Tool inputs stream by default in v5, providing real-time updates
3. **End-to-end type safety** - Full TypeScript support from server to client with type inference
4. **React integration** - Perfect fit for our WebSocket → React architecture
5. **Multi-step execution** - Built-in `stepCountIs()` for multi-turn tool calling
6. **Provider flexibility** - Easy to demo different LLM providers (OpenAI, Anthropic, Google)
7. **Cleaner tool definitions** - `tool()` function with Zod schemas vs raw function definitions
8. **Modern patterns** - Represents 2025 best practices for AI application development

**Trade-offs**:
- Tool results don't auto-stream (only inputs), but acceptable for our use case
- Additional dependency, but worth it for developer experience and reduced boilerplate

### Model Selection: GPT-5 Progressive Upgrade Strategy

**Decision**: Using GPT-5 family for development and production

**Released**: August 2025

**Current Implementation**: `gpt-5-mini` (default)
- Pricing: $0.25/$2 per 1M tokens (input/output)
- Excellent for code generation with best cost/performance balance
- Context: 272K input / 128K output tokens
- Fast and reliable for full-stack app generation

**Available Models**:
- `gpt-5-mini`: Default model ($0.25/$2 per 1M tokens) - best balance
- `gpt-5`: Premium option ($1.25/$10 per 1M tokens) - 74.9% SWE-bench Verified, 94.6% AIME 2025
- `gpt-5-nano`: Budget option ($0.05/$0.40 per 1M tokens) - ultra-fast for simple demos

**Rationale**:
- GPT-5 models provide state-of-the-art code generation with massive context windows
- gpt-5-mini offers 10x cost savings vs gpt-4o with better performance
- 272K input context allows including entire codebases and extensive documentation
- Model selection is configurable via MODEL_CONFIG in llm.service.ts
- Can upgrade to gpt-5 premium for complex scenarios requiring maximum capability

### Core Components

1. **Demo Server** - Main orchestrator
2. **LLM Service** - Handles OpenAI API interactions
3. **File System Manager** - Creates/manages generated app files
4. **App Runner** - Spawns and manages generated app processes
5. **WebSocket Server** - Real-time communication with frontend
6. **React Dashboard** - UI for controlling demos and viewing results

### Secure Execution: Docker Sandboxing

**Security Model**: Generated apps run in isolated Docker containers to prevent malicious code execution

**Architecture**:
- Each generation session gets a dedicated Docker container
- Container is destroyed after session ends
- Network isolation prevents external communication (except approved npm registry)
- File system is mounted read-only except for /app workspace
- Resource limits: CPU, memory, disk I/O constraints

**Implementation** (Future Phase):
```typescript
interface DockerSandbox {
  containerId: string;
  sessionId: string;

  // Lifecycle
  create(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;

  // Operations
  writeFile(path: string, content: string): Promise<void>;
  executeCommand(command: string): Promise<CommandResult>;
  getFiles(): Promise<FileTree>;
}
```

**Docker Container Spec**:
```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache pnpm
USER node
# Resource limits configured via Docker API
```

**Benefits**:
1. **Security**: Prevents malicious code from accessing host system
2. **Isolation**: Each session is completely independent
3. **Consistency**: Same environment every time
4. **Cleanup**: Easy to destroy and recreate containers
5. **Resource Control**: Limit CPU, memory, network usage

**Current Status**: Phase 1-2 use filesystem sandboxing (`/generated/<sessionId>/`) with path traversal protection and command whitelisting. Docker integration planned for Phase 4 (App Execution & Preview).

## Implementation Phases

### Phase 1: Basic Harness Setup ✅ COMPLETE

**Goal**: Get the foundation running

- [x] Initialize monorepo structure
  - `/server` - Demo harness backend
  - `/client` - Demo dashboard frontend
  - `/generated` - Output directory for generated apps
  - `/templates` - Starting templates for optimized approaches
  - `/blocks` - Higher-level building blocks library

- [x] Setup Express 5 server with Socket.io
- [x] Setup React 19 + Vite 7 + Tailwind 4 frontend
- [x] Implement type-safe WebSocket connection
- [x] Basic prompt input and response display
- [x] Strategy selector UI
- [x] Message list component
- [x] Environment validation with Zod
- [x] Vitest 3 setup with example tests
- [x] All critical code review fixes applied

**Status**: All tests passing, type checking passing, production-ready foundation.

### Phase 2: LLM Integration ✅ COMPLETE

**Goal**: Connect to OpenAI and handle tool calling with streaming

#### 2.1: Core LLM Service with Vercel AI SDK

- [x] Install dependencies
  - `pnpm add ai @ai-sdk/openai` in server package
  - Latest versions: `ai@5.0.68`, `@ai-sdk/openai@2.0.52`

- [x] Create `server/src/services/llm.service.ts`
  - Initialize OpenAI provider from `@ai-sdk/openai`
  - Export configured model factory (default: `openai.responses('gpt-5-mini')`)
  - Support model selection: `gpt-5`, `gpt-5-mini`, `gpt-5-nano`
  - Error handling for rate limits, timeouts, network errors
  - Token counting from response metadata

- [x] Implement message history management
  - Store conversation context per socket session (Map<socketId, ModelMessage[]>)
  - Maintain system prompts for each strategy
  - Use `convertToModelMessages()` helper for UI messages
  - Prune old messages to stay within token limits

#### 2.2: Tool Calling Implementation with AI SDK

- [x] Create `server/src/tools/index.ts` using AI SDK's `tool()` function
  - `writeFile`: tool({ description, inputSchema: z.object({path, content}), execute })
  - `readFile`: tool({ description, inputSchema: z.object({path}), execute })
  - `listFiles`: tool({ description, inputSchema: z.object({directory}), execute })
  - `executeCommand`: tool({ description, inputSchema: z.object({command}), execute })

- [x] Create `server/src/services/filesystem.service.ts`
  - Sandbox execution in `/generated/<session-id>/` directory
  - Path traversal protection (validate paths stay within sandbox)
  - File read/write/list operations
  - Return formatted results for LLM consumption

- [x] Create `server/src/services/command.service.ts`
  - Command whitelist for security (npm, pnpm, node, tsc, vite)
  - Execute commands in sandboxed directory
  - Capture stdout/stderr with timeout
  - Handle errors gracefully

#### 2.3: Streaming Integration with AI SDK

- [x] Set up streaming with `streamText()`
  - Use AI SDK's `streamText()` function (handles SSE automatically)
  - Iterate over `result.fullStream` for all event types
  - Handle stream parts: `text-delta`, `tool-call`, `tool-call-delta`, `tool-result`
  - Access `result.textStream` for text-only consumption if needed

- [x] WebSocket streaming to frontend
  - Forward `text-delta` parts as `llm_message` events via Socket.io
  - Forward `tool-call` parts as `tool_call` events
  - Forward `tool-result` parts as `tool_result` events
  - Use `onFinish` callback to emit `generation_complete` with usage metrics
  - Handle disconnections mid-stream (abort controller)

#### 2.4: Naive Strategy Implementation

- [x] Create `server/src/strategies/base.strategy.ts`
  - Abstract base class with common logic
  - Method: `generateApp(prompt, socket, sessionId): Promise<void>`
  - Common streamText configuration
  - Token tracking from response.usage
  - Error handling

- [x] Create `server/src/strategies/naive.strategy.ts`
  - Use `streamText()` with tools imported from `tools/index.ts`
  - System prompt: "You are a full-stack app generator..."
  - No planning, no template (direct prompt to code)
  - Configure `stopWhen: stepCountIs(20)` for multi-step execution
  - Iterate over `fullStream` and forward events to Socket.io
  - Generate package.json, vite.config.ts, src files via tool calls

- [x] Update WebSocket handler to use strategy
  - Instantiate NaiveStrategy based on user selection
  - Call `strategy.generateApp()` on `start_generation`
  - Handle strategy errors and emit `error` event

#### 2.5: UI Updates for Tool Calls

- [x] Update `client/src/hooks/useWebSocket.ts`
  - Already has toolCalls and toolResults state ✅
  - No changes needed

- [x] Create `client/src/components/ToolCallDisplay.tsx`
  - Show tool calls in a formatted way
  - Display: tool name, parameters, execution status
  - Show tool results (truncated if long)
  - Minimalist design with neutral color palette

- [x] Update `client/src/App.tsx`
  - Add ToolCallDisplay component
  - Show tool calls alongside messages
  - Add loading indicator during generation
  - Minimalist UI design with tabs

#### 2.6: Testing & Error Handling

- [x] Add tool tests (`tools/__tests__/`)
  - Test each tool with valid/invalid Zod inputs
  - Mock filesystem and command operations
  - Test error handling for each tool

- [x] Add service tests
  - Test filesystem.service.ts (path traversal protection, sandbox isolation)
  - Test command.service.ts (whitelist enforcement, timeout handling)
  - Mock file system operations with in-memory alternatives

- [x] Add strategy tests
  - Mock `streamText()` responses from AI SDK
  - Test strategy flow without hitting real API
  - Verify Socket.io events are emitted correctly

- [x] Integration testing (optional)
  - Test full flow: prompt → AI SDK → tools → files generated
  - Use real OpenAI API sparingly (set up test credits/limits)

**Deliverables**:
- ✅ Working naive strategy that generates a simple React app from a prompt
- ✅ Streaming LLM responses visible in UI
- ✅ Tool calls displayed in real-time with minimalist design
- ✅ Generated files written to `/generated/<session-id>/`
- ✅ Error handling for API failures
- ✅ 88 tests passing

**Phase 3 Deliverables**:
- ✅ File system operations with sandbox isolation
- ✅ File tree viewer with hierarchical structure
- ✅ File content viewer with syntax highlighting
- ✅ Unified timeline with chronological ordering
- ✅ Real timestamps for accurate event sequencing
- ✅ Tool call modals with Radix UI
- ✅ All 88 tests passing

### Phase 3: File System Operations ✅ COMPLETE

**Goal**: Generate and manage app files with read-only viewing and unified timeline

**Status**: Complete - file viewing and timeline working perfectly

#### 3.1: File Operations (✅ Complete)

- [x] File system manager service
  - Create isolated directories per generation
  - Write files from LLM tool calls
  - Clean up old generations
  - Path traversal protection

#### 3.2: File Viewing UI (✅ Complete)

- [x] File tree viewer in UI (`FileTree.tsx`)
  - Hierarchical directory structure
  - Real-time updates from WebSocket
  - Select files for viewing

- [x] File content viewer (`FileViewer.tsx`)
  - Syntax highlighting with `react-syntax-highlighter`
  - Support for multiple languages (JS, TS, JSON, HTML, CSS, etc.)
  - Read-only viewing with dark theme

#### 3.3: Unified Timeline View (✅ Complete)

- [x] Unified timeline component (`Timeline.tsx`)
  - Chronological merging of messages and tool executions
  - Real timestamps (not index-based) for accurate ordering
  - Tool calls appear during generation, not batched at end
  - Messages and tools properly interleaved in real-time
  - Timestamp display (HH:MM:SS.mmm) in top right corner
  - Clickable tool cards with Radix UI modals for details
  - Custom formatting for different tool types (writeFile, readFile, listFiles, executeCommand)

#### 3.4: Code Editing (Phase 4-5)

**Decision**: Defer advanced code editing to Phase 4-5

**Research**: Analyzed bolt.new's architecture for best practices

**bolt.new Learnings** (from StackBlitz's https://github.com/stackblitz/bolt.new):

1. **CodeMirror 6** - Industry-standard code editor
   - Core packages: `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`
   - Language support: `@codemirror/lang-javascript`, `@codemirror/lang-typescript`, `@codemirror/lang-css`, etc.
   - Theme: `@uiw/codemirror-theme-vscode` for familiar experience

2. **UI Components** (bolt.new stack)
   - `react-resizable-panels` - Split pane layouts for code/preview
   - `@radix-ui/*` - Accessible component primitives (dropdowns, dialogs, etc.)
   - `lucide-react` - Icon library (we're already using this ✅)

3. **File Management**
   - WebContainer technology for in-browser Node.js runtime
   - Virtual file system with real-time updates
   - Multi-file editing with tab management

**Phase 4-5 Roadmap**:
- [ ] Add CodeMirror 6 for code editing
  - Install core packages and language extensions
  - Implement VSCode theme
  - Add file saving via WebSocket

- [ ] Enhance UI with resizable panels
  - Split editor/preview layout
  - Collapsible file tree
  - Tab management for multiple files

- [ ] Consider Radix UI components
  - Replace custom dropdowns with Radix primitives
  - Add accessible dialogs and tooltips
  - Maintain minimalist design while improving UX

**Current Implementation**:
- Using `react-syntax-highlighter` with `Prism` and `xonokai` theme
- Read-only file viewing sufficient for Phase 3 demo needs
- Clean, minimalist UI with file tree + viewer layout
- WebSocket-based real-time file updates working

### Phase 4: App Execution & Preview ✅ COMPLETE

**Goal**: Run generated apps and preview results in isolated Docker containers

**Status**: Complete - Docker execution system production-ready with comprehensive security

#### 4.1: Docker Container Management (✅ Complete)

- [x] Docker service (`docker.service.ts`)
  - Container lifecycle management (create, start, stop, destroy)
  - Automatic Docker socket detection (Colima, Docker Desktop, Linux)
  - Socket path validation with symlink resolution (TOCTOU attack prevention)
  - Path whitelisting (/var/run, ~/.colima, ~/.docker only)
  - Resource limits (512MB RAM, 1 CPU core)
  - Security hardening (dropped capabilities, non-root user, no-new-privileges)
  - Stream processing with correct Docker multiplexed format
  - Memory leak prevention (cleanup functions for all resources)

- [x] Process service (`process.service.ts`)
  - Full app lifecycle orchestration (install deps, start dev server)
  - Event forwarding (logs, status changes, build events)
  - Auto-cleanup after 10 minutes max runtime
  - Error handling with graceful degradation

#### 4.2: WebSocket Integration (✅ Complete)

- [x] Real-time events via Socket.IO
  - `app_status` - Container state changes (creating, installing, starting, running, failed, stopped)
  - `app_log` - Live stdout/stderr from containers
  - `build_event` - Build success/failure notifications
  - `start_app` - Client-triggered container startup
  - `stop_app` - Client-triggered container teardown

#### 4.3: Preview System (✅ Complete)

- [x] HTTP proxy for container access
  - Route `/preview/:sessionId/*` to container ports
  - Port allocation (5000-5100 range)
  - Vite dev server compatibility (DNS rebinding protection handled)
  - CORS/security considerations

#### 4.4: Security & Testing (✅ Complete)

- [x] Comprehensive security measures
  - Socket path validation (prevent path injection attacks)
  - Container isolation (read-only root, tmpfs /tmp)
  - Resource limits enforcement
  - Automatic cleanup timers
  - Stream listener cleanup (prevent memory leaks)

- [x] Unit tests (45 new tests)
  - Docker service tests (24 tests) - All passing
  - Process service tests (21 tests) - All passing
  - Mock-based testing with dockerode
  - Stream processing validation

- [x] Integration testing
  - End-to-end Docker execution script (`test-docker-execution.ts`)
  - Full lifecycle testing (build image, create container, install deps, start server, cleanup)
  - HTTP access validation
  - Comprehensive TESTING.md documentation

**Security Hardening Applied**:
1. ✅ Socket path validation (symlink resolution, path whitelisting, socket type verification)
2. ✅ Memory leak prevention (stream cleanup, timer cancellation, interval cleanup)
3. ✅ Race condition elimination (tracked cleanup timers and intervals)
4. ✅ Correct stream processing (Docker multiplexed format with buffer accumulation)
5. ✅ All critical code review findings addressed

**Deliverables**:
- ✅ Working Docker execution system with full security hardening
- ✅ 133 tests passing (was 88, added 45 Docker/Process tests)
- ✅ TypeScript strict mode with zero errors
- ✅ Production-ready container management
- ✅ Comprehensive testing documentation (TESTING.md)
- ✅ Integration test script with detailed output

### Phase 5: Optimization Toggles

**Goal**: Implement different generation strategies

Create configuration system for toggling:

1. **Naive Approach** (baseline)

   - Direct prompt to code
   - No planning phase
   - No template

2. **High-Level Plan First**

   - Generate plan as first step
   - Keep plan in context for subsequent generations
   - Show plan in UI

3. **Starting Template**

   - Begin with pre-built template structure
   - LLM builds on top of template
   - Reduces tokens and improves structure

4. **Compiler Checks**

   - Run TypeScript compiler after generation
   - Feed errors back to LLM
   - Iterate until compilation succeeds
   - Display error/fix cycles in UI

5. **Higher-Level Building Blocks**
   - Provide library of custom components/utilities
   - LLM composes from blocks instead of raw code
   - Focus on business logic

- [ ] Configuration panel in UI
- [ ] Strategy implementation for each approach
- [ ] Prompt engineering for each strategy
- [ ] Metrics tracking (tokens used, time, iterations)

### Phase 6: Demo Scenarios

**Goal**: Pre-configured demos for presentation

- [ ] Create example prompts for each phase:

  1. "Build a todo app with auth"
  2. "Build a blog with comments"
  3. "Build an e-commerce product catalog"

- [ ] Save/load demo configurations
- [ ] Side-by-side comparison mode
- [ ] Playback/replay functionality for smoother presentations

### Phase 7: Polish & UX

**Goal**: Make it presentation-ready

- [ ] Clean, minimal UI design
- [ ] Responsive layout
- [ ] Dark mode support
- [ ] Loading states and progress indicators
- [ ] Error handling and recovery
- [ ] Keyboard shortcuts
- [ ] Export results/logs

## Technical Considerations

### LLM Strategy Pattern

```
BaseStrategy (interface)
├── NaiveStrategy
├── PlanFirstStrategy
├── TemplateStrategy
├── CompilerCheckStrategy
└── BuildingBlocksStrategy
```

### WebSocket Events

```
Client → Server:
- start_generation { prompt, strategy }
- stop_generation
- restart_app
- clear_workspace

Server → Client:
- llm_message { role, content }
- tool_call { name, args }
- tool_result { result }
- file_updated { path, content }
- app_started { url, pid }
- app_log { type, message }
- compilation_error { errors }
- generation_complete { metrics }
```

### File Structure

```
gen-fullstack/
├── server/
│   ├── src/
│   │   ├── services/
│   │   │   ├── llm.service.ts
│   │   │   ├── filesystem.service.ts
│   │   │   ├── process.service.ts
│   │   │   └── compiler.service.ts
│   │   ├── strategies/
│   │   │   ├── base.strategy.ts
│   │   │   ├── naive.strategy.ts
│   │   │   ├── plan-first.strategy.ts
│   │   │   └── ...
│   │   ├── websocket.ts
│   │   └── index.ts
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PromptInput.tsx
│   │   │   ├── StrategySelector.tsx
│   │   │   ├── LLMChat.tsx
│   │   │   ├── FileTree.tsx
│   │   │   ├── AppPreview.tsx
│   │   │   └── LogViewer.tsx
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts
│   │   └── App.tsx
│   └── package.json
├── templates/
│   └── vite-fullstack-base/
├── blocks/
│   ├── auth-components.ts
│   └── database-helpers.ts
└── generated/
    └── [timestamp-based-folders]
```

## Success Criteria

- [ ] Can generate a working full-stack app from a single prompt
- [ ] All 5 optimization strategies are toggleable
- [ ] Real-time LLM conversation is visible
- [ ] Generated apps can be previewed in iframe
- [ ] Compiler errors are detected and fed back to LLM
- [ ] Metrics show improvement across strategies
- [ ] UI is clean and presentation-ready
- [ ] Demo can run offline (with pre-recorded responses as backup)

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Basic Harness Setup | ✅ Complete | 100% |
| Phase 2: LLM Integration | ✅ Complete | 100% |
| Phase 3: File System Operations | ✅ Complete | 100% |
| Phase 4: App Execution & Preview | ✅ Complete | 100% |
| Phase 5: Optimization Toggles | ⏳ Pending | 0% |
| Phase 6: Demo Scenarios | ⏳ Pending | 0% |
| Phase 7: Polish & UX | ⏳ Pending | 0% |

**Current Status**: 4 out of 7 phases complete (57% total progress)

## Key Achievements & Findings

### Phase 4 Insights - Docker Security & Testing

**Critical Security Vulnerabilities Fixed**:
1. **Socket Path Injection** - Implemented validation with symlink resolution, path whitelisting, and socket type verification
2. **Memory Leaks** - Added cleanup tracking for all event listeners, streams, and timers
3. **Race Conditions** - Properly tracked and cancelled all async operations (timers, intervals, streams)
4. **Stream Processing Bugs** - Correctly implemented Docker multiplexed stream format with proper buffer handling

**Testing Improvements**:
- Increased test coverage from 88 to 133 tests (+51% increase)
- All tests passing with TypeScript strict mode
- Created comprehensive integration test for end-to-end Docker flow
- Documented testing procedures in TESTING.md with Docker setup instructions

**Docker Runtime Support**:
- Automatic detection of Docker Desktop, Colima, and standard Linux Docker
- Graceful fallback when socket paths are unavailable
- Clear error messages for Docker availability issues

## Next Steps for Phase 5

1. Implement remaining generation strategies:
   - Plan-first strategy (generate architectural plan before code)
   - Template-based strategy (start from pre-built templates)
   - Compiler-check strategy (iterate with TypeScript errors)
   - Building-blocks strategy (compose from higher-level components)

2. Add strategy comparison metrics:
   - Token usage tracking per strategy
   - Time to completion
   - Success rate and error counts
   - Quality metrics (TypeScript errors, test coverage)

3. Enhance UI for strategy selection:
   - Strategy comparison dashboard
   - Side-by-side results view
   - Metrics visualization

## Docs

Use context7 MCP for any documentation needs.
