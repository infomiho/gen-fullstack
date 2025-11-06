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
- OpenAI API key (required)
- Anthropic API key (optional, for Claude models)

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
# Edit .env and add your API keys:
# - OPENAI_API_KEY (required for GPT models)
# - ANTHROPIC_API_KEY (optional for Claude models)
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

## Features

- **Full-Stack Generation**: Generate complete React + Express + Prisma applications from natural language prompts
- **Real-Time Streaming**: WebSocket-based UI with live LLM responses and tool execution
- **Docker Execution**: Secure, isolated execution of generated apps with automatic port mapping
- **Session Persistence**: SQLite database stores all sessions, timeline events, and generated files
- **Session Replay**: Replay any completed generation at 10x speed with full timeline reconstruction
- **File Editor**: Edit generated files with CodeMirror syntax highlighting
- **Presentation Mode**: Full-screen fighting game aesthetics for live demos and conferences
- **Capability System**: Flexible generation modes with composable options

## Generation Capabilities

The system supports flexible capability configurations:

### Input Modes (choose one):
- **Naive** - Generate from scratch, write all files directly
- **Template** - Start from pre-built full-stack template

### Optional Features (can combine with any input mode):
- **Planning** - Generate architectural plan before implementation
- **Compiler Checks** - Validate with Prisma and TypeScript, iterate to fix errors
- **Building Blocks** - Use higher-level reusable components

Examples: Naive + Planning, Template + Compiler Checks, or any combination you need.

## AI Models

The system supports multiple AI providers and models:

### OpenAI GPT-5 Series
- **GPT-5** - Premium model for complex scenarios ($1.25 / $10 per 1M tokens)
- **GPT-5 Mini** (default) - Best balance of cost/performance ($0.25 / $2 per 1M tokens)
- **GPT-5 Nano** - Budget model for simple demos ($0.05 / $0.40 per 1M tokens)

### Anthropic Claude 4.x Series
- **Claude Opus 4.1** - Most capable Claude model ($15 / $75 per 1M tokens)
- **Claude Sonnet 4.5** - Balanced model with great coding performance ($3 / $15 per 1M tokens)
- **Claude Haiku 4.5** - Fast and economical, 4-5x faster than Sonnet ($1 / $5 per 1M tokens)

Pricing format: `input / output` per 1M tokens (USD).

All model metadata (pricing, descriptions, capabilities) is centralized in the shared package to maintain consistency between client and server. You can select your preferred model in the UI before starting generation.

## Development

This project uses **Nx** for monorepo management with **local caching only** (no Nx Cloud). All commands leverage Nx's intelligent caching - running the same command twice will be instant if no files changed.

### Workspace Commands (from root)

```bash
pnpm dev           # Run both server and client in parallel (with Nx)
pnpm dev:server    # Run server only (with Nx)
pnpm dev:client    # Run client only (with Nx)
pnpm build         # Build both projects (cached with Nx)
pnpm test          # Run all tests once (cached with Nx)
pnpm test:watch    # Run tests in watch mode
pnpm test:ui       # Open Vitest UI for both projects
pnpm typecheck     # Type check all workspaces (cached with Nx)
pnpm format        # Format all workspaces
pnpm lint          # Lint all workspaces
```

**Nx benefits:**
- 🚀 **Cached builds**: Second build is instant if no code changed
- ⚡ **Parallel execution**: Multiple tasks run concurrently
- 🔗 **Smart dependencies**: Builds dependencies first automatically

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
- **Monorepo**: pnpm 9+ workspaces + Nx 22 (local caching only)
- **LLM**: Vercel AI SDK 5.0 with multi-provider support (OpenAI GPT-5 series, Anthropic Claude 4.x series)
- **Validation**: Zod 3.24
- **Testing**: Vitest 3.2 with @testing-library/react 16

## Key Features

- **React 19**: Latest stable release with new hooks and optimizations
- **Vite 7**: Next-gen build tool with Environment API
- **Tailwind CSS 4**: Zero-config setup with automatic template discovery, 5x faster builds
- **Vitest 3**: Fast unit testing with UI and coverage support
- **Nx + pnpm**: Efficient monorepo with intelligent caching (local only, no cloud)
- **WebSocket**: Real-time communication between client and server
- **Type-Safe Events**: Full TypeScript support for Socket.io events
- **Express 5**: Latest major version with improved performance

## License

MIT
