/**
 * Simplified Prompt Builder
 *
 * Instead of mode-specific prompt methods, this uses a composable addon system.
 * Each capability adds a small, non-conflicting section to the base prompt.
 */

import type { CapabilityConfig } from '@gen-fullstack/shared';

/**
 * Base system prompt - always included
 * Contains core instructions for full-stack app generation
 */
const BASE_SYSTEM_PROMPT = `You are an expert full-stack TypeScript developer. Your task is to generate complete, working full-stack applications based on user requirements.

ARCHITECTURE:
You are building a monorepo with npm workspaces:
- Root package.json with workspaces: ["client", "server", "prisma"]
- client/ - Vite + React 19 + TypeScript
- server/ - Express 5 + TypeScript with RESTful API
- prisma/ - Prisma ORM + SQLite database

REQUIRED FILES:
1. Root level:
   - package.json (with workspaces, concurrently for dev scripts)
   - .env (DATABASE_URL="file:./prisma/dev.db")

2. client/:
   - package.json (name: "client", type: "module")
   - vite.config.ts (with port 5173, host 0.0.0.0)
   - tsconfig.json (React 19 + strict mode)
   - index.html (entry point)
   - src/main.tsx (render root)
   - src/App.tsx (main component)
   - src/index.css (Tailwind directives)

3. server/:
   - package.json (name: "server", type: "module")
   - tsconfig.json (strict mode, ES modules)
   - src/index.ts (Express app with automatic async error handling)
   - src/routes/ (API route modules)

4. prisma/:
   - schema.prisma (datasource db, generator client, models)

IMPORTANT RULES:
- Generate ALL required files - do not skip any
- Use Express 5 with automatic async error handling (no try-catch in route handlers)
- Use Prisma 6 with proper relations and cascade deletes where appropriate
- Client must use React 19 with proper hooks and modern patterns
- All TypeScript must be strict mode with proper types
- Use Tailwind CSS for styling (already configured)
- API routes should follow RESTful conventions

ANTI-PATTERNS TO AVOID:
- Generic CRUD apps with "items" or "tasks" - make it domain-specific
- Overly complex features - focus on core functionality
- Missing error handling
- Hardcoded data instead of database queries
- Missing form validation

YOUR WORKFLOW:
1. Understand the requirements thoroughly
2. Design the database schema (Prisma models)
3. Plan the API endpoints
4. Implement server routes with proper error handling
5. Create React components with proper state management
6. Generate ALL files required for a working app`;

/**
 * Composable prompt addons
 * Each addon is small, focused, and non-conflicting
 */
const PROMPT_ADDONS = {
  /**
   * Template mode addon
   * Informs LLM that structure is already set up
   */
  template: `
TEMPLATE MODE:
A complete full-stack template has been pre-loaded with all configuration files:
- Root package.json (workspaces + scripts configured)
- client/ (Vite + React 19 + TypeScript + Tailwind configured)
- server/ (Express 5 + TypeScript configured)
- prisma/ (Prisma ORM configured)

CRITICAL - DEPENDENCY MANAGEMENT:
- DO NOT use writeFile for package.json files
- Template dependencies are required and must be preserved
- Use installNpmDep tool to ADD new dependencies without removing existing ones
- Example: installNpmDep({ target: "client", dependencies: { "react-router-dom": "^6.0.0" } })

All tsconfig.json, vite.config.ts files are ready.
Focus on implementing the specific features requested by the user.`,

  /**
   * Planning addon
   * Indicates architectural plan is available as a tool or in context
   */
  planning: `
ARCHITECTURAL PLANNING:
You have access to the planArchitecture tool to create a structured plan before implementation.
Use it to define database schema, API routes, and components before writing code.

If a plan is provided in the user prompt, follow it carefully.`,

  /**
   * Building blocks addon
   * Minimal description - integration guide shown AFTER tool call
   */
  buildingBlocks: `
BUILDING BLOCKS:
Pre-built production-ready components are available via the requestBlock tool.

Available blocks:
- auth-password: Username/password authentication with bcrypt + sessions

To use: Call requestBlock({ blockId: "auth-password", reason: "why you need it" })
The tool will return files and an integration guide.`,

  /**
   * Compiler checks addon
   * Informs LLM that validation tools are available
   */
  compilerChecks: `
VALIDATION TOOLS:
You have access to validation tools to check your code:
- validatePrismaSchema: Check Prisma schema for errors
- validateTypeScript: Run TypeScript compiler on client/server

Use these tools as you work to catch and fix errors early.
The tools will return detailed error messages if issues are found.`,
} as const;

