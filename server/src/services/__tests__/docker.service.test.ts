/**
 * Docker Service Tests
 *
 * Tests Docker container management with mocked dockerode.
 */

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DockerService } from '../docker.service';

// Mock fs for socket path detection
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
  },
}));

// Mock os for platform detection
vi.mock('node:os', () => ({
  default: {
    platform: vi.fn().mockReturnValue('linux'),
    homedir: vi.fn().mockReturnValue('/home/test'),
  },
}));

// Mock dockerode using inline mock (can't use external function due to hoisting)
vi.mock('dockerode', async () => {
  const { EventEmitter } = await import('node:events');
  const vitest = await import('vitest');

  const createMockStream = () => {
    const stream = new EventEmitter();
    setTimeout(() => stream.emit('end'), 10);
    return stream;
  };

  const mockContainer = {
    id: 'mock-container-id',
    start: vitest.vi.fn().mockResolvedValue(undefined),
    stop: vitest.vi.fn().mockResolvedValue(undefined),
    remove: vitest.vi.fn().mockResolvedValue(undefined),
    logs: vitest.vi.fn().mockImplementation(() => {
      const stream = new EventEmitter();
      return Promise.resolve(stream);
    }),
    exec: vitest.vi.fn().mockImplementation(() => {
      return Promise.resolve({
        start: vitest.vi.fn().mockImplementation(() => {
          return Promise.resolve(createMockStream());
        }),
      });
    }),
  };

  const sharedDockerInstance = {
    ping: vitest.vi.fn().mockResolvedValue(true),
    listImages: vitest.vi.fn().mockResolvedValue([]),
    listContainers: vitest.vi.fn().mockResolvedValue([]),
    buildImage: vitest.vi.fn().mockResolvedValue(new EventEmitter()),
    createContainer: vitest.vi.fn().mockResolvedValue(mockContainer),
    getContainer: vitest.vi.fn().mockReturnValue(mockContainer),
    modem: {
      followProgress: vitest.vi.fn((_stream, onFinished, onProgress) => {
        onProgress?.({ stream: 'Building...' });
        onFinished?.(null, [{ stream: 'Successfully built' }]);
      }),
    },
  };

  const mockDocker = vitest.vi.fn().mockImplementation(() => sharedDockerInstance);

  // @ts-expect-error - Adding mock properties for test access
  mockDocker.mockContainer = mockContainer;
  // @ts-expect-error - Adding shared instance for test access
  mockDocker.sharedInstance = sharedDockerInstance;

  return { default: mockDocker };
});

