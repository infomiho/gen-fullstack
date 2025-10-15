/**
 * ResizableLayout - Three-panel resizable layout using react-resizable-panels
 *
 * Provides resizable sidebar, middle panel, and optional right panel
 * Follows Bolt.new's split-pane architecture
 */

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { ReactNode } from 'react';

interface ResizableLayoutProps {
  sidebar: ReactNode;
  middle: ReactNode;
  right?: ReactNode;
}

export function ResizableLayout({ sidebar, middle, right }: ResizableLayoutProps) {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      {/* Sidebar panel */}
      <Panel defaultSize={20} minSize={15} maxSize={30}>
        {sidebar}
      </Panel>

      {/* Resize handle */}
      <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors cursor-col-resize" />

      {/* Middle panel */}
      <Panel defaultSize={right ? 40 : 80} minSize={30}>
        {middle}
      </Panel>

      {/* Optional right panel with resize handle */}
      {right && (
        <>
          <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors cursor-col-resize" />
          <Panel defaultSize={40} minSize={30}>
            {right}
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}
