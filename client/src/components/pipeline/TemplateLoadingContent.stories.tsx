import type { Meta, StoryObj } from '@storybook/react-vite';
import { TemplateLoadingContent } from './TemplateLoadingContent';

const meta = {
  title: 'Pipeline/TemplateLoadingContent',
  component: TemplateLoadingContent,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TemplateLoadingContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTemplateName: Story = {
  args: {
    templateName: 'fullstack-monorepo',
  },
};

export const WithoutTemplateName: Story = {
  args: {
    templateName: undefined,
  },
};
