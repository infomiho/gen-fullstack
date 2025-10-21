import * as Dialog from '@radix-ui/react-dialog';
import { Wrench, X } from 'lucide-react';
import {
  focus,
  padding,
  radius,
  roleColors,
  spacing,
  transitions,
  typography,
} from '../../lib/design-tokens';
import { formatTimestamp } from '../../lib/time-utils';
import { getToolSummary, renderToolParameters } from '../../lib/tool-utils';

export interface ToolExecution {
  id: string;
  name: string;
  args: Record<string, unknown> | undefined;
  result?: string;
  isComplete: boolean;
  timestamp: number;
}

export interface ToolItemProps {
  /** The tool execution to display */
  tool: ToolExecution;
  /** Whether the tool dialog is open */
  isOpen: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * ToolItem component - displays a single tool execution in the timeline with modal details
 *
 * Shows tool name, completion status, and summary. Clicking opens a dialog with
 * full parameters and results.
 *
 * @example
 * ```tsx
 * <ToolItem
 *   tool={{ id: '1', name: 'writeFile', args: {...}, isComplete: true, timestamp: Date.now() }}
 *   isOpen={false}
 *   onOpenChange={(open) => console.log(open)}
 * />
 * ```
 */
export function ToolItem({ tool, isOpen, onOpenChange }: ToolItemProps) {
  const colors = roleColors.tool;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={`w-full flex gap-3 ${radius.md} ${padding.card} ${colors.bg} border ${colors.border} hover:border-gray-300 hover:bg-white ${transitions.colors} ${focus.ring} text-left`}
        >
          <div className="flex-shrink-0">
            <Wrench size={20} className={colors.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={typography.caption}>{tool.isComplete ? '●' : '○'}</span>
              <span className={`${typography.mono} text-gray-900 font-medium`}>{tool.name}</span>
              <span className={`${typography.monoSm} text-gray-400 ml-auto`}>
                {formatTimestamp(tool.timestamp)}
              </span>
              {!tool.isComplete && (
                <span className={`${typography.caption} text-gray-500`}>running...</span>
              )}
            </div>
            <div className={`${typography.caption} text-gray-600 truncate`}>
              {getToolSummary(tool.name, tool.args)}
            </div>
          </div>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 ${radius.md} border bg-white ${padding.panel} shadow-lg overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]`}
        >
          <Dialog.Title className={`${typography.label} text-lg mb-4 flex items-center gap-2`}>
            <Wrench size={20} className="text-gray-500" />
            <span className={typography.mono}>{tool.name}</span>
          </Dialog.Title>

          <Dialog.Description className="sr-only">
            Details of the {tool.name} tool execution
          </Dialog.Description>

          <div className={spacing.controls}>
            <div className={`flex items-center gap-2 ${typography.body}`}>
              <span className="text-gray-500">Status:</span>
              <span
                className={`font-medium ${tool.isComplete ? 'text-green-600' : 'text-yellow-600'}`}
              >
                {tool.isComplete ? 'Complete' : 'Running'}
              </span>
            </div>

            <div>
              <h3 className={`${typography.label} mb-2`}>Parameters</h3>
              {renderToolParameters(tool.name, tool.args)}
            </div>

            {tool.isComplete && tool.result && (
              <div>
                <h3 className={`${typography.label} mb-2`}>Result</h3>
                <pre
                  className={`bg-gray-50 p-3 ${radius.sm} border border-gray-200 overflow-x-auto ${typography.mono} max-h-96 overflow-y-auto text-gray-800`}
                >
                  {tool.result}
                </pre>
              </div>
            )}
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className={`absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white ${transitions.colors} hover:opacity-100 ${focus.ring} disabled:pointer-events-none`}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
