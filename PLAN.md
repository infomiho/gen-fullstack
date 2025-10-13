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

### Phase 2: LLM Integration 🚀 IN PROGRESS

**Goal**: Connect to OpenAI and handle tool calling with streaming

#### 2.1: Core LLM Service with Vercel AI SDK

- [ ] Install dependencies
  - `pnpm add ai @ai-sdk/openai` in server package
  - Latest versions: `ai@5.0+`, `@ai-sdk/openai@1.0+`

- [ ] Create `server/src/services/llm.service.ts`
  - Initialize OpenAI provider from `@ai-sdk/openai`
  - Export configured model factory (default: `openai('gpt-5-mini')`)
  - Support model selection: `gpt-5`, `gpt-5-mini`, `gpt-5-nano`
  - Error handling for rate limits, timeouts, network errors
  - Token counting from response metadata

- [ ] Implement message history management
  - Store conversation context per socket session (Map<socketId, ModelMessage[]>)
  - Maintain system prompts for each strategy
  - Use `convertToModelMessages()` helper for UI messages
  - Prune old messages to stay within token limits

#### 2.2: Tool Calling Implementation with AI SDK

- [ ] Create `server/src/tools/index.ts` using AI SDK's `tool()` function
  - `writeFile`: tool({ description, inputSchema: z.object({path, content}), execute })
  - `readFile`: tool({ description, inputSchema: z.object({path}), execute })
  - `listFiles`: tool({ description, inputSchema: z.object({directory}), execute })
  - `executeCommand`: tool({ description, inputSchema: z.object({command}), execute })

- [ ] Create `server/src/services/filesystem.service.ts`
  - Sandbox execution in `/generated/<session-id>/` directory
  - Path traversal protection (validate paths stay within sandbox)
  - File read/write/list operations
  - Return formatted results for LLM consumption

- [ ] Create `server/src/services/command.service.ts`
  - Command whitelist for security (npm, pnpm, node, tsc, vite)
  - Execute commands in sandboxed directory
  - Capture stdout/stderr with timeout
  - Handle errors gracefully

#### 2.3: Streaming Integration with AI SDK

- [ ] Set up streaming with `streamText()`
  - Use AI SDK's `streamText()` function (handles SSE automatically)
  - Iterate over `result.fullStream` for all event types
  - Handle stream parts: `text-delta`, `tool-call`, `tool-call-delta`, `tool-result`
  - Access `result.textStream` for text-only consumption if needed

- [ ] WebSocket streaming to frontend
  - Forward `text-delta` parts as `llm_message` events via Socket.io
  - Forward `tool-call` parts as `tool_call` events
  - Forward `tool-result` parts as `tool_result` events
  - Use `onFinish` callback to emit `generation_complete` with usage metrics
  - Handle disconnections mid-stream (abort controller)

#### 2.4: Naive Strategy Implementation

- [ ] Create `server/src/strategies/base.strategy.ts`
  - Abstract base class with common logic
  - Method: `generateApp(prompt, socket, sessionId): Promise<void>`
  - Common streamText configuration
  - Token tracking from response.usage
  - Error handling

- [ ] Create `server/src/strategies/naive.strategy.ts`
  - Use `streamText()` with tools imported from `tools/index.ts`
  - System prompt: "You are a full-stack app generator..."
  - No planning, no template (direct prompt to code)
  - Configure `stopWhen: stepCountIs(10)` for multi-step execution
  - Iterate over `fullStream` and forward events to Socket.io
  - Generate package.json, vite.config.ts, src files via tool calls

- [ ] Update WebSocket handler to use strategy
  - Instantiate NaiveStrategy based on user selection
  - Call `strategy.generateApp()` on `start_generation`
  - Handle strategy errors and emit `error` event

#### 2.5: UI Updates for Tool Calls

- [ ] Update `client/src/hooks/useWebSocket.ts`
  - Already has toolCalls and toolResults state ✅
  - No changes needed

- [ ] Create `client/src/components/ToolCallDisplay.tsx`
  - Show tool calls in a formatted way
  - Display: tool name, parameters, execution status
  - Show tool results (truncated if long)

- [ ] Update `client/src/App.tsx`
  - Add ToolCallDisplay component
  - Show tool calls alongside messages
  - Add loading indicator during generation

#### 2.6: Testing & Error Handling

- [ ] Add tool tests (`tools/__tests__/`)
  - Test each tool with valid/invalid Zod inputs
  - Mock filesystem and command operations
  - Test error handling for each tool

- [ ] Add service tests
  - Test filesystem.service.ts (path traversal protection, sandbox isolation)
  - Test command.service.ts (whitelist enforcement, timeout handling)
  - Mock file system operations with in-memory alternatives

- [ ] Add strategy tests
  - Mock `streamText()` responses from AI SDK
  - Test strategy flow without hitting real API
  - Verify Socket.io events are emitted correctly

- [ ] Integration testing (optional)
  - Test full flow: prompt → AI SDK → tools → files generated
  - Use real OpenAI API sparingly (set up test credits/limits)

**Deliverables**:
- Working naive strategy that generates a simple React app from a prompt
- Streaming LLM responses visible in UI
- Tool calls displayed in real-time
- Generated files written to `/generated/<session-id>/`
- Error handling for API failures

### Phase 3: File System Operations

**Goal**: Generate and manage app files

- [ ] File system manager service

  - Create isolated directories per generation
  - Write files from LLM tool calls
  - Clean up old generations

- [ ] File tree viewer in UI
- [ ] File content viewer/editor
- [ ] Syntax highlighting for code preview

### Phase 4: App Execution & Preview

**Goal**: Run generated apps and preview results

- [ ] Process manager for spawning generated apps

  - Start Vite dev server for frontend
  - Start backend server (if applicable)
  - Capture stdout/stderr logs

- [ ] Preview iframe in UI

  - Local development server proxy
  - Handle CORS/security considerations
  - Refresh on rebuild

- [ ] Log viewer for build/runtime output
- [ ] Error highlighting and display

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
| Phase 2: LLM Integration | 🚀 Ready to Start | 0% |
| Phase 3: File System Operations | ⏳ Pending | 0% |
| Phase 4: App Execution & Preview | ⏳ Pending | 0% |
| Phase 5: Optimization Toggles | ⏳ Pending | 0% |
| Phase 6: Demo Scenarios | ⏳ Pending | 0% |
| Phase 7: Polish & UX | ⏳ Pending | 0% |

## Next Steps for Phase 2

1. ✅ Review Phase 1 completion (DONE)
2. ✅ Research and select LLM integration approach (DONE - chose Vercel AI SDK)
3. 🚀 Install AI SDK dependencies (`ai`, `@ai-sdk/openai`)
4. Create tools with `tool()` function and Zod schemas
5. Implement filesystem and command services
6. Create naive strategy with `streamText()`
7. Test with simple prompts ("create a counter app")
8. Iterate and improve error handling

## Docs

Use context7 MCP for any documentation needs.
