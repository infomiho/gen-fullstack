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

// Define your models here based on USER'S requirements
// Example: For a task tracker, you might have:
model Task {
  id          Int      @id @default(autoincrement())
  title       String
  description String?
  completed   Boolean  @default(false)
  dueDate     DateTime?
  createdAt   DateTime @default(now())
}

// Example: For a recipe app, you might have:
model Recipe {
  id          Int      @id @default(autoincrement())
  name        String
  ingredients String   // JSON or text
  steps       String
  cookTime    Int      // minutes
  createdAt   DateTime @default(now())
}

// IMPORTANT: Use models that match the user's domain, not these examples
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

// API routes - Create endpoints for YOUR entities (examples below show pattern):

// Example: GET all items
app.get('/api/tasks', async (req, res) => {
  const tasks = await prisma.task.findMany();
  res.json(tasks);
});

// Example: POST create item with validation
app.post('/api/tasks', async (req, res) => {
  const { title, description } = req.body;

  // Validate input (return 400 for bad requests)
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const task = await prisma.task.create({
      data: { title, description, completed: false }
    });
    res.json(task);
  } catch (error: any) {
    // Handle Prisma unique constraint violations (return 409)
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate entry' });
    }
    throw error; // Let Express 5 handle as 500
  }
});

// Example: PUT update item
app.put('/api/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const updated = await prisma.task.update({
    where: { id },
    data: req.body
  });
  res.json(updated);
});

// Example: DELETE item
app.delete('/api/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.task.delete({ where: { id } });
  res.json({ success: true });
});

// IMPORTANT: Adapt these routes to YOUR domain (tasks → plants/recipes/etc.)

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

// Example structure - adapt to YOUR domain
export default function App() {
  const [items, setItems] = useState([]); // tasks, plants, recipes, etc.
  const [formData, setFormData] = useState({}); // fields for your entity

  useEffect(() => {
    fetch('/api/tasks') // Change 'tasks' to your entity
      .then(res => res.json())
      .then(setItems);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    // Refresh list
    fetch('/api/tasks').then(r => r.json()).then(setItems);
  }

  return (
    <div className="container">
      <h1 className="title">Your App Title</h1>

      <form className="form" onSubmit={handleSubmit}>
        {/* Form fields for your entity */}
      </form>

      <div className="items-list">
        {items.map(item => (
          <div key={item.id} className="item-card">
            {/* Display item properties */}
          </div>
        ))}
      </div>
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
.form { background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
.item-card { background: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
.button { padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; }
.button:hover { background: #2563eb; }
/* Add more classes for your specific UI needs */
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
  return `STEP 1: ANALYZE USER REQUIREMENTS
Before writing any code, carefully read the user's prompt and identify:
- What domain/problem are they solving? (e.g., plant watering, task tracking, recipe management)
- What are the core entities/models needed? (e.g., Plant, Task, Recipe - NOT Post/User unless that's what they asked for)
- What operations do users need to perform? (create, read, update, delete, etc.)

DO NOT default to generic examples. Build EXACTLY what the user requested.

STEP 2: IMPLEMENT THE APPLICATION

**DO NOT READ CONFIG FILES** - All setup is complete. Focus only on implementation:

1. **prisma/schema.prisma** - Add models based on USER'S domain:
\`\`\`prisma
// Example for a plant watering app (ADAPT TO USER'S ACTUAL REQUEST):
model Plant {
  id          Int      @id @default(autoincrement())
  name        String
  species     String?
  lastWatered DateTime?
  waterEvery  Int      // days between watering
  notes       String?
  createdAt   DateTime @default(now())
}

// Example for a task tracker (ADAPT TO USER'S ACTUAL REQUEST):
model Task {
  id        Int      @id @default(autoincrement())
  title     String
  completed Boolean  @default(false)
  priority  String?  // "high", "medium", "low"
  dueDate   DateTime?
  createdAt DateTime @default(now())
}
\`\`\`

2. **server/src/index.ts** - Add API endpoints for USER'S entities (keep existing imports/setup):
\`\`\`typescript
// Example for plants API (ADAPT TO USER'S ACTUAL REQUEST):
app.get('/api/plants', async (req, res) => {
  const plants = await prisma.plant.findMany();
  res.json(plants);
});

app.post('/api/plants', async (req, res) => {
  const { name, species, waterEvery } = req.body;
  if (!name || !waterEvery) {
    return res.status(400).json({ error: 'Name and waterEvery are required' });
  }
  const plant = await prisma.plant.create({
    data: { name, species, waterEvery, lastWatered: new Date() }
  });
  res.json(plant);
});

// Add PUT, DELETE, etc. based on user's needs
\`\`\`

3. **client/src/components/** - Create components for USER'S domain:
\`\`\`typescript
// Example: PlantList.tsx (ADAPT TO USER'S ACTUAL REQUEST)
import { useEffect, useState } from 'react';
import './PlantList.css';

export default function PlantList() {
  const [plants, setPlants] = useState([]);
  useEffect(() => {
    fetch('/api/plants').then(r => r.json()).then(setPlants);
  }, []);
  return (
    <div className="plants-section">
      {plants.map(plant => (
        <div key={plant.id} className="plant-card">
          <h3>{plant.name}</h3>
          <p>{plant.species}</p>
        </div>
      ))}
    </div>
  );
}
\`\`\`

4. **client/src/App.tsx & App.css** - Build UI for USER'S requirements (not generic examples).

${IMPORTANT_GUIDELINES}

DO NOT: Read package.json, tsconfig.json, vite.config.ts, index.html, or main.tsx. They're already configured.

CRITICAL: The examples above (Plant, Task) are ONLY to show the pattern. You MUST implement the ACTUAL entities from the user's prompt, not these examples.

${COMPLETION_MESSAGE}`;
}
