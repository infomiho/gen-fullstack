import type { Meta, StoryObj } from '@storybook/react-vite';
import { PipelineStageItem } from './PipelineStageItem';
import type { PipelineStageEvent } from '@gen-fullstack/shared';
import { useState } from 'react';

const meta = {
  title: 'Timeline/PipelineStageItem',
  component: PipelineStageItem,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PipelineStageItem>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper to handle modal state
function StageItemWrapper(props: { stage: PipelineStageEvent }) {
  const [isOpen, setIsOpen] = useState(false);
  return <PipelineStageItem stage={props.stage} isOpen={isOpen} onOpenChange={setIsOpen} />;
}

const baseMockStage: PipelineStageEvent = {
  id: 'stage-1',
  type: 'planning',
  status: 'completed',
  timestamp: Date.now(),
};

export const PlanningCompleted: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'planning',
      status: 'completed',
      data: {
        plan: {
          databaseModels: [
            { name: 'User', fields: ['id', 'name', 'email'] },
            { name: 'Post', fields: ['id', 'title', 'content', 'userId'] },
          ],
          apiRoutes: [
            { method: 'GET', path: '/api/users', description: 'Get all users' },
            { method: 'POST', path: '/api/posts', description: 'Create a post' },
          ],
          clientComponents: [
            { name: 'UserList', purpose: 'Display list of users' },
            { name: 'PostEditor', purpose: 'Create and edit posts' },
          ],
        },
      },
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const CodeGenerationStarted: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'code_generation',
      status: 'started',
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const CodeGenerationCompleted: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'code_generation',
      status: 'completed',
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const ValidationWithErrors: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'validation',
      status: 'completed',
      data: {
        iteration: 1,
        maxIterations: 3,
        validationErrors: [
          {
            type: 'typescript',
            file: 'src/components/UserList.tsx',
            message: "Property 'name' does not exist on type 'User'",
            line: 15,
            code: 'TS2339',
          },
          {
            type: 'prisma',
            file: 'prisma/schema.prisma',
            message: 'Relation field `posts` must specify the `references` argument',
            line: 8,
          },
        ],
      },
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const ValidationNoErrors: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'validation',
      status: 'completed',
      data: {
        iteration: 1,
        maxIterations: 3,
        validationErrors: [],
      },
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const ErrorFixingStarted: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'error_fixing',
      status: 'started',
      data: {
        iteration: 1,
        maxIterations: 3,
        errorCount: 5,
      },
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const ErrorFixingSecondAttempt: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'error_fixing',
      status: 'started',
      data: {
        iteration: 2,
        maxIterations: 3,
        errorCount: 3,
      },
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const ErrorFixingCompleted: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'error_fixing',
      status: 'completed',
      data: {
        iteration: 1,
        maxIterations: 3,
        errorCount: 5,
      },
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const TemplateLoadingCompleted: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'template_loading',
      status: 'completed',
      data: {
        templateName: 'fullstack-monorepo',
      },
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const CompletingWithSummary: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'completing',
      status: 'completed',
      data: {
        summary: 'Successfully generated a full-stack todo app with authentication and database.',
      },
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const FailedStage: Story = {
  args: {
    stage: {
      ...baseMockStage,
      type: 'code_generation',
      status: 'failed',
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => <StageItemWrapper stage={args.stage} />,
};

export const AllStages: Story = {
  args: {
    stage: baseMockStage,
    isOpen: false,
    onOpenChange: () => {},
  },
  render: () => (
    <div className="space-y-2">
      <StageItemWrapper
        stage={{
          ...baseMockStage,
          id: 'stage-1',
          type: 'planning',
          status: 'completed',
          data: {
            plan: {
              databaseModels: [{ name: 'User', fields: ['id', 'name'] }],
              apiRoutes: [{ method: 'GET', path: '/api/users', description: 'Get users' }],
              clientComponents: [{ name: 'UserList', purpose: 'Display users' }],
            },
          },
        }}
      />
      <StageItemWrapper
        stage={{
          ...baseMockStage,
          id: 'stage-2',
          type: 'code_generation',
          status: 'completed',
        }}
      />
      <StageItemWrapper
        stage={{
          ...baseMockStage,
          id: 'stage-3',
          type: 'validation',
          status: 'completed',
          data: {
            iteration: 1,
            maxIterations: 3,
            validationErrors: [],
          },
        }}
      />
      <StageItemWrapper
        stage={{
          ...baseMockStage,
          id: 'stage-4',
          type: 'error_fixing',
          status: 'started',
          data: {
            iteration: 1,
            maxIterations: 3,
            errorCount: 3,
          },
        }}
      />
      <StageItemWrapper
        stage={{
          ...baseMockStage,
          id: 'stage-5',
          type: 'completing',
          status: 'completed',
        }}
      />
    </div>
  ),
};
