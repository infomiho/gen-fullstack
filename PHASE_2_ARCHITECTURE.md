# Phase 2 Architecture: Vercel AI SDK Integration

## Research Summary

We evaluated two approaches for LLM integration:

### Option 1: OpenAI Node SDK (Direct)
- ✅ Direct API access (official SDK)
- ✅ `runTools()` for automatic function execution
- ✅ Rich event system
- ⚠️ More boilerplate for streaming/tool calling
- ⚠️ Less React-specific helpers

### Option 2: Vercel AI SDK 5.0 (Recommended) ✅
- ✅ Built-in streaming with multiple consumption modes
- ✅ Tool call streaming (inputs stream by default in v5)
- ✅ End-to-end type safety with TypeScript
- ✅ Perfect React integration (`useChat`, `toUIMessageStreamResponse()`)
- ✅ Multi-step execution with `stepCountIs()`
- ✅ Provider agnostic (OpenAI, Anthropic, Google, etc.)
- ✅ Cleaner tool definitions with `tool()` and Zod
- ⚠️ Tool results don't auto-stream (only inputs) - acceptable trade-off

## Decision: Use Vercel AI SDK

**Rationale**:
1. **Perfect architectural fit** - Built for React + streaming, integrates seamlessly with our WebSocket layer
2. **Faster development** - Reduces boilerplate by ~60% compared to raw OpenAI SDK
3. **Type safety** - Crucial for demo tool reliability and developer experience
4. **Multi-provider flexibility** - Easy to showcase different strategies with different LLM providers
5. **Modern patterns** - Represents 2025 best practices for AI application development
6. **Excellent documentation** - Well-documented with extensive examples via context7

## Model Selection: GPT-5-mini

**Primary Model**: `gpt-5-mini` (Released August 2025)

**Why GPT-5-mini for our demo tool**:
- **Cost-effective**: $0.25 input / $2 output per 1M tokens (5x cheaper than gpt-5)
- **Excellent for code generation**: Strong performance on coding benchmarks
- **Fast streaming**: Better latency for live demonstrations
- **Large context**: 272K input tokens for complex app generation
- **Budget-friendly**: Can run many demo generations without breaking the bank

**Alternative Models**:
- **gpt-5**: Premium model ($1.25/$10) for complex scenarios requiring 74.9% SWE-bench performance
- **gpt-5-nano**: Ultra-cheap ($0.05/$0.40) for simple, rapid demos

**Flexible Architecture**: Our implementation allows easy model switching per strategy, enabling comparisons in presentations.

## Implementation Approach

### Core Architecture Flow

```
User Input (React)
    ↓
WebSocket (Socket.io)
    ↓
Strategy (NaiveStrategy, etc.)
    ↓
AI SDK streamText()
    ↓
    ├─→ textStream → forward to Socket.io
    ├─→ fullStream → handle all events (text, tool-call, tool-result)
    └─→ onFinish → emit generation_complete with metrics
    ↓
Tools (tool() function with Zod)
    ↓
    ├─→ writeFile → filesystem.service.ts
    ├─→ readFile → filesystem.service.ts
    ├─→ listFiles → filesystem.service.ts
    └─→ executeCommand → command.service.ts
    ↓
Generated App Files in /generated/<session-id>/
```

### Key Components

#### 1. AI SDK Integration (`server/src/services/llm.service.ts`)
```typescript
import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';

// GPT-5 Model Selection (Released August 2025)
// Use gpt-5-mini as default - best balance of cost/performance for demos
const MODEL_CONFIG = {
  default: 'gpt-5-mini',    // $0.25/$2 per 1M tokens, fast, excellent for code gen
  premium: 'gpt-5',         // $1.25/$10 per 1M tokens, 74.9% SWE-bench Verified
  budget: 'gpt-5-nano',     // $0.05/$0.40 per 1M tokens, ultra-fast demos
} as const;

// Model factory for flexible strategy selection
export const getModel = (modelName: string = MODEL_CONFIG.default) => {
  return openai(modelName);
};

// Capabilities:
// - 272K input / 128K output tokens
// - Reasoning levels: minimal, low, medium, high
// - 94.6% on AIME 2025 math benchmarks
// - 45% fewer factual errors vs GPT-4o
```

#### 2. Tool Definitions (`server/src/tools/index.ts`)
```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const writeFile = tool({
  description: 'Write content to a file',
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async ({ path, content }) => {
    // Implementation via filesystem.service.ts
  },
});

// Similar for readFile, listFiles, executeCommand
```

#### 3. Strategy Pattern (`server/src/strategies/naive.strategy.ts`)
```typescript
import { streamText, stepCountIs } from 'ai';
import { tools } from '../tools';

export class NaiveStrategy extends BaseStrategy {
  async generateApp(prompt: string, socket: Socket, sessionId: string) {
    const result = streamText({
      model: this.model,
      system: 'You are a full-stack app generator...',
      prompt,
      tools,
      stopWhen: stepCountIs(10), // Multi-step execution
    });

    // Iterate over fullStream and forward to Socket.io
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        socket.emit('llm_message', { role: 'assistant', content: part.text });
      } else if (part.type === 'tool-call') {
        socket.emit('tool_call', { name: part.toolName, args: part.args });
      } else if (part.type === 'tool-result') {
        socket.emit('tool_result', { result: part.result });
      }
    }

    // Access final result and usage
    const { usage } = await result;
    socket.emit('generation_complete', { tokens: usage.totalTokens });
  }
}
```

#### 4. WebSocket Integration (`server/src/websocket.ts`)
```typescript
socket.on('start_generation', async (payload) => {
  const { prompt, strategy } = StartGenerationSchema.parse(payload);

  const strategyInstance = new NaiveStrategy();
  await strategyInstance.generateApp(prompt, socket, socket.id);
});
```

## Dependencies to Install

```bash
cd server
pnpm add ai@^5.0.0 @ai-sdk/openai@^1.0.0
```

## Benefits for Demo Tool

1. **Real-time streaming** - See LLM thinking process as it happens
2. **Tool call visibility** - Watch as AI decides to write files, run commands
3. **Multi-provider demos** - Easy to add Anthropic/Google for comparison
4. **Type-safe tools** - Zod validation prevents runtime errors
5. **Metrics tracking** - Built-in token usage and timing data
6. **Error handling** - Structured error types for better UX

## Phase 2 Success Criteria

- ✅ Streaming text visible in real-time
- ✅ Tool calls displayed as they occur
- ✅ Files written to `/generated/<session-id>/`
- ✅ Commands executed safely in sandbox
- ✅ Generation metrics shown (tokens, time)
- ✅ Error handling for all failure modes
- ✅ Tests passing for all components

## Next Implementation Steps

1. Install AI SDK dependencies
2. Create tool definitions with Zod schemas
3. Implement filesystem.service.ts (sandboxing, path validation)
4. Implement command.service.ts (whitelist, timeout)
5. Create base strategy class
6. Implement naive strategy with streamText
7. Update WebSocket handler
8. Add UI components for tool call display
9. Write tests for all components
10. Test end-to-end with simple app generation

## References

- Vercel AI SDK Docs: https://ai-sdk.dev/docs/introduction
- OpenAI API Docs: https://platform.openai.com/docs/api-reference
- Context7 library ID: `/vercel/ai` (for latest docs)
