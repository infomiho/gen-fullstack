/**
 * Docker State Machine Visualization
 *
 * This script demonstrates the state machine and provides several visualization options:
 * 1. Console output showing all states and transitions
 * 2. JSON export for Stately Studio (https://stately.ai/viz)
 * 3. Simulated lifecycle execution with logging
 *
 * Run with: npx tsx src/services/docker.machine.visualize.ts
 */

import { createActor } from 'xstate';
import {
  stateToAppStatus,
  createDockerMachine,
  type CreateContainerOutput,
  type CreateContainerInput,
  type InstallDependenciesInput,
  type StartDevServerInput,
  type HttpReadyCheckInput,
} from './docker.machine.js';

// ============================================================================
// Console Colors for Pretty Output
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function log(color: keyof typeof colors, label: string, message: string) {
  console.log(
    `${colors[color]}${colors.bright}[${label}]${colors.reset} ${colors[color]}${message}${colors.reset}`,
  );
}

// ============================================================================
// Mock Implementations for Visualization
// ============================================================================

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const mockImplementations = {
  actors: {
    createContainer: async (input: CreateContainerInput): Promise<CreateContainerOutput> => {
      log('cyan', 'ACTOR', `Creating container for session ${input.sessionId}`);
      await delay(1000);
      log('green', 'ACTOR', 'Container created successfully');
      return {
        containerId: 'mock-container-id',
        container: {} as any,
        clientPort: 5001,
        serverPort: 5002,
      };
    },
    installDependencies: async (input: InstallDependenciesInput): Promise<void> => {
      log('cyan', 'ACTOR', `Installing dependencies for session ${input.sessionId}`);
      await delay(1500);
      log('green', 'ACTOR', 'Dependencies installed successfully');
    },
    startDevServer: async (input: StartDevServerInput): Promise<void> => {
      log('cyan', 'ACTOR', `Starting dev servers for session ${input.sessionId}`);
      await delay(800);
      log('green', 'ACTOR', 'Dev servers started');
    },
    httpReadyCheck: async (input: HttpReadyCheckInput): Promise<boolean> => {
      log('cyan', 'ACTOR', `Checking HTTP readiness on port ${input.port}`);
      await delay(500);
      log('green', 'ACTOR', 'HTTP server is ready');
      return true;
    },
  },
  actions: {
    emitCreatingStatus: () => log('blue', 'ACTION', 'Emit status: CREATING'),
    emitReadyStatus: () => log('blue', 'ACTION', 'Emit status: READY'),
    emitInstallingStatus: () => log('blue', 'ACTION', 'Emit status: INSTALLING'),
    emitStartingStatus: () => log('blue', 'ACTION', 'Emit status: STARTING'),
    emitRunningStatus: () => log('blue', 'ACTION', 'Emit status: RUNNING'),
    emitStoppedStatus: () => log('blue', 'ACTION', 'Emit status: STOPPED'),
    emitFailedStatus: () => log('blue', 'ACTION', 'Emit status: FAILED'),
    cleanupCreatingStreams: () => log('yellow', 'CLEANUP', 'Cleaning up creating streams'),
    cleanupInstallStreams: () => log('yellow', 'CLEANUP', 'Cleaning up install streams'),
    cleanupStartStreams: () => log('yellow', 'CLEANUP', 'Cleaning up start streams'),
    cleanupRunningStreams: () => log('yellow', 'CLEANUP', 'Cleaning up running streams'),
    cleanupAllResources: () => log('yellow', 'CLEANUP', 'Cleaning up ALL resources'),
  },
};

// ============================================================================
// Visualization Functions
// ============================================================================

function printMachineInfo() {
  console.log('\n' + '='.repeat(80));
  console.log(colors.bright + colors.cyan + 'Docker Container State Machine' + colors.reset);
  console.log('='.repeat(80) + '\n');

  console.log(colors.bright + 'States:' + colors.reset);
  const states = [
    { name: 'idle', desc: 'Initial state, waiting for CREATE event' },
    { name: 'creating', desc: 'Building image, creating container' },
    { name: 'ready', desc: 'Container created, ready for commands' },
    { name: 'installing', desc: 'Installing dependencies (npm install + Prisma)' },
    { name: 'starting', desc: 'Starting dev servers (client + server)' },
    { name: 'waitingForVite', desc: 'Waiting for Vite "ready" message' },
    { name: 'checkingHttpReady', desc: 'Polling HTTP endpoint for readiness' },
    { name: 'running', desc: 'Dev servers active and accepting connections' },
    { name: 'stopped', desc: 'Container destroyed (final state)' },
    { name: 'failed', desc: 'Error occurred (final state)' },
  ];

  states.forEach((state) => {
    const appStatus = stateToAppStatus(state.name);
    console.log(
      `  ${colors.green}${state.name.padEnd(20)}${colors.reset} → ${colors.dim}${state.desc}${colors.reset} ${colors.yellow}(AppStatus: ${appStatus})${colors.reset}`,
    );
  });

  console.log('\n' + colors.bright + 'Events:' + colors.reset);
  const events = [
    { name: 'CREATE', desc: 'Start container creation' },
    { name: 'INSTALL_DEPS', desc: 'Begin dependency installation' },
    { name: 'START_SERVER', desc: 'Start dev servers' },
    { name: 'VITE_READY', desc: 'Vite reports ready' },
    { name: 'HTTP_READY', desc: 'HTTP health check passed' },
    { name: 'STOP_SERVER', desc: 'Stop dev servers (keep container)' },
    { name: 'DESTROY', desc: 'Destroy container' },
    { name: 'ERROR', desc: 'Handle errors' },
  ];

  events.forEach((event) => {
    console.log(
      `  ${colors.magenta}${event.name.padEnd(20)}${colors.reset} → ${colors.dim}${event.desc}${colors.reset}`,
    );
  });

  console.log('\n' + colors.bright + 'State Flow (Happy Path):' + colors.reset);
  console.log(
    `  ${colors.green}idle${colors.reset} → ${colors.green}creating${colors.reset} → ${colors.green}ready${colors.reset} → ${colors.green}installing${colors.reset} → ${colors.green}starting${colors.reset} → ${colors.green}waitingForVite${colors.reset} → ${colors.green}checkingHttpReady${colors.reset} → ${colors.green}running${colors.reset}`,
  );

  console.log('\n');
}

