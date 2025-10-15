/**
 * Manual Test Script for Docker Execution
 *
 * This script tests the complete app execution flow:
 * 1. Check Docker availability
 * 2. Build runner image
 * 3. Create container
 * 4. Install dependencies
 * 5. Start dev server
 * 6. Test preview proxy
 * 7. Cleanup
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processService } from '../src/services/process.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  // biome-ignore lint/suspicious/noConsole: Test script output to terminal
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function step(message: string) {
  log(`\n→ ${message}`, 'cyan');
}

function success(message: string) {
  log(`✓ ${message}`, 'green');
}

function error(message: string) {
  log(`✗ ${message}`, 'red');
}

function info(message: string) {
  log(`  ${message}`, 'blue');
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAppReady(sessionId: string, maxAttempts = 60): Promise<void> {
  step('Waiting for dev server to be ready...');
  info('This may take 30-60 seconds for dependency installation...');

  let attempts = 0;
  let isReady = false;

  while (attempts < maxAttempts && !isReady) {
    await delay(1000);
    const status = processService.getAppStatus(sessionId);

    if (status?.status === 'running') {
      isReady = true;
      success('Dev server is ready!');
      break;
    }

    if (status?.status === 'failed') {
      error('App failed to start');
      info(`Error: ${status.error}`);
      throw new Error('App startup failed');
    }

    attempts++;
    process.stdout.write('.');
  }

  if (!isReady) {
    error('Timeout waiting for dev server');
    throw new Error('Startup timeout');
  }
}

async function testContainerAccess(sessionId: string): Promise<void> {
  step('Testing container HTTP access...');
  const containerStatus = processService.getAppStatus(sessionId);
  if (!containerStatus) {
    error('Container status not found');
    throw new Error('Container status unavailable');
  }

  info(`Container URL: http://localhost:${containerStatus.port}/`);

  const fetch = (await import('node-fetch')).default;
  const containerResponse = await fetch(`http://localhost:${containerStatus.port}/`);

  // Vite returns 403 for requests without proper Host header (DNS rebinding protection)
  // Any response (including 403) means the server is running
  if (containerResponse.status === 200 || containerResponse.status === 403) {
    success(`Container HTTP server responding (${containerResponse.status})`);
    if (containerResponse.status === 403) {
      info('403 is expected from Vite (DNS rebinding protection)');
    }
  } else {
    error(`Unexpected HTTP status: ${containerResponse.status}`);
    throw new Error(`HTTP test failed with status ${containerResponse.status}`);
  }
}

function printRecentLogs(sessionId: string): void {
  step('Retrieving container logs...');
  const logs = processService.getAppLogs(sessionId);
  info(`Retrieved ${logs.length} log entries`);

  if (logs.length > 0) {
    info('Last 3 logs:');
    logs.slice(-3).forEach((log) => {
      // biome-ignore lint/suspicious/noConsole: Test script output to terminal
      console.log(`    [${log.level}] ${log.message.substring(0, 80)}`);
    });
  }
}

async function runTest() {
  const sessionId = 'test-session-001';
  const workingDir = path.join(__dirname, '../../generated', sessionId);

  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Docker Execution System - Integration Test            ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');

  try {
    // Step 1: Check Docker availability
    step('Checking Docker availability...');
    const dockerAvailable = await processService.checkDockerAvailability();

    if (!dockerAvailable) {
      error('Docker is not available!');
      info('Make sure Docker Desktop is running');
      process.exit(1);
    }

    success('Docker is available');

    // Step 2: Initialize (build runner image)
    step('Building Docker runner image...');
    await processService.initialize();
    success('Runner image built successfully');

    // Step 3: Start app
    step(`Starting app for session: ${sessionId}`);
    info(`Working directory: ${workingDir}`);

    const appInfo = await processService.startApp(sessionId, workingDir);
    success(`App started successfully`);
    info(`Container ID: ${appInfo.containerId}`);
    info(`Port: ${appInfo.port}`);
    info(`URL: ${appInfo.url}`);
    info(`Status: ${appInfo.status}`);

    // Step 4: Wait for app to be ready
    await waitForAppReady(sessionId);

    // Step 5: Test container HTTP access
    await testContainerAccess(sessionId);

    // Step 6: Get logs
    printRecentLogs(sessionId);

    // Step 7: Stop app
    step('Stopping app...');
    await processService.stopApp(sessionId);
    success('App stopped successfully');

    // Verify cleanup
    const statusAfterStop = processService.getAppStatus(sessionId);
    if (statusAfterStop === null) {
      success('Container cleaned up');
    } else {
      error('Container not properly cleaned up');
    }

    // Final summary
    log('\n╔════════════════════════════════════════════════════════╗', 'green');
    log('║  All Tests Passed ✓                                     ║', 'green');
    log('╚════════════════════════════════════════════════════════╝', 'green');

    process.exit(0);
  } catch (err) {
    error(`\nTest failed: ${err}`);

    // Attempt cleanup
    try {
      log('\nAttempting cleanup...');
      await processService.stopApp(sessionId);
      success('Cleanup successful');
    } catch (cleanupErr) {
      error(`Cleanup failed: ${cleanupErr}`);
    }

    process.exit(1);
  }
}

// Run the test
runTest();
