# Gen Fullstack Demo Tool

A demonstration harness for showcasing iterative improvements in full-stack app generation using LLMs.

## Project Structure

```
gen-fullstack/
├── server/          # Express + Socket.io backend
├── client/          # React + Vite frontend
├── generated/       # Generated apps output
├── templates/       # Starting templates
└── blocks/          # Higher-level building blocks
```

## Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- OpenAI API key

### Installation

1. Install all dependencies:

```bash
pnpm install
```

2. Configure environment:

**Server:**
```bash
cd server
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

**Client:**
```bash
cd client
cp .env.example .env
# Edit if you need to change VITE_API_URL (default: http://localhost:3001)
```

### Running the Application

**Option 1: Run both server and client together (recommended)**

```bash
pnpm dev
```

**Option 2: Run separately**

Start the server:
```bash
pnpm dev:server
```

Start the client:
```bash
pnpm dev:client
```

3. Open http://localhost:5173 in your browser

## Current Status

**Phase 1 Complete**: Basic harness setup ✅

- ✅ Monorepo structure with pnpm workspaces
- ✅ Express 5 server with Socket.io WebSocket
- ✅ React 19 dashboard with WebSocket connection
- ✅ Basic prompt input and response display
- ✅ Strategy selector UI
- ✅ **All critical issues fixed** (see `CODE_REVIEW_FIXES.md`)
  - Zod validation for WebSocket events
  - Environment variable validation
  - Graceful shutdown handling
  - No race conditions
  - Memory leak prevention

**Ready for Phase 2**: LLM Integration

- Implement OpenAI service with streaming
- Add tool calling for file operations
- Create generation state machine
- Implement all 5 generation strategies

## Generation Strategies

The tool supports 5 different generation strategies:

1. **Naive Approach** - Direct prompt to code
2. **Plan First** - Generate high-level plan before coding
3. **With Template** - Start with pre-built template
4. **Compiler Checks** - Self-correct with TypeScript errors
5. **Building Blocks** - Use higher-level components

## Development

### Workspace Commands (from root)

```bash
pnpm dev           # Run both server and client in parallel
pnpm dev:server    # Run server only
pnpm dev:client    # Run client only
pnpm build         # Build both projects
pnpm test          # Run all tests once
pnpm test:watch    # Run tests in watch mode
pnpm test:ui       # Open Vitest UI for both projects
pnpm typecheck     # Type check all workspaces
pnpm format        # Format all workspaces
pnpm lint          # Lint all workspaces
```

### Individual Package Commands

**Server:**
```bash
cd server
pnpm dev           # Start dev server with watch mode
pnpm build         # Build TypeScript
pnpm test          # Run tests in watch mode
pnpm test:run      # Run tests once
pnpm test:ui       # Open Vitest UI
pnpm typecheck     # Type checking
pnpm format        # Format code with Prettier
```

**Client:**
```bash
cd client
pnpm dev           # Start Vite dev server
pnpm build         # Build for production
pnpm test          # Run tests in watch mode
pnpm test:run      # Run tests once
pnpm test:ui       # Open Vitest UI
pnpm typecheck     # Type checking
pnpm format        # Format code with Prettier
```

## Tech Stack

### Latest Versions (2025)
- **Backend**: Node.js 22+, Express 5.0, Socket.io 4.8, TypeScript 5.9
- **Frontend**: React 19.2, Vite 7.1, Tailwind CSS 4.1, TypeScript 5.9
- **Package Manager**: pnpm 9+ with workspaces
- **LLM**: Vercel AI SDK 5.0 with GPT-5-mini model
- **Validation**: Zod 3.24
- **Testing**: Vitest 3.2 with @testing-library/react 16

## Key Features

- **React 19**: Latest stable release with new hooks and optimizations
- **Vite 7**: Next-gen build tool with Environment API
- **Tailwind CSS 4**: Zero-config setup with automatic template discovery, 5x faster builds
- **Vitest 3**: Fast unit testing with UI and coverage support
- **pnpm Workspaces**: Efficient monorepo management
- **WebSocket**: Real-time communication between client and server
- **Type-Safe Events**: Full TypeScript support for Socket.io events
- **Express 5**: Latest major version with improved performance

## License

MIT
