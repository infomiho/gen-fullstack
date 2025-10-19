/**
 * Shared prompt snippets for strategy implementations
 *
 * This file contains reusable text blocks that are common across
 * multiple generation strategies (naive, plan-first, etc.)
 */

import { formatVersionsForPrompt } from './versions.js';

/**
 * Architecture overview for full-stack monorepo
 */
export const ARCHITECTURE_DESCRIPTION = `ARCHITECTURE:
You MUST create a monorepo structure with three components:

1. **Client** (Vite + React + TypeScript)
   - Modern React 19 with TypeScript
   - Vite for fast development
   - API calls to Express server

2. **Server** (Express 5 + TypeScript)
   - Express 5 with automatic async error handling
   - RESTful API endpoints
   - CORS enabled for client communication
   - Prisma Client for database access

3. **Database** (Prisma + SQLite)
   - Prisma ORM for type-safe database access
   - SQLite for simplicity (no Docker/Postgres needed)
   - Schema defined in prisma/schema.prisma`;

/**
 * Required file structure for full-stack monorepo
 */
export const FILE_STRUCTURE = `REQUIRED FILE STRUCTURE:
\`\`\`
/
├── package.json          (root with workspaces and concurrently)
├── .env                  (DATABASE_URL)
├── client/
│   ├── package.json
│   ├── vite.config.ts    (with proxy to /api)
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       └── ... (components, hooks, etc.)
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts      (Express server with API routes)
└── prisma/
    └── schema.prisma     (database models)
\`\`\``;

/**
 * Root package.json configuration
 */
export const ROOT_PACKAGE_JSON = `1. **Root package.json** - Create workspace configuration:
\`\`\`json
{
  "name": "app-name",
  "private": true,
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "concurrently \\"npm:dev:*\\"",
    "dev:server": "npm -w server run dev",
    "dev:client": "npm -w client run dev -- --host 0.0.0.0 --port 5173",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev"
  },
  "devDependencies": {
    "concurrently": "^9.2.1",
    "prisma": "^6.10.0"
  }
}
\`\`\``;

/**
 * Environment file configuration
 */
export const ENV_FILE = `2. **.env file** - Database connection:
\`\`\`
DATABASE_URL="file:./dev.db"
\`\`\``;

/**
 * Prisma schema example
 */
export const PRISMA_SCHEMA = `3. **prisma/schema.prisma** - Define your data models:
\`\`\`prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// Define your models here based on requirements
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  // ... add fields based on requirements
}
\`\`\``;

/**
 * Server package.json
 */
export const SERVER_PACKAGE_JSON = `4. **server/package.json**:
\`\`\`json
{
  "name": "server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.10.0",
    "express": "^5.1.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "~5.9.3"
  }
}
\`\`\``;

/**
 * Express server example with error handling
 */
export const EXPRESS_SERVER_EXAMPLE = `5. **server/src/index.ts** - Express 5 server with error handling:
\`\`\`typescript
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// API routes - Express 5 handles async errors, but handle specific cases:
app.get('/api/users', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const { email, name } = req.body;

  // Validate input (return 400 for bad requests)
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await prisma.user.create({ data: { email, name } });
    res.json(user);
  } catch (error: any) {
    // Handle Prisma unique constraint violations (return 409)
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw error; // Let Express 5 handle as 500
  }
});

// Add more routes...

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
\`\`\``;

/**
 * Client package.json
 */
export const CLIENT_PACKAGE_JSON = `6. **client/package.json**:
\`\`\`json
{
  "name": "client",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^5.0.4",
    "typescript": "~5.9.3",
    "vite": "^7.1.9"
  }
}
\`\`\``;

/**
 * Vite configuration
 */
export const VITE_CONFIG = `7. **client/vite.config.ts** - Proxy API requests:
\`\`\`typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
});
\`\`\``;

/**
 * Client App.tsx and CSS example
 */
export const CLIENT_APP_EXAMPLE = `8. **client/src/App.tsx** - Make API calls with CSS styling:
\`\`\`typescript
import { useEffect, useState } from 'react';
import './App.css';

export default function App() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <div className="container">
      <h1 className="title">{/* Your title here */}</h1>
      {/* Use CSS classes for all styling */}
    </div>
  );
}
\`\`\`

9. **client/src/App.css** - Professional styling:
\`\`\`css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #1f2937;
  background: #f9fafb;
}

.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
.title { font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; color: #111827; }
/* Add more classes for buttons, cards, forms, etc. */
\`\`\`

**STYLING**: Use CSS classes (not inline styles), include proper spacing/colors/typography, style interactive elements with hover states.`;

