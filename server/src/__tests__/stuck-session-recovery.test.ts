import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { databaseService } from '../services/database.service.js';

describe('Stuck Session Recovery', () => {
  beforeEach(async () => {
    await databaseService.initialize();
  });

  afterEach(async () => {
    // Clean up test sessions
    const sessions = await databaseService.listSessions(100);
    for (const session of sessions) {
      await databaseService.deleteSession(session.id);
    }
  });

  it('should find sessions stuck in generating state for longer than threshold', async () => {
    // Create a session that's 10 minutes old
    const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000);
    await databaseService.createSession({
      id: 'test-old-session',
      prompt: 'Test prompt',
      capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
      status: 'generating',
      createdAt: oldTimestamp,
    });

    // Create a recent session (2 minutes old)
    const recentTimestamp = new Date(Date.now() - 2 * 60 * 1000);
    await databaseService.createSession({
      id: 'test-recent-session',
      prompt: 'Test prompt 2',
      capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
      status: 'generating',
      createdAt: recentTimestamp,
    });

    // Create a completed session (should not be found)
    await databaseService.createSession({
      id: 'test-completed-session',
      prompt: 'Test prompt 3',
      capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
      status: 'completed',
      createdAt: oldTimestamp,
    });

    // Find stuck sessions (threshold: 5 minutes)
    const stuckSessions = await databaseService.findStuckSessions(5 * 60 * 1000);

    // Should only find the old generating session
    expect(stuckSessions).toHaveLength(1);
    expect(stuckSessions[0].id).toBe('test-old-session');
    expect(stuckSessions[0].status).toBe('generating');
  });

  it('should not find any sessions when none are stuck', async () => {
    // Create only recent sessions
    await databaseService.createSession({
      id: 'test-recent-session-1',
      prompt: 'Test prompt',
      capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
      status: 'generating',
    });

    await databaseService.createSession({
      id: 'test-recent-session-2',
      prompt: 'Test prompt 2',
      capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
      status: 'completed',
    });

    // Find stuck sessions (threshold: 5 minutes)
    const stuckSessions = await databaseService.findStuckSessions(5 * 60 * 1000);

    expect(stuckSessions).toHaveLength(0);
  });

  it('should update stuck sessions to failed status', async () => {
    // Create a stuck session
    const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000);
    await databaseService.createSession({
      id: 'test-stuck-session',
      prompt: 'Test prompt',
      capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
      status: 'generating',
      createdAt: oldTimestamp,
    });

    // Find and update stuck sessions
    const stuckSessions = await databaseService.findStuckSessions(5 * 60 * 1000);
    expect(stuckSessions).toHaveLength(1);

    const ageMinutes = Math.floor(
      (Date.now() - new Date(stuckSessions[0].createdAt).getTime()) / 1000 / 60,
    );

    await databaseService.updateSession(stuckSessions[0].id, {
      status: 'failed',
      errorMessage: `Generation interrupted by server restart (session was ${ageMinutes} minutes old)`,
    });

    // Verify update
    const sessions = await databaseService.listSessions();
    const updatedSession = sessions.find((s) => s.id === 'test-stuck-session');

    expect(updatedSession).toBeDefined();
    expect(updatedSession?.status).toBe('failed');
    expect(updatedSession?.errorMessage).toContain('server restart');
    expect(updatedSession?.errorMessage).toContain('minutes old');
  });

  it('should handle empty database gracefully', async () => {
    const stuckSessions = await databaseService.findStuckSessions(5 * 60 * 1000);
    expect(stuckSessions).toHaveLength(0);
  });

  it('should handle different threshold values', async () => {
    // Create sessions at different ages
    const timestamps = [
      Date.now() - 1 * 60 * 1000, // 1 minute
      Date.now() - 3 * 60 * 1000, // 3 minutes
      Date.now() - 7 * 60 * 1000, // 7 minutes
      Date.now() - 15 * 60 * 1000, // 15 minutes
    ];

    for (let i = 0; i < timestamps.length; i++) {
      await databaseService.createSession({
        id: `test-session-${i}`,
        prompt: `Test prompt ${i}`,
        capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
        status: 'generating',
        createdAt: new Date(timestamps[i]),
      });
    }

    // Test different thresholds
    const stuck2min = await databaseService.findStuckSessions(2 * 60 * 1000);
    expect(stuck2min).toHaveLength(3); // 3, 7, 15 minutes old

    const stuck5min = await databaseService.findStuckSessions(5 * 60 * 1000);
    expect(stuck5min).toHaveLength(2); // 7, 15 minutes old

    const stuck10min = await databaseService.findStuckSessions(10 * 60 * 1000);
    expect(stuck10min).toHaveLength(1); // 15 minutes old
  });
});
