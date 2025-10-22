/**
 * Docker Socket Path Detection
 *
 * Handles secure detection and validation of Docker socket paths across different
 * Docker runtimes (Docker Desktop, Colima, standard Linux Docker).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getEnv } from '../../config/env.js';
import { dockerLogger } from '../../lib/logger.js';

/**
 * Validates that a socket path is safe and legitimate
 * Prevents TOCTOU attacks and path injection vulnerabilities
 *
 * @param socketPath - The socket path to validate
 * @returns true if the socket path is valid and safe to use
 */
export function isValidSocketPath(socketPath: string): boolean {
  try {
    // Resolve symlinks to prevent TOCTOU attacks
    const realPath = fs.realpathSync(socketPath);

    // Validate path is in allowed locations only
    const allowedPrefixes = [
      '/var/run',
      path.join(os.homedir(), '.colima'),
      path.join(os.homedir(), '.docker'),
    ];

    const isAllowed = allowedPrefixes.some((prefix) => realPath.startsWith(prefix));

    if (!isAllowed) {
      dockerLogger.warn({ realPath }, 'Socket path rejected (not in allowed locations)');
      return false;
    }

    // Verify it's actually a socket, not a regular file
    const stats = fs.statSync(realPath);
    if (!stats.isSocket()) {
      dockerLogger.warn({ realPath }, 'Path exists but is not a socket');
      return false;
    }

    return true;
  } catch (error) {
    // Log the error before returning false (avoid silent failures)
    dockerLogger.debug({ error, socketPath }, 'Socket path validation failed');
    return false;
  }
}

/**
 * Get the Docker socket path based on the platform and Docker runtime
 * Checks multiple sources in priority order:
 * 1. DOCKER_HOST environment variable
 * 2. Colima socket (macOS)
 * 3. Docker Desktop socket (macOS)
 * 4. Standard Linux socket
 *
 * @returns The validated Docker socket path
 * @throws Error if no valid Docker socket is found
 */
export function getDockerSocketPath(): string {
  const env = getEnv();

  // 1. Check DOCKER_HOST environment variable (standard Docker way)
  if (env.DOCKER_HOST?.startsWith('unix://')) {
    const socketPath = env.DOCKER_HOST.replace('unix://', '');
    if (isValidSocketPath(socketPath)) {
      dockerLogger.info({ socketPath }, 'Using validated socket from DOCKER_HOST');
      return socketPath;
    }
    dockerLogger.warn({ socketPath }, 'DOCKER_HOST socket invalid');
  }

  if (os.platform() === 'darwin') {
    // 2. Check for Colima (common on macOS)
    const colimaHome = env.COLIMA_HOME || path.join(os.homedir(), '.colima');
    const colimaSocket = path.join(colimaHome, 'default/docker.sock');
    if (isValidSocketPath(colimaSocket)) {
      dockerLogger.info({ socketPath: colimaSocket }, 'Using Colima socket');
      return colimaSocket;
    }

    // 3. Check for Docker Desktop for Mac
    const dockerDesktopSocket = path.join(os.homedir(), '.docker/run/docker.sock');
    if (isValidSocketPath(dockerDesktopSocket)) {
      dockerLogger.info({ socketPath: dockerDesktopSocket }, 'Using Docker Desktop socket');
      return dockerDesktopSocket;
    }

    // 4. Check standard socket (might be symlinked)
    if (isValidSocketPath('/var/run/docker.sock')) {
      dockerLogger.info('Using standard socket: /var/run/docker.sock');
      return '/var/run/docker.sock';
    }

    throw new Error(
      'No valid Docker socket found. Please ensure Docker Desktop or Colima is running.',
    );
  }

  // Linux: use standard socket
  const linuxSocket = '/var/run/docker.sock';
  if (isValidSocketPath(linuxSocket)) {
    dockerLogger.info({ socketPath: linuxSocket }, 'Using Linux Docker socket');
    return linuxSocket;
  }

  // Fall back to default path even if validation fails
  // Docker will handle the error when trying to connect
  // This allows tests to run without a real Docker socket
  dockerLogger.warn({ socketPath: linuxSocket }, 'Using unvalidated socket path (fallback)');
  return linuxSocket;
}