/**
 * Important guidelines shared across strategies
 */
export const IMPORTANT_GUIDELINES = `IMPORTANT GUIDELINES:
- DO NOT run npm install or prisma migrate (run automatically)
- Write complete file contents (no placeholders or "..." in code)
- Use proper TypeScript types everywhere
- All API calls from client go to /api/* (proxied to Express)
- **The app MUST be styled** - Use modern CSS with proper spacing, colors, and layout

ERROR HANDLING:
Express 5 auto-catches async errors, but handle specific cases:
- Validate input: return 400 for missing/invalid data
- Prisma errors: catch P2002 (unique constraint) → 409, P2003 (foreign key) → 404
- Let Express 5 handle unexpected errors as 500

${formatVersionsForPrompt()}`;

/**
 * Shared implementation steps for naive and plan-first strategies
 */
const IMPLEMENTATION_STEPS = `${ROOT_PACKAGE_JSON}

${ENV_FILE}

${PRISMA_SCHEMA}

${SERVER_PACKAGE_JSON}

${EXPRESS_SERVER_EXAMPLE}

${CLIENT_PACKAGE_JSON}

${VITE_CONFIG}

${CLIENT_APP_EXAMPLE}

${IMPORTANT_GUIDELINES}`;

/**
 * Shared completion message
 */
const COMPLETION_MESSAGE = `COMPLETION MESSAGE:
When done, respond with a BRIEF 1-2 sentence confirmation. DO NOT list files or contents.`;

/**
 * Full implementation guide for naive strategy
 */
export function getNaiveImplementationSteps(): string {
  return `STEP-BY-STEP IMPLEMENTATION:

${IMPLEMENTATION_STEPS}

Now, generate the complete full-stack application based on the user's requirements. Create ALL required files in the correct structure.

${COMPLETION_MESSAGE}`;
}

/**
 * Implementation guidelines for plan-first strategy
 */
export function getPlanFirstImplementationGuidelines(): string {
  return `**FOLLOW THE ARCHITECTURAL PLAN**: Use the plan's database schema, API endpoints, and component structure, but follow the concrete examples below for exact file structure and configuration.

STEP-BY-STEP IMPLEMENTATION:

${IMPLEMENTATION_STEPS}

Now, implement the full-stack application following the architectural plan. Create ALL required files using the exact versions and patterns above.

${COMPLETION_MESSAGE}`;
}

/**
 * Implementation guidelines for template-based strategy
 */
export function getTemplateImplementationGuidelines(): string {
  return `TEMPLATE CUSTOMIZATION GUIDELINES:

The template is ready with User CRUD, Express routes, and styled React UI. Extend it based on requirements:

1. **Prisma schema** - Add models, keep generator/datasource blocks:
\`\`\`prisma
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
\`\`\`

2. **Express routes** - Add endpoints, keep existing setup:
\`\`\`typescript
app.get('/api/posts', async (req, res) => {
  const posts = await prisma.post.findMany({ include: { user: true } });
  res.json(posts);
});

app.post('/api/posts', async (req, res) => {
  const { title, content, userId } = req.body;
  if (!title || !content || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const post = await prisma.post.create({ data: { title, content, userId } });
    res.json(post);
  } catch (error: any) {
    if (error.code === 'P2003') {
      return res.status(404).json({ error: 'User not found' });
    }
    throw error;
  }
});
\`\`\`

3. **React components** - Create components with CSS, keep Vite config:
\`\`\`typescript
// client/src/components/PostList.tsx
import { useEffect, useState } from 'react';
import './PostList.css';

export default function PostList() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetch('/api/posts').then(res => res.json()).then(setPosts);
  }, []);

  return (
    <div className="posts-section">
      {posts.map(post => (
        <div key={post.id} className="post-card">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
        </div>
      ))}
    </div>
  );
}
\`\`\`

4. **Adding packages** - Only if needed, add to correct package.json (server/client) with caret ranges (^).

${IMPORTANT_GUIDELINES}

STRATEGY: Extend template, don't replace. Focus on YOUR features, not boilerplate.

${COMPLETION_MESSAGE}`;
}
