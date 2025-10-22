/**
 * Port Manager
 *
 * Manages host port allocation for Docker containers.
 * Ensures no port conflicts by tracking active port assignments.
 */

import type { ContainerInfo } from './types.js';

/**
 * Port Manager for Docker service
 *
 * Allocates available ports from a range, ensuring no conflicts
 * between client and server ports for running containers.
 */
export class PortManager {
  constructor(
    private containers: Map<string, ContainerInfo>,
    private portRangeStart: number,
    private portRangeEnd: number,
  ) {}

  /**
   * Find an available port in the range, optionally excluding a specific port
   *
   * @param exclude - Optional port to exclude from search
   * @returns Available port number
   * @throws Error if no ports are available
   */
  private findAvailablePort(exclude?: number): number {
    for (let port = this.portRangeStart; port <= this.portRangeEnd; port++) {
      if (port === exclude) {
        continue; // Skip excluded port
      }
      const isAvailable = ![...this.containers.values()].some(
        (c) => c.clientPort === port || c.serverPort === port,
      );
      if (isAvailable) {
        return port;
      }
    }
    throw new Error(`No available ports in range ${this.portRangeStart}-${this.portRangeEnd}`);
  }

  /**
   * Find two distinct available ports for client and server
   *
   * Ensures clientPort !== serverPort to avoid bind conflicts.
   *
   * @returns Tuple of [clientPort, serverPort]
   * @throws Error if insufficient ports are available
   */
  findTwoAvailablePorts(): [number, number] {
    const clientPort = this.findAvailablePort();
    const serverPort = this.findAvailablePort(clientPort);
    return [clientPort, serverPort];
  }
}