async function simulateLifecycle() {
  console.log('='.repeat(80));
  console.log(colors.bright + colors.green + 'Simulating Container Lifecycle' + colors.reset);
  console.log('='.repeat(80) + '\n');

  // Create configured machine with mock implementations
  const machine = createDockerMachine(mockImplementations);

  // Create actor instance
  const actor = createActor(machine, {
    input: {
      sessionId: 'demo-session-123',
      workingDir: '/tmp/demo-app',
    },
  });

  // Subscribe to state changes
  actor.subscribe((snapshot) => {
    const stateValue =
      typeof snapshot.value === 'string' ? snapshot.value : JSON.stringify(snapshot.value);
    const appStatus = stateToAppStatus(stateValue);

    log('magenta', 'STATE', `${stateValue.padEnd(20)} (AppStatus: ${appStatus})`);

    if (snapshot.context.containerId) {
      log('dim', 'CONTEXT', `Container ID: ${snapshot.context.containerId}`);
    }
    if (snapshot.context.clientPort) {
      log(
        'dim',
        'CONTEXT',
        `Ports: client=${snapshot.context.clientPort}, server=${snapshot.context.serverPort}`,
      );
    }
    if (snapshot.context.error) {
      log('red', 'ERROR', snapshot.context.error);
    }
  });

  // Start the actor
  log('yellow', 'SYSTEM', 'Starting state machine...\n');
  actor.start();

  // Simulate the lifecycle
  log('yellow', 'SYSTEM', 'Sending CREATE event...\n');
  actor.send({ type: 'CREATE', sessionId: 'demo-session-123', workingDir: '/tmp/demo-app' });

  // Wait for container to be ready
  await delay(1200);

  log('yellow', '\nSYSTEM', 'Sending INSTALL_DEPS event...\n');
  actor.send({ type: 'INSTALL_DEPS' });

  // Wait for installation
  await delay(1700);

  log('yellow', '\nSYSTEM', 'Sending START_SERVER event...\n');
  actor.send({ type: 'START_SERVER' });

  // Wait for dev server to start
  await delay(1000);

  log('yellow', '\nSYSTEM', 'Sending VITE_READY event...\n');
  actor.send({ type: 'VITE_READY' });

  // Wait for HTTP ready check
  await delay(700);

  log('yellow', '\nSYSTEM', 'Container is now RUNNING! 🎉\n');
  await delay(1000);

  log('yellow', '\nSYSTEM', 'Sending DESTROY event...\n');
  actor.send({ type: 'DESTROY' });

  await delay(200);

  console.log('\n' + '='.repeat(80));
  log('green', 'DONE', 'Lifecycle simulation complete!');
  console.log('='.repeat(80) + '\n');
}

function printVisualizerInstructions() {
  console.log('='.repeat(80));
  console.log(colors.bright + colors.cyan + 'Visualize in Stately Studio' + colors.reset);
  console.log('='.repeat(80) + '\n');

  console.log('To visualize this state machine in Stately Studio:');
  console.log('');
  console.log('1. Open: ' + colors.cyan + 'https://stately.ai/viz' + colors.reset);
  console.log('2. Click "Import" or paste the machine code');
  console.log('3. View the interactive state chart');
  console.log('4. Simulate transitions by clicking states/events');
  console.log('');
  console.log('The machine definition is in:');
  console.log('  ' + colors.yellow + 'server/src/services/docker.machine.ts' + colors.reset);
  console.log('');
  console.log('You can also use the XState VS Code extension for inline visualization!');
  console.log('');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.clear();

  printMachineInfo();
  printVisualizerInstructions();

  const shouldSimulate = process.argv.includes('--simulate');

  if (shouldSimulate) {
    await simulateLifecycle();
  } else {
    console.log('='.repeat(80));
    console.log(
      colors.yellow + 'To run a simulated lifecycle, add the --simulate flag:' + colors.reset,
    );
    console.log(
      colors.dim + '  npx tsx src/services/docker.machine.visualize.ts --simulate' + colors.reset,
    );
    console.log('='.repeat(80) + '\n');
  }
}

main().catch(console.error);
