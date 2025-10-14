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
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Design tokens & utilities
├── server/           # Node.js backend
│   ├── src/
│   │   ├── strategies/   # Generation strategies
│   │   └── tools/        # LLM tools
├── shared/           # Shared TypeScript types
└── test-outputs/     # Generated application outputs
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

## Recent Changes

### Design System Refactoring (Latest)
- Created centralized design tokens file
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

- Server tests in `server/src/**/*.test.ts`
- Uses Vitest for testing
- Current test suite: 88 tests passing
- Focuses on strategy implementations and tool execution

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

## Future Considerations

- Add generation history/persistence
- Implement streaming for large file outputs
- Add diff view for file changes
- Support for multiple concurrent generations
- Cost tracking and budgeting features
- More sophisticated strategy implementations
