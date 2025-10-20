/**
 * Docker Service Mock Utilities
 *
 * Shared mock utilities for Docker-related tests to reduce duplication
 * and improve maintainability.
 *
 * NOTE: Dockerode mocking cannot be extracted to a utility function due to
 * Vitest's module hoisting behavior. The vi.mock() call must execute before
 * imports, so dockerode mocks must remain inline in test files.
 * See: https://vitest.dev/api/vi.html#vi-mock
 */

import { EventEmitter } from 'node:events';
import { vi } from 'vitest';
import type { DockerService } from '../../services/docker.service';

/**
 * Creates a mock DockerService for use in ProcessService tests
 *
 * Provides a fully functional mock that implements the DockerService interface
 * with sensible defaults and EventEmitter functionality.
 *
 * @returns Mock DockerService instance
 */
export function createMockDockerService(): DockerService {
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
        clientPort: 5001,
        serverPort: 5101,
        clientUrl: 'http://localhost:5001',
        serverUrl: 'http://localhost:5101',
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
      clientPort: 5001,
      serverPort: 5101,
      clientUrl: 'http://localhost:5001',
      serverUrl: 'http://localhost:5101',
    })),
    getLogs: vi.fn().mockReturnValue([]),
    listContainers: vi.fn().mockReturnValue([]),
    buildRunnerImage: vi.fn().mockResolvedValue(undefined),
    checkDockerAvailability: vi.fn().mockResolvedValue(true),
    cleanup: vi.fn().mockResolvedValue(undefined),
  } as unknown as DockerService;
}
