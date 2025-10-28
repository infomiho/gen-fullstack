/**
 * Prompt Builder Tests
 *
 * Tests for the composable prompt system that replaces mode-specific prompts
 * with a base + addons approach.
 *
 * NOTE: These tests focus on composition logic (which addons are included)
 * rather than exact prompt content, to avoid brittleness.
 */

import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '../prompt-builder.js';
import type { ArchitecturePlan } from '@gen-fullstack/shared';

describe('Prompt Builder', () => {
  describe('buildSystemPrompt', () => {
    it("should include base prompt only for inputMode: 'naive' without addons", () => {
      const prompt = buildSystemPrompt({
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      // Should have substantial base content
      expect(prompt.length).toBeGreaterThan(500);

      // Should NOT include any addon sections
      expect(prompt).not.toContain('TEMPLATE INPUT MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('BUILDING BLOCKS:');
      expect(prompt).not.toContain('VALIDATION TOOLS:');
    });

    it("should include template addon for inputMode: 'template'", () => {
      const prompt = buildSystemPrompt({
        inputMode: 'template',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      expect(prompt).toContain('TEMPLATE INPUT MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('BUILDING BLOCKS:');
      expect(prompt).not.toContain('VALIDATION TOOLS:');
    });

    it('should NOT include planning addon when enabled (Phase B - separate stage)', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'naive',
        planning: true,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      // Planning is now a separate pipeline stage, not an addon
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('TEMPLATE INPUT MODE:');
      expect(prompt).not.toContain('BUILDING BLOCKS:');
      expect(prompt).not.toContain('VALIDATION TOOLS:');
    });

    it('should include building blocks addon when enabled', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: true,
        maxIterations: 3,
      });

      expect(prompt).toContain('BUILDING BLOCKS:');
      expect(prompt).not.toContain('TEMPLATE INPUT MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('VALIDATION TOOLS:');
    });

    it('should NOT include compiler checks addon when enabled (Phase B - separate stage)', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'naive',
        planning: false,
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 3,
      });

      // Validation is now a separate pipeline stage, not an addon
      expect(prompt).not.toContain('VALIDATION TOOLS:');
      expect(prompt).not.toContain('TEMPLATE INPUT MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('BUILDING BLOCKS:');
    });

    it('should compose multiple addons correctly (Phase B - only active addons)', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'template',
        planning: true,
        compilerChecks: true,
        buildingBlocks: true,
        maxIterations: 3,
      });

      // Should include active addons (template, buildingBlocks)
      // Planning and compilerChecks are now separate pipeline stages
      expect(prompt).toContain('TEMPLATE INPUT MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:'); // Separate stage
      expect(prompt).toContain('BUILDING BLOCKS:');
      expect(prompt).not.toContain('VALIDATION TOOLS:'); // Separate stage
    });

    it('should maintain correct addon order', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'template',
        planning: true,
        compilerChecks: true,
        buildingBlocks: true,
        maxIterations: 3,
      });

      // Get positions of active addons (Phase B)
      const templatePos = prompt.indexOf('TEMPLATE INPUT MODE:');
      const blocksPos = prompt.indexOf('BUILDING BLOCKS:');

      // Verify order: base → template → blocks (planning/validation are separate stages)
      expect(templatePos).toBeGreaterThan(0);
      expect(blocksPos).toBeGreaterThan(templatePos);
    });

    it('should generate longer prompts with more addons', () => {
      const basePrompt = buildSystemPrompt({
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      const fullPrompt = buildSystemPrompt({
        inputMode: 'template',
        planning: true,
        compilerChecks: true,
        buildingBlocks: true,
        maxIterations: 3,
      });

      // Full prompt should be significantly longer
      expect(fullPrompt.length).toBeGreaterThan(basePrompt.length + 500);
    });

    /**
     * Critical Content Validation Tests
     *
     * These tests validate the actual content of critical prompt sections to prevent
     * regressions in business-critical instructions (e.g., tsx requirement, dependency
     * management workflow). Unlike composition tests above, these verify specific
     * instructions are present and correct.
     *
     * Rationale: These instructions directly affect generated app functionality and
     * should not be accidentally removed or modified without failing tests.
     */
    describe('Critical Content', () => {
      it('should explicitly require tsx in base prompt', () => {
        const prompt = buildSystemPrompt({
          inputMode: 'naive',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });

        // Verify tsx is mentioned and required
        expect(prompt).toContain('tsx');
        expect(prompt).toContain('SERVER DEV SCRIPT:');
        expect(prompt).toContain('NEVER use ts-node-dev');
        expect(prompt).toContain('"dev": "PORT=3000 tsx watch src/index.ts"');

        // Verify the anti-pattern is documented
        expect(prompt).toContain("doesn't work with");
        expect(prompt).toContain('"type": "module"');
      });

      it("should NOT include dependency check workflow with inputMode: 'naive'", () => {
        const naivePrompt = buildSystemPrompt({
          inputMode: 'naive',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });

        // inputMode: 'naive' should NOT tell LLM to read existing package.json
        // (files don't exist yet with naive input mode)
        expect(naivePrompt).not.toContain('BEFORE adding ANY dependencies');
        expect(naivePrompt).not.toContain('readFile to check client/package.json');
        expect(naivePrompt).not.toContain('readFile to check server/package.json');
        expect(naivePrompt).not.toContain('Identify which packages are ALREADY installed');
      });

      it("should include dependency check workflow with inputMode: 'template'", () => {
        const templatePrompt = buildSystemPrompt({
          inputMode: 'template',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });

        // inputMode: 'template' SHOULD tell LLM to read existing package.json
        // (template files already exist)
        expect(templatePrompt).toContain('BEFORE adding ANY dependencies');
        expect(templatePrompt).toContain('readFile to check client/package.json');
        expect(templatePrompt).toContain('readFile to check server/package.json');
        expect(templatePrompt).toContain('Identify which packages are ALREADY installed');
      });

      it('should include writeFile instructions for package.json in base prompt', () => {
        const prompt = buildSystemPrompt({
          inputMode: 'naive',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });

        // inputMode: 'naive' should instruct to write complete package.json files
        expect(prompt).toContain('Write complete package.json files');
        expect(prompt).toContain('ALL dependencies included');
        expect(prompt).toContain('Use writeFile to create package.json');

        // inputMode: 'naive' should NOT mention installNpmDep (not available)
        expect(prompt).not.toContain('installNpmDep');
      });

      it("should include installNpmDep instructions only with inputMode: 'template'", () => {
        const templatePrompt = buildSystemPrompt({
          inputMode: 'template',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });

        // inputMode: 'template' SHOULD mention installNpmDep
        expect(templatePrompt).toContain('installNpmDep');
        expect(templatePrompt).toContain('Use installNpmDep tool to ADD new dependencies');
        expect(templatePrompt).toContain('merges with existing dependencies');
      });
    });
  });

  describe('buildUserPrompt', () => {
    it('should format user requirements only', () => {
      const prompt = buildUserPrompt('Build a todo app');

      expect(prompt).toContain('USER REQUIREMENTS:');
      expect(prompt).toContain('Build a todo app');
      expect(prompt).not.toContain('ARCHITECTURAL PLAN:');
    });

    it('should include architectural plan when provided', () => {
      const plan: ArchitecturePlan = {
        databaseModels: [
          {
            name: 'Todo',
            fields: ['title String', 'completed Boolean', 'userId String'],
          },
          {
            name: 'User',
            fields: ['name String', 'email String'],
          },
        ],
        apiRoutes: [
          { method: 'GET', path: '/api/todos', description: 'Get all todos' },
          { method: 'POST', path: '/api/todos', description: 'Create a todo' },
        ],
      };

      const prompt = buildUserPrompt('Build a todo app', plan);

      expect(prompt).toContain('ARCHITECTURAL PLAN:');
      expect(prompt).toContain('Database Models:');
      expect(prompt).toContain('- Todo:');
      expect(prompt).toContain('- User:');
      expect(prompt).toContain('API Routes:');
      expect(prompt).toContain('GET /api/todos');
      expect(prompt).toContain('POST /api/todos');
      expect(prompt).toContain('USER REQUIREMENTS:');
      expect(prompt).toContain('Build a todo app');
    });

    it('should order plan before requirements', () => {
      const plan: ArchitecturePlan = {
        databaseModels: [{ name: 'Model', fields: ['field String'] }],
      };
      const prompt = buildUserPrompt('Build a todo app', plan);

      const planPos = prompt.indexOf('ARCHITECTURAL PLAN:');
      const requirementsPos = prompt.indexOf('USER REQUIREMENTS:');

      expect(planPos).toBeGreaterThan(-1);
      expect(requirementsPos).toBeGreaterThan(planPos);
    });
  });
});
