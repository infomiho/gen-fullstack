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

describe('Prompt Builder', () => {
  describe('buildSystemPrompt', () => {
    it('should include base prompt only for naive mode without addons', () => {
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
      expect(prompt).not.toContain('TEMPLATE MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('BUILDING BLOCKS:');
      expect(prompt).not.toContain('VALIDATION TOOLS:');
    });

    it('should include template addon for template mode', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'template',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      expect(prompt).toContain('TEMPLATE MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('BUILDING BLOCKS:');
      expect(prompt).not.toContain('VALIDATION TOOLS:');
    });

    it('should include planning addon when enabled', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'naive',
        planning: true,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      expect(prompt).toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('TEMPLATE MODE:');
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
      expect(prompt).not.toContain('TEMPLATE MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('VALIDATION TOOLS:');
    });

    it('should include compiler checks addon when enabled', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'naive',
        planning: false,
        compilerChecks: true,
        buildingBlocks: false,
        maxIterations: 3,
      });

      expect(prompt).toContain('VALIDATION TOOLS:');
      expect(prompt).not.toContain('TEMPLATE MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('BUILDING BLOCKS:');
    });

    it('should compose multiple addons correctly', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'template',
        planning: true,
        compilerChecks: true,
        buildingBlocks: true,
        maxIterations: 3,
      });

      // Should include all addons
      expect(prompt).toContain('TEMPLATE MODE:');
      expect(prompt).toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).toContain('BUILDING BLOCKS:');
      expect(prompt).toContain('VALIDATION TOOLS:');
    });

    it('should maintain correct addon order', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'template',
        planning: true,
        compilerChecks: true,
        buildingBlocks: true,
        maxIterations: 3,
      });

      // Get positions of each addon
      const templatePos = prompt.indexOf('TEMPLATE MODE:');
      const planningPos = prompt.indexOf('ARCHITECTURAL PLANNING:');
      const blocksPos = prompt.indexOf('BUILDING BLOCKS:');
      const validationPos = prompt.indexOf('VALIDATION TOOLS:');

      // Verify order: base → template → planning → blocks → validation
      expect(templatePos).toBeGreaterThan(0);
      expect(planningPos).toBeGreaterThan(templatePos);
      expect(blocksPos).toBeGreaterThan(planningPos);
      expect(validationPos).toBeGreaterThan(blocksPos);
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

      it('should NOT include dependency check workflow in naive mode', () => {
        const naivePrompt = buildSystemPrompt({
          inputMode: 'naive',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });

        // Naive mode should NOT tell LLM to read existing package.json
        // (files don't exist yet in naive mode)
        expect(naivePrompt).not.toContain('BEFORE adding ANY dependencies');
        expect(naivePrompt).not.toContain('readFile to check client/package.json');
        expect(naivePrompt).not.toContain('readFile to check server/package.json');
        expect(naivePrompt).not.toContain('Identify which packages are ALREADY installed');
      });

      it('should include dependency check workflow in template mode', () => {
        const templatePrompt = buildSystemPrompt({
          inputMode: 'template',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });

        // Template mode SHOULD tell LLM to read existing package.json
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

        // Naive mode should instruct to write complete package.json files
        expect(prompt).toContain('Write complete package.json files');
        expect(prompt).toContain('ALL dependencies included');
        expect(prompt).toContain('Use writeFile to create package.json');

        // Naive mode should NOT mention installNpmDep (not available)
        expect(prompt).not.toContain('installNpmDep');
      });

      it('should include installNpmDep instructions only in template mode', () => {
        const templatePrompt = buildSystemPrompt({
          inputMode: 'template',
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        });

        // Template mode SHOULD mention installNpmDep
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
      const plan = `Database Models:
- Todo (title, completed, userId)
- User (name, email)

API Routes:
- GET /api/todos
- POST /api/todos`;

      const prompt = buildUserPrompt('Build a todo app', plan);

      expect(prompt).toContain('ARCHITECTURAL PLAN:');
      expect(prompt).toContain('Database Models:');
      expect(prompt).toContain('API Routes:');
      expect(prompt).toContain('USER REQUIREMENTS:');
      expect(prompt).toContain('Build a todo app');
    });

    it('should order plan before requirements', () => {
      const plan = 'Some architectural plan';
      const prompt = buildUserPrompt('Build a todo app', plan);

      const planPos = prompt.indexOf('ARCHITECTURAL PLAN:');
      const requirementsPos = prompt.indexOf('USER REQUIREMENTS:');

      expect(planPos).toBeGreaterThan(-1);
      expect(requirementsPos).toBeGreaterThan(planPos);
    });
  });
});
