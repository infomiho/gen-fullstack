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
 * Client App.tsx example
 */
export const CLIENT_APP_EXAMPLE = `8. **client/src/App.tsx** - Make API calls with styled UI:
\`\`\`typescript
import { useEffect, useState } from 'react';
import './App.css'; // Import CSS file

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

9. **client/src/App.css** - Professional styling with CSS:
\`\`\`css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #1f2937;
  background: #f9fafb;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: #111827;
}

/* Add more classes for buttons, cards, forms, etc. */
\`\`\`

**STYLING REQUIREMENTS:**
- **Create a CSS file** (e.g., App.css) and import it in your component
- Use CSS classes, NOT inline styles
- Include proper spacing (padding, margins), colors, typography
- Add visual hierarchy with font sizes, weights, and colors
- Use borders, shadows, or backgrounds to separate sections
- Style interactive elements (buttons, links, inputs) with hover states
- Ensure good contrast and readability
- Add a CSS reset or normalize at the top of the file`;

/**
 * Important guidelines shared across strategies
 */
export const IMPORTANT_GUIDELINES = `IMPORTANT GUIDELINES:
- DO NOT run npm install - dependencies install automatically
- DO NOT run prisma migrate - migrations run automatically
- Write complete file contents (no placeholders or "..." in code)
- Use proper TypeScript types everywhere
- All API calls from client go to /api/* (proxied to Express)
- Keep database models simple but functional
- **The app MUST be styled** - Use modern CSS, proper spacing, colors, and layout
- Make the UI visually appealing with professional design

ERROR HANDLING:
Express 5 automatically catches async errors, but you MUST handle specific cases:
- Validate input: return 400 for missing/invalid data
- Prisma errors: catch P2002 (unique constraint) and return 409
- Not found: return 404 for missing resources
- Let Express 5 handle unexpected errors as 500
Example: See server/src/index.ts POST /api/users above

${formatVersionsForPrompt()}`;

/**
 * Full implementation guide for naive strategy
 */
export function getNaiveImplementationSteps(): string {
  return `STEP-BY-STEP IMPLEMENTATION:

${ROOT_PACKAGE_JSON}

${ENV_FILE}

${PRISMA_SCHEMA}

${SERVER_PACKAGE_JSON}

${EXPRESS_SERVER_EXAMPLE}

${CLIENT_PACKAGE_JSON}

${VITE_CONFIG}

${CLIENT_APP_EXAMPLE}

${IMPORTANT_GUIDELINES}

Now, generate the complete full-stack application based on the user's requirements. Create ALL required files in the correct structure.`;
}

/**
 * Implementation guidelines for plan-first strategy
 */
export function getPlanFirstImplementationGuidelines(): string {
  return `IMPLEMENTATION GUIDELINES:

1. **Follow the architectural plan systematically**
   - Implement in the order specified in the plan
   - Use the database schema design from the plan
   - Implement the API endpoints as planned
   - Create components as outlined in the plan

${ROOT_PACKAGE_JSON}

${PRISMA_SCHEMA}

4. **Express server** (server/src/index.ts) - implement routes from plan:
\`\`\`typescript
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Implement API endpoints as designed in the plan
// Express 5 handles async errors, but handle specific cases:
// - Validate input (400), handle unique constraints (409), not found (404)
// Example:
app.post('/api/example', async (req, res) => {
  if (!req.body.required) {
    return res.status(400).json({ error: 'Required field missing' });
  }
  try {
    const result = await prisma.model.create({ data: req.body });
    res.json(result);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Already exists' });
    }
    throw error;
  }
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
\`\`\`

${VITE_CONFIG}

6. **Client components** - implement as designed in plan:
   - Use fetch('/api/...') for all API calls
   - Implement state management as planned
   - Create component hierarchy as outlined
   - **Apply professional styling** - Use modern CSS with proper spacing, colors, typography
   - Make the UI visually appealing with good layout and design hierarchy

${IMPORTANT_GUIDELINES}

Now, implement the complete full-stack application following the architectural plan. Create ALL required files in the correct structure.`;
}
