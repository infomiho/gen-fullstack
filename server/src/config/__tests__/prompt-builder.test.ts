/**
 * Prompt Builder Tests
 *
 * Tests for the composable prompt system that replaces mode-specific prompts
 * with a base + addons approach.
 */

import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '../prompt-builder.js';

describe('Prompt Builder', () => {
  describe('buildSystemPrompt', () => {
    it('should include base prompt for naive mode', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      expect(prompt).toContain('You are an expert full-stack TypeScript developer');
      expect(prompt).toContain('ARCHITECTURE:');
      expect(prompt).toContain('REQUIRED FILES:');
      expect(prompt).not.toContain('TEMPLATE MODE:');
      expect(prompt).not.toContain('ARCHITECTURAL PLANNING:');
      expect(prompt).not.toContain('BUILDING BLOCKS:');
      expect(prompt).not.toContain('VALIDATION TOOLS:');
    });

    it('should include dependency management section in base prompt', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      // Verify DEPENDENCY MANAGEMENT section is included
      expect(prompt).toContain('DEPENDENCY MANAGEMENT:');
      expect(prompt).toContain('Use updatePackageJson tool to add dependencies');
      expect(prompt).toContain('Example updatePackageJson call:');
      expect(prompt).toContain('"react-router-dom": "^6.26.0"');
      expect(prompt).toContain('ALWAYS provide the dependencies object with versions');
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
      expect(prompt).toContain('DO NOT use writeFile for package.json files');
      expect(prompt).toContain('Use installNpmDep tool');
    });

    it('should include template customization instructions', () => {
      const prompt = buildSystemPrompt({
        inputMode: 'template',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });

      // Verify new 5-step task list
      expect(prompt).toContain('YOUR TASK:');
      expect(prompt).toContain('**Replace** template example code');
      expect(prompt).toContain('Update App.tsx to implement the actual application');
      expect(prompt).toContain('Update main.tsx if routing or global providers are needed');
      expect(prompt).toContain('You are customizing the template, not extending it');
      expect(prompt).toContain("The template's example code is a placeholder to be replaced");
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
      expect(prompt).toContain('planArchitecture tool');
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
      expect(prompt).toContain('requestBlock tool');
      expect(prompt).toContain('auth-password');
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
      expect(prompt).toContain('validatePrismaSchema');
      expect(prompt).toContain('validateTypeScript');
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

      // Should not have conflicting instructions
      expect(prompt).not.toMatch(/DO NOT.*DO NOT/); // No double negatives
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
  });

  describe('buildUserPrompt', () => {
    it('should format user requirements only', () => {
      const prompt = buildUserPrompt('Build a todo app');

      expect(prompt).toBe('USER REQUIREMENTS:\nBuild a todo app');
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

  describe('Integration', () => {
    it('should generate complete prompts for different configurations', () => {
      // Naive mode
      const naiveSystem = buildSystemPrompt({
        inputMode: 'naive',
        planning: false,
        compilerChecks: false,
        buildingBlocks: false,
        maxIterations: 3,
      });
      const naiveUser = buildUserPrompt('Build a todo app');

      expect(naiveSystem.length).toBeGreaterThan(500); // Base prompt is substantial
      expect(naiveUser.length).toBeGreaterThan(10);

      // Full-featured template mode
      const templateSystem = buildSystemPrompt({
        inputMode: 'template',
        planning: true,
        compilerChecks: true,
        buildingBlocks: true,
        maxIterations: 3,
      });
      const templateUser = buildUserPrompt('Build a todo app', 'Plan: Use Prisma + React');

      expect(templateSystem.length).toBeGreaterThan(naiveSystem.length); // More addons = longer
      expect(templateUser).toContain('ARCHITECTURAL PLAN:');
      expect(templateUser).toContain('USER REQUIREMENTS:');
    });
  });
});
