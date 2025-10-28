import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownMessage } from './MarkdownMessage';

const meta = {
  title: 'Timeline/MarkdownMessage',
  component: MarkdownMessage,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    content: {
      control: 'text',
      description: 'Markdown content to render',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof MarkdownMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainText: Story = {
  args: {
    content: 'This is a simple paragraph of text without any markdown formatting.',
  },
};

export const WithHeadings: Story = {
  args: {
    content: `# Main Title

This is some text under the main title.

## Subtitle

More content here with a subtitle.

### Section Header

Even more nested content.`,
  },
};

export const WithFormatting: Story = {
  args: {
    content: `This paragraph contains **bold text**, *italic text*, and \`inline code\`.

You can also combine them: ***bold and italic*** or **bold with \`code\`**.`,
  },
};

export const WithCodeBlocks: Story = {
  args: {
    content: `Here's some code:

\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

And here's some more:

\`\`\`typescript
interface User {
  name: string;
  age: number;
}
\`\`\``,
  },
};

export const WithLists: Story = {
  args: {
    content: `Unordered list:
- First item
- Second item
- Third item

Ordered list:
1. First step
2. Second step
3. Third step

Nested list:
- Parent item
  - Nested item 1
  - Nested item 2
- Another parent`,
  },
};

export const WithLinks: Story = {
  args: {
    content: `Check out these links:

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MDN Web Docs](https://developer.mozilla.org)`,
  },
};

export const WithBlockquote: Story = {
  args: {
    content: `Someone once said:

> This is a very important quote that spans multiple lines
> and provides valuable wisdom.

And here's another:

> Short quote.`,
  },
};

export const WithHorizontalRule: Story = {
  args: {
    content: `Content above

---

Content below`,
  },
};

export const ComplexExample: Story = {
  args: {
    content: `# Project Setup

Follow these steps to get started:

## Installation

First, install the dependencies:

\`\`\`bash
npm install
\`\`\`

## Configuration

Update your \`config.json\` file:

\`\`\`json
{
  "apiKey": "your-api-key",
  "environment": "production"
}
\`\`\`

## Important Notes

> **Warning**: Make sure to keep your API keys secure!

For more information, check out:
- [Documentation](https://docs.example.com)
- [GitHub Repository](https://github.com/example/repo)

---

Happy coding!`,
  },
};

export const LLMResponse: Story = {
  args: {
    content: `I'll help you create a React component. Here's what I suggest:

**Component Structure:**
- Use functional components with hooks
- Implement proper TypeScript types
- Add error boundaries for safety

**Code Example:**

\`\`\`typescript
interface Props {
  title: string;
  onSubmit: (value: string) => void;
}

export function MyComponent({ title, onSubmit }: Props) {
  const [value, setValue] = useState('');

  return (
    <div>
      <h2>{title}</h2>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button onClick={() => onSubmit(value)}>
        Submit
      </button>
    </div>
  );
}
\`\`\`

This component:
1. Accepts a title and callback
2. Manages internal state
3. Calls the callback when submitted

Let me know if you need any adjustments!`,
  },
};

export const ErrorMessage: Story = {
  args: {
    content: `**Error**: Failed to compile the application.

\`\`\`
Error: Cannot find module 'react'
  at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1048:15)
  at Function.Module._load (node:internal/modules/cjs/loader:901:27)
\`\`\`

**Solution:**
Run \`npm install react\` to fix this issue.`,
  },
};

export const EmptyContent: Story = {
  args: {
    content: '',
  },
};

export const WithCustomClass: Story = {
  args: {
    content: 'This message has a custom background color.',
    className: 'bg-blue-50 p-4 rounded',
  },
};