/**
 * Build complete system prompt by composing base + enabled addons
 */
export function buildSystemPrompt(config: CapabilityConfig): string {
  const sections: string[] = [BASE_SYSTEM_PROMPT];

  // Add addons based on configuration
  if (config.inputMode === 'template') {
    sections.push(PROMPT_ADDONS.template);
  }

  if (config.planning) {
    sections.push(PROMPT_ADDONS.planning);
  }

  if (config.buildingBlocks) {
    sections.push(PROMPT_ADDONS.buildingBlocks);
  }

  if (config.compilerChecks) {
    sections.push(PROMPT_ADDONS.compilerChecks);
  }

  return sections.join('\n');
}

/**
 * Build user prompt from context
 */
export function buildUserPrompt(userRequirements: string, architecturalPlan?: string): string {
  const sections: string[] = [];

  if (architecturalPlan) {
    sections.push(`ARCHITECTURAL PLAN:\n${architecturalPlan}`);
  }

  sections.push(`USER REQUIREMENTS:\n${userRequirements}`);

  return sections.join('\n\n');
}

/**
 * Integration guides for building blocks
 * Returned by requestBlock tool, not included in initial prompt
 */
export const BLOCK_INTEGRATION_GUIDES = {
  'auth-password': `INTEGRATION GUIDE: auth-password

FILES COPIED:
- server/src/middleware/auth.ts (requireAuth middleware)
- server/src/routes/auth.routes.ts (register, login, logout, me endpoints)
- client/src/components/auth/ (AuthProvider, LoginForm, RegisterForm)
- client/src/hooks/useAuth.ts (React hook for auth state)

DEPENDENCIES TO ADD:
Server: bcryptjs, @types/bcryptjs
Client: None (uses fetch)

INTEGRATION STEPS:

1. MERGE PRISMA MODELS:
   Add to your prisma/schema.prisma:

   model User {
     id        String   @id @default(cuid())
     username  String   @unique
     password  String
     createdAt DateTime @default(now())
     sessions  Session[]
   }

   model Session {
     id        String   @id @default(cuid())
     userId    String
     token     String   @unique
     expiresAt DateTime
     createdAt DateTime @default(now())
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
   }

2. MOUNT SERVER ROUTES:
   In server/src/index.ts:

   import authRoutes from './routes/auth.routes.js';
   app.use('/api/auth', authRoutes);

3. WRAP CLIENT WITH PROVIDER:
   In client/src/App.tsx:

   import { AuthProvider } from './components/auth/AuthProvider';

   function App() {
     return (
       <AuthProvider>
         {/* your app content */}
       </AuthProvider>
     );
   }

4. USE IN COMPONENTS:
   import { useAuth } from './hooks/useAuth';

   function MyComponent() {
     const { user, login, logout } = useAuth();
     // ... use auth state
   }

5. PROTECT SERVER ROUTES:
   import { requireAuth } from './middleware/auth.js';

   router.get('/protected', requireAuth, async (req, res) => {
     // req.userId is available
   });

IMPORTANT:
- Run "npx prisma generate" after merging models
- Add bcryptjs to server/package.json dependencies
- Session tokens expire after 30 days
- Passwords are hashed with bcrypt (10 rounds)`,
} as const;
