/**
 * Process Service Tests
 *
 * Tests app lifecycle management with mocked Docker service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { ProcessService } from '../process.service';
import type { DockerService } from '../docker.service';
import type { AppLog, BuildEvent } from '@gen-fullstack/shared';

// Create a mock Docker service
function createMockDockerService(): DockerService {
  const emitter = new EventEmitter();

  return {
    ...emitter,
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter),
    // Return the actual sessionId passed as parameter
    createContainer: vi.fn().mockImplementation((sessionId: string) =>
      Promise.resolve({
        sessionId,
        containerId: 'container-123',
        status: 'creating',
        port: 5000,
        url: 'http://localhost:5000',
      }),
    ),
    installDependencies: vi.fn().mockResolvedValue(undefined),
    startDevServer: vi.fn().mockResolvedValue(undefined),
    destroyContainer: vi.fn().mockResolvedValue(undefined),
    // Return the actual sessionId passed as parameter
    getStatus: vi.fn().mockImplementation((sessionId: string) => ({
      sessionId,
      containerId: 'container-123',
      status: 'running',
      port: 5000,
      url: 'http://localhost:5000',
    })),
    getLogs: vi.fn().mockReturnValue([]),
    listContainers: vi.fn().mockReturnValue([]),
    buildRunnerImage: vi.fn().mockResolvedValue(undefined),
    checkDockerAvailability: vi.fn().mockResolvedValue(true),
    cleanup: vi.fn().mockResolvedValue(undefined),
  } as unknown as DockerService;
}

describe('ProcessService', () => {
  let processService: ProcessService;
  let mockDocker: DockerService;

  beforeEach(() => {
    mockDocker = createMockDockerService();
    processService = new ProcessService(mockDocker);
  });

  afterEach(async () => {
    await processService.cleanup();
  });

  describe('startApp', () => {
    it('should start app with full lifecycle', async () => {
      const sessionId = 'test-session-1';
      const workingDir = '/tmp/test-app';

      const result = await processService.startApp(sessionId, workingDir);

      expect(result).toEqual({
        sessionId,
        containerId: 'container-123',
        status: 'running',
        port: 5000,
        url: 'http://localhost:5000',
        workingDir,
        startedAt: expect.any(Number),
      });

      // Verify Docker service methods called in order
      expect(mockDocker.createContainer).toHaveBeenCalledWith(sessionId, workingDir);
      expect(mockDocker.installDependencies).toHaveBeenCalledWith(sessionId);
      expect(mockDocker.startDevServer).toHaveBeenCalledWith(sessionId);
    });

    it('should emit app_status events during lifecycle', async () => {
      const statusHandler = vi.fn();
      processService.on('app_status', statusHandler);

      await processService.startApp('test-session', '/tmp/test-app');

      // Should emit at least 2 status updates (create, running)
      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          status: expect.any(String),
        }),
      );
    });

    it('should return existing info if app already running', async () => {
      const firstStart = await processService.startApp('test-session', '/tmp/test-app');

      // Second start should return existing info, not throw error
      const secondStart = await processService.startApp('test-session', '/tmp/test-app');

      expect(secondStart).toEqual(firstStart);
      // Container creation should only be called once
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(1);
    });

    it('should handle errors and emit failed status', async () => {
      const sessionId = 'error-session';
      const statusHandler = vi.fn();
      processService.on('app_status', statusHandler);

      vi.spyOn(mockDocker, 'installDependencies').mockRejectedValueOnce(
        new Error('Install failed'),
      );

      await expect(processService.startApp(sessionId, '/tmp/test-app')).rejects.toThrow(
        'Install failed',
      );

      // Should emit failed status
      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          status: 'failed',
          error: expect.stringContaining('Install failed'),
        }),
      );
    });
  });

  describe('stopApp', () => {
    it('should stop running app', async () => {
      await processService.startApp('test-session', '/tmp/test-app');

      await processService.stopApp('test-session');

      expect(mockDocker.destroyContainer).toHaveBeenCalledWith('test-session');

      // Verify app removed from process list
      const status = processService.getAppStatus('test-session');
      expect(status).toBeNull();
    });

    it('should emit stopped status', async () => {
      await processService.startApp('test-session', '/tmp/test-app');

      const statusHandler = vi.fn();
      processService.on('app_status', statusHandler);

      await processService.stopApp('test-session');

      expect(statusHandler).toHaveBeenCalledWith({
        sessionId: 'test-session',
        status: 'stopped',
      });
    });

    it('should throw error if app not found', async () => {
      await expect(processService.stopApp('non-existent')).rejects.toThrow('App not found');
    });
  });

  describe('restartApp', () => {
    it('should stop and restart app', async () => {
      const sessionId = 'restart-test';
      const workingDir = '/tmp/test-app';

      await processService.startApp(sessionId, workingDir);

      const result = await processService.restartApp(sessionId);

      expect(result.sessionId).toBe(sessionId);
      expect(mockDocker.destroyContainer).toHaveBeenCalledWith(sessionId);
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(2); // initial + restart
    });

    it('should throw error if app not found', async () => {
      await expect(processService.restartApp('non-existent')).rejects.toThrow('App not found');
    });
  });

  describe('getAppStatus', () => {
    it('should return app status', async () => {
      await processService.startApp('test-session', '/tmp/test-app');

      const status = processService.getAppStatus('test-session');

      expect(status).toEqual({
        sessionId: 'test-session',
        containerId: 'container-123',
        status: 'running',
        port: 5000,
        url: 'http://localhost:5000',
        workingDir: '/tmp/test-app',
        startedAt: expect.any(Number),
      });
    });

    it('should return null for non-existent app', () => {
      const status = processService.getAppStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('getAppLogs', () => {
    it('should return logs from Docker service', () => {
      const mockLogs: AppLog[] = [
        {
          sessionId: 'test-session',
          timestamp: Date.now(),
          type: 'stdout',
          level: 'info',
          message: 'Test log',
        },
      ];

      vi.spyOn(mockDocker, 'getLogs').mockReturnValueOnce(mockLogs);

      const logs = processService.getAppLogs('test-session');

      expect(logs).toEqual(mockLogs);
      expect(mockDocker.getLogs).toHaveBeenCalledWith('test-session');
    });
  });

  describe('listApps', () => {
    it('should return all running apps', async () => {
      await processService.startApp('session-1', '/tmp/app1');
      await processService.startApp('session-2', '/tmp/app2');

      const apps = processService.listApps();

      expect(apps).toHaveLength(2);
      expect(apps[0].sessionId).toBe('session-1');
      expect(apps[1].sessionId).toBe('session-2');
    });

    it('should return empty array when no apps running', () => {
      const apps = processService.listApps();
      expect(apps).toEqual([]);
    });
  });

  describe('checkDockerAvailability', () => {
    it('should check Docker availability', async () => {
      const result = await processService.checkDockerAvailability();

      expect(result).toBe(true);
      expect(mockDocker.checkDockerAvailability).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should build Docker runner image', async () => {
      await processService.initialize();

      expect(mockDocker.buildRunnerImage).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should stop all running apps', async () => {
      await processService.startApp('session-1', '/tmp/app1');
      await processService.startApp('session-2', '/tmp/app2');

      await processService.cleanup();

      expect(mockDocker.destroyContainer).toHaveBeenCalledWith('session-1');
      expect(mockDocker.destroyContainer).toHaveBeenCalledWith('session-2');

      const apps = processService.listApps();
      expect(apps).toHaveLength(0);
    });

    it('should handle errors during cleanup gracefully', async () => {
      await processService.startApp('session-1', '/tmp/app1');

      vi.spyOn(mockDocker, 'destroyContainer').mockRejectedValueOnce(new Error('Destroy failed'));

      // Should not throw
      await expect(processService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('event forwarding', () => {
    it('should forward log events from Docker service', async () => {
      const logHandler = vi.fn();
      processService.on('app_log', logHandler);

      const mockLog: AppLog = {
        sessionId: 'test-session',
        timestamp: Date.now(),
        type: 'stdout',
        level: 'info',
        message: 'Test log message',
      };

      // Emit from Docker service
      (mockDocker as EventEmitter).emit('log', mockLog);

      expect(logHandler).toHaveBeenCalledWith(mockLog);
    });

    it('should forward build events from Docker service', async () => {
      const buildHandler = vi.fn();
      processService.on('build_event', buildHandler);

      const mockEvent: BuildEvent = {
        sessionId: 'test-session',
        timestamp: Date.now(),
        event: 'success',
        details: 'Build successful',
      };

      // Emit from Docker service
      (mockDocker as EventEmitter).emit('build_event', mockEvent);

      expect(buildHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should forward status changes from Docker service', async () => {
      await processService.startApp('test-session', '/tmp/test-app');

      const statusHandler = vi.fn();
      processService.on('app_status', statusHandler);

      // Emit status change from Docker service
      (mockDocker as EventEmitter).emit('status_change', {
        sessionId: 'test-session',
        status: 'running',
      });

      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          status: 'running',
        }),
      );
    });
  });
});
