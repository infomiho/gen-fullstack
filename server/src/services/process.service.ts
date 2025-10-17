/**
 * Process Service
 *
 * High-level service for managing app execution lifecycle.
 * Wraps Docker service with simplified interface for WebSocket handlers.
 */

import { EventEmitter } from 'node:events';
import type { AppInfo, AppLog, BuildEvent } from '@gen-fullstack/shared';
import { type DockerService, dockerService } from './docker.service';

export interface ProcessInfo extends AppInfo {
  workingDir: string;
  startedAt: number;
}

export class ProcessService extends EventEmitter {
  private processes = new Map<string, ProcessInfo>();

  constructor(private docker: DockerService = dockerService) {
    super();

    this.docker.on('log', (log: AppLog) => {
      this.emit('app_log', log);
    });

    this.docker.on('build_event', (event: BuildEvent) => {
      this.emit('build_event', event);
    });

    this.docker.on('status_change', (data: Partial<AppInfo>) => {
      if (!data.sessionId || !data.status) return;

      const processInfo = this.processes.get(data.sessionId);
      if (processInfo) {
        processInfo.status = data.status;
        if (data.error) {
          processInfo.error = data.error;
        }

        this.emit('app_status', {
          sessionId: processInfo.sessionId,
          status: processInfo.status,
          clientPort: processInfo.clientPort,
          serverPort: processInfo.serverPort,
          clientUrl: processInfo.clientUrl,
          serverUrl: processInfo.serverUrl,
          error: processInfo.error,
          containerId: processInfo.containerId,
        });
      }
    });
  }

  /**
   * Start an app: create container, install deps, start dev server
   */
  async startApp(sessionId: string, workingDir: string): Promise<ProcessInfo> {
    try {
      if (this.processes.has(sessionId)) {
        const existingProcess = this.processes.get(sessionId);
        if (!existingProcess) {
          throw new Error(`Process state inconsistency for ${sessionId}`);
        }

        if (existingProcess.status === 'failed') {
          console.log(`[Process] Cleaning up failed process ${sessionId} before restart`);
          this.processes.delete(sessionId);
          try {
            await this.docker.destroyContainer(sessionId);
          } catch (_err) {}
        } else {
          const existingStatus = this.docker.getStatus(sessionId);
          if (existingStatus && existingStatus.status !== 'stopped') {
            return existingProcess;
          }
          this.processes.delete(sessionId);
        }
      }

      const appInfo = await this.docker.createContainer(sessionId, workingDir);

      const processInfo: ProcessInfo = {
        ...appInfo,
        workingDir,
        startedAt: Date.now(),
      };
      this.processes.set(sessionId, processInfo);

      this.emit('app_status', appInfo);

      await this.docker.installDependencies(sessionId);

      await this.docker.startDevServer(sessionId);

      const status = this.docker.getStatus(sessionId);
      if (status) {
        processInfo.status = status.status;
        this.emit('app_status', status);
      }

      return processInfo;
    } catch (error) {
      console.error(`[Process] Failed to start app ${sessionId}:`, error);

      const processInfo = this.processes.get(sessionId);
      if (processInfo) {
        processInfo.status = 'failed';
        processInfo.error = String(error);
        this.emit('app_status', {
          sessionId,
          status: 'failed',
          error: String(error),
        });
      }

      throw error;
    }
  }

  /**
   * Stop an app
   */
  async stopApp(sessionId: string): Promise<void> {
    const processInfo = this.processes.get(sessionId);
    if (!processInfo) {
      throw new Error(`App not found: ${sessionId}`);
    }

    await this.docker.destroyContainer(sessionId);
    this.processes.delete(sessionId);

    this.emit('app_status', {
      sessionId,
      status: 'stopped',
    });
  }

  /**
   * Restart an app
   */
  async restartApp(sessionId: string): Promise<ProcessInfo> {
    const processInfo = this.processes.get(sessionId);
    if (!processInfo) {
      throw new Error(`App not found: ${sessionId}`);
    }

    const { workingDir } = processInfo;

    // Stop existing
    await this.stopApp(sessionId);

    // Start new
    return this.startApp(sessionId, workingDir);
  }

  /**
   * Get app status
   */
  getAppStatus(sessionId: string): ProcessInfo | null {
    return this.processes.get(sessionId) || null;
  }

  /**
   * Get app logs
   */
  getAppLogs(sessionId: string): AppLog[] {
    return this.docker.getLogs(sessionId);
  }

  /**
   * List all running apps
   */
  listApps(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Check if Docker is available
   */
  async checkDockerAvailability(): Promise<boolean> {
    return this.docker.checkDockerAvailability();
  }

  /**
   * Initialize (build Docker image)
   */
  async initialize(): Promise<void> {
    await this.docker.buildRunnerImage();
  }

  /**
   * Clean up orphaned containers from previous sessions
   */
  async cleanupOrphanedContainers(): Promise<void> {
    await this.docker.cleanupOrphanedContainers();
  }

  /**
   * Cleanup all apps
   */
  async cleanup(): Promise<void> {
    const promises = Array.from(this.processes.keys()).map((sessionId) =>
      this.stopApp(sessionId).catch((err) =>
        console.error(`Failed to stop app ${sessionId}:`, err),
      ),
    );
    await Promise.all(promises);
  }
}

// Export singleton
export const processService = new ProcessService();
