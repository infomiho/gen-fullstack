import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SessionFilters, type SessionFiltersState } from './SessionFilters';

const meta = {
  title: 'Components/SessionFilters',
  component: SessionFilters,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SessionFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state (no filters active)
 */
export const Default: Story = {
  args: {
    filters: {
      search: '',
      status: 'all',
      capabilities: {
        template: false,
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
      },
    },
    onFiltersChange: () => {},
    sessionCount: 39,
    totalCount: 39,
  },
};

/**
 * With search query
 */
export const WithSearch: Story = {
  args: {
    filters: {
      search: 'sheep management',
      status: 'all',
      capabilities: {
        template: false,
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
      },
    },
    onFiltersChange: () => {},
    sessionCount: 4,
    totalCount: 39,
  },
};

/**
 * Status filter active (completed only)
 */
export const FilteredByStatus: Story = {
  args: {
    filters: {
      search: '',
      status: 'completed',
      capabilities: {
        template: false,
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
      },
    },
    onFiltersChange: () => {},
    sessionCount: 32,
    totalCount: 39,
  },
};

/**
 * Template filter active
 */
export const FilteredByTemplate: Story = {
  args: {
    filters: {
      search: '',
      status: 'all',
      capabilities: {
        template: true,
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
      },
    },
    onFiltersChange: () => {},
    sessionCount: 12,
    totalCount: 39,
  },
};

/**
 * Capability filters active
 */
export const FilteredByCapabilities: Story = {
  args: {
    filters: {
      search: '',
      status: 'all',
      capabilities: {
        template: false,
        planning: true,
        compilerChecks: true,
        buildingBlocks: false,
      },
    },
    onFiltersChange: () => {},
    sessionCount: 8,
    totalCount: 39,
  },
};

/**
 * Multiple filters active
 */
export const MultipleFiltersActive: Story = {
  args: {
    filters: {
      search: 'app',
      status: 'completed',
      capabilities: {
        template: true,
        planning: true,
        compilerChecks: false,
        buildingBlocks: false,
      },
    },
    onFiltersChange: () => {},
    sessionCount: 3,
    totalCount: 39,
  },
};

/**
 * No results
 */
export const NoResults: Story = {
  args: {
    filters: {
      search: 'nonexistent query xyz',
      status: 'all',
      capabilities: {
        template: false,
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
      },
    },
    onFiltersChange: () => {},
    sessionCount: 0,
    totalCount: 39,
  },
};

/**
 * Interactive example with state management
 */
export const Interactive: Story = {
  render: () => {
    const [filters, setFilters] = useState<SessionFiltersState>({
      search: '',
      status: 'all',
      capabilities: {
        template: false,
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
      },
    });

    return (
      <SessionFilters
        filters={filters}
        onFiltersChange={setFilters}
        sessionCount={15}
        totalCount={39}
      />
    );
  },
  args: {
    filters: {
      search: '',
      status: 'all',
      capabilities: {
        template: false,
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
      },
    },
    onFiltersChange: () => {},
    sessionCount: 39,
    totalCount: 39,
  },
};
