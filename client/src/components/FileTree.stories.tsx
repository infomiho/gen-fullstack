import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileTree } from './FileTree';

/**
 * FileTree displays a hierarchical tree view of generated files.
 * Files are organized by directory structure with expandable folders.
 */
const meta: Meta<typeof FileTree> = {
  title: 'UI/Editor/FileTree',
  component: FileTree,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    selectedFile: {
      control: 'text',
      description: 'Path of the currently selected file',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FileTree>;

const sampleFiles = [
  { path: 'package.json', content: '{}' },
  { path: 'src/App.tsx', content: 'export default function App() {}' },
  { path: 'src/index.tsx', content: 'import App from "./App"' },
  { path: 'src/components/Button.tsx', content: 'export function Button() {}' },
  { path: 'src/components/Header.tsx', content: 'export function Header() {}' },
  { path: 'src/lib/utils.ts', content: 'export const cn = () => {}' },
  { path: 'README.md', content: '# My App' },
  { path: 'tsconfig.json', content: '{}' },
];

/**
 * Default file tree with typical React project structure
 */
export const Default: Story = {
  args: {
    files: sampleFiles,
    selectedFile: null,
    onSelectFile: (_path: string) => {},
  },
};

/**
 * File tree with a selected file highlighted
 */
export const WithSelection: Story = {
  args: {
    files: sampleFiles,
    selectedFile: 'src/App.tsx',
    onSelectFile: (_path: string) => {},
  },
};

/**
 * Empty file tree - no files generated yet
 */
export const Empty: Story = {
  args: {
    files: [],
    selectedFile: null,
    onSelectFile: (_path: string) => {},
  },
};

/**
 * Single file project
 */
export const SingleFile: Story = {
  args: {
    files: [{ path: 'index.html', content: '<!DOCTYPE html>' }],
    selectedFile: null,
    onSelectFile: (_path: string) => {},
  },
};

/**
 * Deep nested structure
 */
export const DeepNesting: Story = {
  args: {
    files: [
      { path: 'src/features/auth/components/LoginForm.tsx', content: '' },
      { path: 'src/features/auth/components/SignupForm.tsx', content: '' },
      { path: 'src/features/auth/hooks/useAuth.ts', content: '' },
      { path: 'src/features/dashboard/components/DashboardLayout.tsx', content: '' },
      { path: 'src/features/dashboard/components/Widget.tsx', content: '' },
      { path: 'src/shared/components/Button.tsx', content: '' },
      { path: 'src/shared/utils/cn.ts', content: '' },
    ],
    selectedFile: 'src/features/auth/components/LoginForm.tsx',
    onSelectFile: (_path: string) => {},
  },
};
