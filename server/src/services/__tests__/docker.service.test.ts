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

// Mock dockerode
vi.mock('dockerode', () => {
  const createMockStream = () => {
    const stream = new EventEmitter();
    // Emit 'end' after a short delay to prevent timeouts
    setTimeout(() => stream.emit('end'), 10);
    return stream;
  };

  const mockContainer = {
    id: 'mock-container-id',
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    logs: vi.fn().mockImplementation(() => {
      const stream = new EventEmitter();
      return Promise.resolve(stream);
    }),
    exec: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        start: vi.fn().mockImplementation(() => {
          return Promise.resolve(createMockStream());
        }),
      });
    }),
  };

  // Create a shared instance that will be returned by all Docker() calls
  const sharedDockerInstance = {
    ping: vi.fn().mockResolvedValue(true),
    listImages: vi.fn().mockResolvedValue([]),
    listContainers: vi.fn().mockResolvedValue([]),
    buildImage: vi.fn().mockResolvedValue(new EventEmitter()),
    createContainer: vi.fn().mockResolvedValue(mockContainer),
    getContainer: vi.fn().mockReturnValue(mockContainer),
    modem: {
      followProgress: vi.fn((_stream, onFinished, onProgress) => {
        // Simulate build progress
        onProgress?.({ stream: 'Building...' });
        onFinished?.(null, [{ stream: 'Successfully built' }]);
      }),
    },
  };

  const mockDocker = vi.fn().mockImplementation(() => sharedDockerInstance);

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

  describe('checkHttpReady', () => {
    beforeEach(() => {
      // Reset fetch mock before each test
      vi.unstubAllGlobals();
    });

    it('should return true when server responds immediately', async () => {
      // Mock global fetch to succeed
      global.fetch = vi.fn().mockResolvedValueOnce(new Response());

      const ready = await (dockerService as any).checkHttpReady(5173);

      expect(ready).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5173',
        expect.objectContaining({
          method: 'HEAD',
        }),
      );
    });

    it('should retry and eventually succeed', async () => {
      // Mock fetch to fail twice, then succeed
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(new Response());

      const ready = await (dockerService as any).checkHttpReady(5173);

      expect(ready).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should return false after all retries fail', async () => {
      // Mock fetch to always fail
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const ready = await (dockerService as any).checkHttpReady(5173);

      expect(ready).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(10); // maxAttempts from HTTP_READY_CHECK
    });

    it('should accept 404 responses as ready', async () => {
      // Mock fetch to return 404 (which means server is listening)
      global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }));

      const ready = await (dockerService as any).checkHttpReady(5173);

      expect(ready).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should accept any HTTP response as ready', async () => {
      // Mock fetch to return 500 (server error, but server is listening)
      global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));

      const ready = await (dockerService as any).checkHttpReady(5173);

      expect(ready).toBe(true);
    });

    it('should wait between retry attempts', async () => {
      vi.useFakeTimers();

      // Mock fetch to fail twice, then succeed
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(new Response());

      const readyPromise = (dockerService as any).checkHttpReady(5173);

      // Advance timers by 500ms between each retry
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(500);

      const ready = await readyPromise;

      expect(ready).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('should handle timeout errors', async () => {
      // Mock fetch to throw timeout error
      global.fetch = vi
        .fn()
        .mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

      const ready = await (dockerService as any).checkHttpReady(5173);

      expect(ready).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(10);
    });
  });

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
        status: 'creating',
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

      const statusHandler = vi.fn();
      dockerService.on('status_change', statusHandler);

      await dockerService.installDependencies(sessionId);

      // Verify status change emitted
      expect(statusHandler).toHaveBeenCalledWith({
        sessionId,
        status: 'installing',
      });

      // Verify exec was called with correct command
      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['npm', 'install'],
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
          message: '$ npm install',
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
      expect(result.message).toContain('Installation timeout');

      vi.useRealTimers();
    });
  });

  describe('startDevServer', () => {
    it('should execute npm run dev with host and port flags in container', async () => {
      const sessionId = 'dev-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const statusHandler = vi.fn();
      dockerService.on('status_change', statusHandler);

      // Mock waiting for ready (to avoid actual timeout)
      vi.spyOn(dockerService as any, 'waitForReady').mockResolvedValueOnce(undefined);

      await dockerService.startDevServer(sessionId);

      expect(statusHandler).toHaveBeenCalledWith({
        sessionId,
        status: 'starting',
      });

      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['npm', 'run', 'dev'],
          WorkingDir: '/app',
        }),
      );
    });

    it('should emit command log before starting dev server', async () => {
      const sessionId = 'dev-cmd-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const logHandler = vi.fn();
      dockerService.on('log', logHandler);

      // Mock waiting for ready (to avoid actual timeout)
      vi.spyOn(dockerService as any, 'waitForReady').mockResolvedValueOnce(undefined);

      await dockerService.startDevServer(sessionId);

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
    });

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
        status: 'creating',
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

      await dockerService.destroyContainer(sessionId);

      expect(statusHandler).toHaveBeenCalledWith({
        sessionId,
        status: 'stopped',
      });

      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;
      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });

      // Verify container removed from internal map
      const status = dockerService.getStatus(sessionId);
      expect(status).toBeNull();
    });

    it('should handle gracefully if container does not exist', async () => {
      await expect(dockerService.destroyContainer('non-existent')).resolves.not.toThrow();
    });

    it('should force remove if stop fails', async () => {
      const sessionId = 'force-remove-test';
      await dockerService.createContainer(sessionId, '/tmp/test-app');

      const Docker = (await import('dockerode')).default;
      const mockContainer = (Docker as any).mockContainer;
      mockContainer.stop.mockRejectedValueOnce(new Error('Stop failed'));

      await dockerService.destroyContainer(sessionId);

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });
  });

  describe('cleanup', () => {
    it('should destroy all containers', async () => {
      await dockerService.createContainer('session-1', '/tmp/app1');
      await dockerService.createContainer('session-2', '/tmp/app2');
      await dockerService.createContainer('session-3', '/tmp/app3');

      await dockerService.cleanup();

      expect(dockerService.listContainers()).toHaveLength(0);
    });
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
});
