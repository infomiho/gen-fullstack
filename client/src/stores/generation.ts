import type {
  FileUpdate,
  GenerationMetrics,
  LLMMessage,
  ToolCall,
  ToolResult,
} from '@gen-fullstack/shared';
import { MAX_MESSAGES } from '@gen-fullstack/shared';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * Generation Store
 *
 * Manages all state related to LLM generation:
 * - Messages from the LLM
 * - Tool calls and their results
 * - File updates
 * - Generation status and metrics
 */

interface GenerationState {
  // Core generation state
  messages: LLMMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  files: FileUpdate[];
  isGenerating: boolean;
  metrics: GenerationMetrics | null;
}

interface GenerationActions {
  // Message management
  addMessage: (message: LLMMessage) => void;
  updateMessage: (id: string, content: string) => void;

  // Tool call management
  addToolCall: (toolCall: ToolCall) => void;
  addToolResult: (result: ToolResult) => void;

  // File management
  updateFile: (file: FileUpdate) => void;

  // Generation control
  setGenerating: (value: boolean) => void;
  setMetrics: (metrics: GenerationMetrics | null) => void;

  // Utility actions
  reset: () => void;
  checkAndTruncate: () => {
    truncated: boolean;
    count: number;
    type: 'messages' | 'toolCalls' | 'toolResults';
  };
}

type GenerationStore = GenerationState & GenerationActions;

const initialState: GenerationState = {
  messages: [],
  toolCalls: [],
  toolResults: [],
  files: [],
  isGenerating: false,
  metrics: null,
};

export const useGenerationStore = create<GenerationStore>()(
  devtools(
    immer((set) => ({
      ...initialState,

      addMessage: (message) =>
        set((state) => {
          // Check if message already exists (for accumulation)
          const existingIndex = state.messages.findIndex((m) => m.id === message.id);

          if (existingIndex >= 0) {
            // Accumulate content into existing message
            state.messages[existingIndex].content += message.content;
          } else {
            // New message - add to list
            state.messages.push(message);
          }
        }),

      updateMessage: (id, content) =>
        set((state) => {
          const index = state.messages.findIndex((m) => m.id === id);
          if (index >= 0) {
            state.messages[index].content = content;
          }
        }),

      addToolCall: (toolCall) =>
        set((state) => {
          state.toolCalls.push(toolCall);
        }),

      addToolResult: (result) =>
        set((state) => {
          state.toolResults.push(result);
        }),

      updateFile: (file) =>
        set((state) => {
          const existingIndex = state.files.findIndex((f) => f.path === file.path);
          if (existingIndex >= 0) {
            state.files[existingIndex] = file;
          } else {
            state.files.push(file);
          }
        }),

      setGenerating: (value) => set({ isGenerating: value }),

      setMetrics: (metrics) => set({ metrics }),

      reset: () => set(initialState),

      checkAndTruncate: () => {
        // Use single set() call for atomicity - prevents race conditions
        let truncated = false;
        let count = 0;
        let type: 'messages' | 'toolCalls' | 'toolResults' = 'messages';

        set((draft) => {
          // Check messages
          if (draft.messages.length > MAX_MESSAGES) {
            count = draft.messages.length - MAX_MESSAGES;
            draft.messages.splice(0, count);
            truncated = true;
            type = 'messages';
          }

          // Check tool calls
          if (draft.toolCalls.length > MAX_MESSAGES) {
            count = draft.toolCalls.length - MAX_MESSAGES;
            draft.toolCalls.splice(0, count);
            truncated = true;
            type = 'toolCalls';
          }

          // Check tool results
          if (draft.toolResults.length > MAX_MESSAGES) {
            count = draft.toolResults.length - MAX_MESSAGES;
            draft.toolResults.splice(0, count);
            truncated = true;
            type = 'toolResults';
          }
        });

        return { truncated, count, type };
      },
    })),
    { name: 'GenerationStore' },
  ),
);
