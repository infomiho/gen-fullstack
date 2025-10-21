/**
 * Database Migration Tests for Capability Config
 *
 * Tests for migration 0003_remove_legacy_strategy.sql which:
 * - Removes the legacy 'strategy' field
 * - Makes 'capability_config' required
 * - Uses COALESCE to provide default value for NULL configs
 *
 * These tests ensure data integrity during schema migrations.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { databaseService } from '../../services/database.service.js';

describe('Capability Config Migration (0003)', () => {
  const testSessionIds: string[] = [];

  beforeEach(async () => {
    // Initialize database (runs all migrations)
    await databaseService.initialize();
  });

  afterEach(async () => {
    // Cleanup test sessions
    for (const sessionId of testSessionIds) {
      try {
        await databaseService.deleteSession(sessionId);
      } catch {
        // Ignore deletion errors (session may not exist)
      }
    }
    testSessionIds.length = 0; // Clear array
  });

  it('should create new sessions with valid capability_config after migration', async () => {
    const sessionId = `test-new-session-${Date.now()}`;
    testSessionIds.push(sessionId);

    const config = {
      inputMode: 'naive' as const,
      planning: true,
      compilerChecks: true,
    };

    // Create session with explicit capability_config
    await databaseService.createSession({
      id: sessionId,
      prompt: 'Test prompt for new session',
      capabilityConfig: JSON.stringify(config),
      status: 'generating',
    });

    // Verify session was created correctly
    const session = await databaseService.getSession(sessionId);
    expect(session).toBeDefined();
    if (!session) throw new Error('Session not found'); // Type guard
    expect(session.id).toBe(sessionId);
    expect(session.capabilityConfig).toBe(JSON.stringify(config));

    // Verify config can be parsed back
    const parsedConfig = JSON.parse(session.capabilityConfig);
    expect(parsedConfig.inputMode).toBe('naive');
    expect(parsedConfig.planning).toBe(true);
    expect(parsedConfig.compilerChecks).toBe(true);
  });

  it('should require capability_config field (NOT NULL constraint)', async () => {
    const sessionId = `test-required-${Date.now()}`;
    testSessionIds.push(sessionId);

    // Attempt to create session without capability_config should fail
    // TypeScript will prevent this at compile time, but verify runtime enforcement
    await expect(
      async () =>
        await databaseService.createSession({
          id: sessionId,
          prompt: 'Test prompt',
          // @ts-expect-error - Testing runtime enforcement of required field
          capabilityConfig: undefined,
          status: 'generating',
        }),
    ).rejects.toThrow();
  });

  it('should handle minimal naive config correctly', async () => {
    const sessionId = `test-naive-${Date.now()}`;
    testSessionIds.push(sessionId);

    // Create session with minimal naive config (matches migration default)
    const minimalConfig = { inputMode: 'naive' as const };

    await databaseService.createSession({
      id: sessionId,
      prompt: 'Test naive config',
      capabilityConfig: JSON.stringify(minimalConfig),
      status: 'completed',
    });

    const session = await databaseService.getSession(sessionId);
    if (!session) throw new Error('Session not found'); // Type guard
    expect(session.capabilityConfig).toBe(JSON.stringify(minimalConfig));

    const parsedConfig = JSON.parse(session.capabilityConfig);
    expect(parsedConfig.inputMode).toBe('naive');
    expect(parsedConfig.planning).toBeFalsy();
    expect(parsedConfig.compilerChecks).toBeFalsy();
  });

  it('should handle complex capability config with all options', async () => {
    const sessionId = `test-complex-${Date.now()}`;
    testSessionIds.push(sessionId);

    const complexConfig = {
      inputMode: 'template' as const,
      templateOptions: {
        templateName: 'vite-fullstack-base',
      },
      planning: true,
      compilerChecks: true,
      maxIterations: 3,
    };

    await databaseService.createSession({
      id: sessionId,
      prompt: 'Test complex config',
      capabilityConfig: JSON.stringify(complexConfig),
      status: 'generating',
    });

    const session = await databaseService.getSession(sessionId);
    if (!session) throw new Error('Session not found'); // Type guard
    const parsedConfig = JSON.parse(session.capabilityConfig);

    expect(parsedConfig.inputMode).toBe('template');
    expect(parsedConfig.templateOptions?.templateName).toBe('vite-fullstack-base');
    expect(parsedConfig.planning).toBe(true);
    expect(parsedConfig.compilerChecks).toBe(true);
    expect(parsedConfig.maxIterations).toBe(3);
  });

  it('should list sessions with capability_config correctly', async () => {
    const sessionId1 = `test-list-1-${Date.now()}`;
    const sessionId2 = `test-list-2-${Date.now()}`;
    testSessionIds.push(sessionId1, sessionId2);

    // Create two sessions with different configs
    await databaseService.createSession({
      id: sessionId1,
      prompt: 'First session',
      capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
      status: 'completed',
    });

    await databaseService.createSession({
      id: sessionId2,
      prompt: 'Second session',
      capabilityConfig: JSON.stringify({ inputMode: 'naive', planning: true }),
      status: 'generating',
    });

    // List all sessions
    const sessions = await databaseService.listSessions();

    // Find our test sessions
    const session1 = sessions.find((s) => s.id === sessionId1);
    const session2 = sessions.find((s) => s.id === sessionId2);

    expect(session1).toBeDefined();
    expect(session2).toBeDefined();

    // Verify configs are present and correct
    if (session1 && session2) {
      expect(JSON.parse(session1.capabilityConfig).inputMode).toBe('naive');
      const session2Config = JSON.parse(session2.capabilityConfig);
      expect(session2Config.inputMode).toBe('naive');
      expect(session2Config.planning).toBe(true);
    }
  });

  it('should handle JSON edge cases in capability_config', async () => {
    const sessionId = `test-json-edge-${Date.now()}`;
    testSessionIds.push(sessionId);

    // Config with various JSON edge cases
    const edgeCaseConfig = {
      inputMode: 'naive' as const,
      // Test null vs undefined (only null is valid JSON)
      optionalField: null,
      // Test nested objects
      nested: {
        deep: {
          value: 'test',
        },
      },
      // Test arrays
      tags: ['test1', 'test2'],
      // Test numbers
      maxValue: 100,
      // Test booleans
      enabled: false,
    };

    await databaseService.createSession({
      id: sessionId,
      prompt: 'Test JSON edge cases',
      capabilityConfig: JSON.stringify(edgeCaseConfig),
      status: 'completed',
    });

    const session = await databaseService.getSession(sessionId);
    if (!session) throw new Error('Session not found'); // Type guard
    const parsedConfig = JSON.parse(session.capabilityConfig);

    expect(parsedConfig.optionalField).toBeNull();
    expect(parsedConfig.nested.deep.value).toBe('test');
    expect(parsedConfig.tags).toEqual(['test1', 'test2']);
    expect(parsedConfig.maxValue).toBe(100);
    expect(parsedConfig.enabled).toBe(false);
  });
});