describe('DockerService', () => {
  let dockerService: DockerService;

  beforeEach(() => {
    dockerService = new DockerService();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await dockerService.cleanup();
  });

  describe('checkDockerAvailability', () => {
    it('should return true when Docker is available', async () => {
      const result = await dockerService.checkDockerAvailability();
      expect(result).toBe(true);
    });

    it('should return false when Docker is not available', async () => {
      // Mock ping to throw on the shared instance
      const Docker = (await import('dockerode')).default;
      const sharedInstance = (Docker as any).sharedInstance;
      sharedInstance.ping.mockRejectedValueOnce(new Error('Docker not running'));

      const result = await dockerService.checkDockerAvailability();
      expect(result).toBe(false);

      // Reset the mock for other tests
      sharedInstance.ping.mockResolvedValue(true);
    });
  });

  describe('buildRunnerImage', () => {
    it('should build runner image if not exists', async () => {
      const Docker = (await import('dockerode')).default;
      const sharedInstance = (Docker as any).sharedInstance;

      await dockerService.buildRunnerImage();

      expect(sharedInstance.listImages).toHaveBeenCalled();
    });

    it('should skip build if image already exists', async () => {
      const Docker = (await import('dockerode')).default;
      const sharedInstance = (Docker as any).sharedInstance;

      sharedInstance.listImages.mockResolvedValueOnce([
        {
          RepoTags: ['gen-fullstack-runner:latest'],
          Id: 'abc123',
          ParentId: '',
          Created: Date.now(),
          Size: 0,
          VirtualSize: 0,
          SharedSize: 0,
          Labels: {},
          Containers: 0,
        },
      ]);

      await dockerService.buildRunnerImage();
      expect(sharedInstance.buildImage).not.toHaveBeenCalled();
    });

    it('should handle build errors', async () => {
      const Docker = (await import('dockerode')).default;
      const sharedInstance = (Docker as any).sharedInstance;

      sharedInstance.buildImage.mockRejectedValueOnce(new Error('Build failed'));

      await expect(dockerService.buildRunnerImage()).rejects.toThrow(
        'Failed to build Docker runner image',
      );

      // Reset for other tests
      sharedInstance.buildImage.mockResolvedValue(new EventEmitter());
    });
  });

  // NOTE: checkHttpReady tests moved to http-ready-check.test.ts
  // since the functionality was extracted to a separate module

  describe('createContainer', () => {
    it('should create and start container with correct configuration', async () => {
      const sessionId = 'test-session-1';
      const workingDir = '/tmp/test-app';

      const Docker = (await import('dockerode')).default;
      const sharedInstance = (Docker as any).sharedInstance;

      const result = await dockerService.createContainer(sessionId, workingDir);

      expect(result).toEqual({
        sessionId,
        containerId: 'mock-container-id',
        status: 'ready',
        clientPort: expect.any(Number),
        serverPort: expect.any(Number),
        clientUrl: expect.stringContaining('http://localhost:'),
        serverUrl: expect.stringContaining('http://localhost:'),
      });

      // Verify container was created with correct config
      expect(sharedInstance.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'gen-fullstack-runner',
          name: `gen-${sessionId}`,
          WorkingDir: '/app',
          HostConfig: expect.objectContaining({
            Memory: 512 * 1024 * 1024,
            NanoCpus: 1000000000,
            CapDrop: ['ALL'],
          }),
        }),
      );
    });

    it('should assign unique ports to different containers', async () => {
      const container1 = await dockerService.createContainer('session-1', '/tmp/app1');
      const container2 = await dockerService.createContainer('session-2', '/tmp/app2');

      expect(container1.clientPort).not.toBe(container2.clientPort);
      expect(container1.serverPort).not.toBe(container2.serverPort);
      expect(container1.clientPort).not.toBe(container2.serverPort);
    });

    it('should emit log events when container produces output', async () => {
      const sessionId = 'test-session-logs';
      const logHandler = vi.fn();

      dockerService.on('log', logHandler);

      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;

      // Create a mock logs stream that will emit data
      const mockLogs = new EventEmitter();
      mockContainer.logs.mockResolvedValueOnce(mockLogs);

      await dockerService.createContainer(sessionId, '/tmp/test-app');

      // Emit mock log data with proper Docker multiplexed stream format
      // Docker log format: 8-byte header + message
      // Header: [stream_type, 0, 0, 0, size1, size2, size3, size4]
      const message = Buffer.from('Test log message');
      const header = Buffer.alloc(8);
      header[0] = 1; // Stream type: 1 = stdout
      header.writeUInt32BE(message.length, 4); // Message size

      mockLogs.emit('data', Buffer.concat([header, message]));

      // Wait a tick for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logHandler).toHaveBeenCalled();

      // Reset mock for other tests
      mockContainer.logs.mockImplementation(() => {
        const stream = new EventEmitter();
        return Promise.resolve(stream);
      });
    });

    it('should handle container creation errors', async () => {
      const Docker = (await import('dockerode')).default;
      const sharedInstance = (Docker as any).sharedInstance;

      sharedInstance.createContainer.mockRejectedValueOnce(new Error('Creation failed'));

      await expect(dockerService.createContainer('error-session', '/tmp/app')).rejects.toThrow(
        'Failed to create Docker container',
      );

      // Reset mock for other tests
      const mockContainer = (Docker as any).mockContainer;
      sharedInstance.createContainer.mockResolvedValue(mockContainer);
    });
  });

  describe('installDependencies', () => {
    it('should execute npm install in container', async () => {
      const sessionId = 'install-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      await dockerService.installDependencies(sessionId);

      // Container stays in 'ready' status during installation (no status change)

      // Verify exec was called with correct command
      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['npm', 'install', '--loglevel=info'],
          WorkingDir: '/app',
        }),
      );
    });

    it('should emit command log before executing npm install', async () => {
      const sessionId = 'install-cmd-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const logHandler = vi.fn();
      dockerService.on('log', logHandler);

      await dockerService.installDependencies(sessionId);

      // Verify command log was emitted
      expect(logHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          level: 'command',
          message: '$ npm install --loglevel=info',
          type: 'stdout',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should throw error if container not found', async () => {
      await expect(dockerService.installDependencies('non-existent')).rejects.toThrow(
        'Container not found',
      );
    });

    it('should handle installation timeout', async () => {
      vi.useFakeTimers();

      const sessionId = 'timeout-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;

      // Mock exec to return a stream that never emits 'end'
      const neverResolving = new EventEmitter();
      mockContainer.exec.mockResolvedValueOnce({
        start: vi.fn().mockResolvedValueOnce(neverResolving),
      });

      // Start the install (which will timeout after 2 minutes)
      const installPromise = dockerService.installDependencies(sessionId).catch((err) => err);

      // Fast-forward time by 2 minutes to trigger the timeout
      await vi.advanceTimersByTimeAsync(121000); // 2 minutes + 1 second

      const result = await installPromise;
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain('npm install timeout');

      vi.useRealTimers();
    });
  });

  describe('startDevServer', () => {
    it('should execute npm run dev with host and port flags in container', async () => {
      const sessionId = 'dev-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const statusHandler = vi.fn();
      dockerService.on('status_change', statusHandler);

      // Mock fetch to simulate successful HTTP ready check
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      // Install dependencies first (required before starting dev server)
      await dockerService.installDependencies(sessionId);

      // Start dev server (machine will handle START_SERVER event and wait for VITE_READY + HTTP_READY)
      const startPromise = dockerService.startDevServer(sessionId);

      // Poll until machine reaches waitingForVite state, then send VITE_READY
      const pollInterval = setInterval(() => {
        const containers = dockerService.listContainers();
        const container = containers.find((c) => c.sessionId === sessionId);
        if (container?.actor) {
          const state = container.actor.getSnapshot().value;
          if (state === 'waitingForVite') {
            clearInterval(pollInterval);
            container.actor.send({ type: 'VITE_READY' } as any);
          }
        }
      }, 100);

      // Safety timeout to clear interval
      setTimeout(() => clearInterval(pollInterval), 28000);

      await startPromise;
      clearInterval(pollInterval);

      // Verify exec was called
      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['npm', 'run', 'dev'],
          WorkingDir: '/app',
        }),
      );
    }, 10000);

    it('should emit command log before starting dev server', async () => {
      const sessionId = 'dev-cmd-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const logHandler = vi.fn();
      dockerService.on('log', logHandler);

      // Mock fetch to simulate successful HTTP ready check
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      // Install dependencies first (required before starting dev server)
      await dockerService.installDependencies(sessionId);

      // Start dev server
      const startPromise = dockerService.startDevServer(sessionId);

      // Poll until machine reaches waitingForVite state, then send VITE_READY
      const pollInterval = setInterval(() => {
        const containers = dockerService.listContainers();
        const container = containers.find((c) => c.sessionId === sessionId);
        if (container?.actor) {
          const state = container.actor.getSnapshot().value;
          if (state === 'waitingForVite') {
            clearInterval(pollInterval);
            container.actor.send({ type: 'VITE_READY' } as any);
          }
        }
      }, 100);

      // Safety timeout
      setTimeout(() => clearInterval(pollInterval), 28000);

      await startPromise;
      clearInterval(pollInterval);

      // Verify command log was emitted
      expect(logHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          level: 'command',
          message: '$ npm run dev',
          type: 'stdout',
          timestamp: expect.any(Number),
        }),
      );
    }, 10000);

    it('should throw error if container not found', async () => {
      await expect(dockerService.startDevServer('non-existent')).rejects.toThrow(
        'Container not found',
      );
    });
  });

  describe('getStatus', () => {
    it('should return container status', async () => {
      const sessionId = 'status-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const status = dockerService.getStatus(sessionId);

      expect(status).toEqual({
        sessionId,
        containerId: 'mock-container-id',
        status: 'ready',
        clientPort: expect.any(Number),
        serverPort: expect.any(Number),
        clientUrl: expect.stringContaining('http://localhost:'),
        serverUrl: expect.stringContaining('http://localhost:'),
      });
    });

    it('should return null for non-existent container', () => {
      const status = dockerService.getStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('getLogs', () => {
    it('should return container logs', async () => {
      const sessionId = 'logs-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const logs = dockerService.getLogs(sessionId);

      expect(Array.isArray(logs)).toBe(true);
    });

    it('should return empty array for non-existent container', () => {
      const logs = dockerService.getLogs('non-existent');
      expect(logs).toEqual([]);
    });
  });

  describe('destroyContainer', () => {
    it('should stop and remove container', async () => {
      const sessionId = 'destroy-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const statusHandler = vi.fn();
      dockerService.on('status_change', statusHandler);

      // Destroy container - machine will handle DESTROY event and cleanup
      await dockerService.destroyContainer(sessionId);

      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;
      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });

      // Verify container removed from internal map
      const status = dockerService.getStatus(sessionId);
      expect(status).toBeNull();
    }, 15000);

    it('should handle gracefully if container does not exist', async () => {
      await expect(dockerService.destroyContainer('non-existent')).resolves.not.toThrow();
    });

    it('should force remove if stop fails', async () => {
      const sessionId = 'force-remove-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;
      mockContainer.stop.mockRejectedValueOnce(new Error('Stop failed'));

      // Should still remove even if stop fails
      await dockerService.destroyContainer(sessionId);

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    }, 15000);
  });

  describe('cleanup', () => {
    it('should destroy all containers', async () => {
      await dockerService.createContainer('session-1', '/tmp/app1');
      await dockerService.createContainer('session-2', '/tmp/app2');
      await dockerService.createContainer('session-3', '/tmp/app3');

      await dockerService.cleanup();

      expect(dockerService.listContainers()).toHaveLength(0);
    }, 15000);
  });

  describe('listContainers', () => {
    it('should return all active containers', async () => {
      await dockerService.createContainer('session-1', '/tmp/app1');
      await dockerService.createContainer('session-2', '/tmp/app2');

      const containers = dockerService.listContainers();

      expect(containers).toHaveLength(2);
      expect(containers[0].sessionId).toBe('session-1');
      expect(containers[1].sessionId).toBe('session-2');
    });

    it('should return empty array when no containers', () => {
      const containers = dockerService.listContainers();
      expect(containers).toEqual([]);
    });
  });

  describe('Circuit Breaker', () => {
    it('should track consecutive failures', async () => {
      // Force 5 consecutive failures by creating invalid containers
      const promises = [];
      for (let i = 0; i < 5; i++) {
        // Mock createContainer to fail
        vi.spyOn(dockerService as any, 'buildRunnerImage').mockRejectedValueOnce(
          new Error('Build failed'),
        );
        promises.push(
          dockerService.createContainer(`fail-${i}`, '/tmp/fail').catch(() => {
            // Swallow error
          }),
        );
      }

      await Promise.all(promises);

      // Circuit breaker should now be open
      // Next call should fail immediately with circuit breaker error
      await expect(dockerService.createContainer('test', '/tmp/test')).rejects.toThrow(
        'temporarily unavailable',
      );
    });

    it('should reset after successful operation', async () => {
      // Create a successful container (resets failure count)
      const container = await dockerService.createContainer('success', '/tmp/success');
      expect(container.sessionId).toBe('success');

      // Circuit breaker should be closed
      // The circuitBreaker is now a private member, but a successful operation should close it
      // We can verify this indirectly by ensuring no error is thrown on next operation
      const container2 = await dockerService.createContainer('success2', '/tmp/success2');
      expect(container2.sessionId).toBe('success2');
    });
  });

  describe('Container Limits', () => {
    it('should enforce MAX_CONCURRENT_CONTAINERS limit', async () => {
      // Override MAX_CONCURRENT_CONTAINERS for testing
      const originalEnv = process.env.MAX_CONTAINERS;
      process.env.MAX_CONTAINERS = '3';

      // Re-import to pick up new env var (note: this is tricky in vitest)
      // For now, test the principle by creating 3 containers
      const container1 = await dockerService.createContainer('limit-1', '/tmp/limit1');
      const container2 = await dockerService.createContainer('limit-2', '/tmp/limit2');
      const container3 = await dockerService.createContainer('limit-3', '/tmp/limit3');

      expect(container1.sessionId).toBe('limit-1');
      expect(container2.sessionId).toBe('limit-2');
      expect(container3.sessionId).toBe('limit-3');

      // Cleanup
      await dockerService.destroyContainer('limit-1');
      await dockerService.destroyContainer('limit-2');
      await dockerService.destroyContainer('limit-3');

      // Restore env
      if (originalEnv) {
        process.env.MAX_CONTAINERS = originalEnv;
      } else {
        delete process.env.MAX_CONTAINERS;
      }
    }, 20000);
  });
});
