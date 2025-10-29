/**
 * Tests for HTTP Ready Check Module
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dockerLogger } from '../../../lib/logger.js';
import { checkHttpReady } from '../http-ready-check.js';

describe('checkHttpReady', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should return true when server responds immediately', async () => {
    // Mock global fetch to succeed
    global.fetch = vi.fn().mockResolvedValueOnce(new Response());

    const ready = await checkHttpReady(5173, 'client');

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

    const ready = await checkHttpReady(5173, 'client');

    expect(ready).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should return false after all retries fail', async () => {
    // Mock fetch to always fail
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const ready = await checkHttpReady(5173, 'server');

    expect(ready).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(10); // maxAttempts from HTTP_READY_CHECK
  }, 10000); // Increase timeout to 10s (10 attempts × 500ms delay = 5000ms + request overhead)

  it('should accept 404 responses as ready', async () => {
    // Mock fetch to return 404 (which means server is listening)
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }));

    const ready = await checkHttpReady(5173, 'client');

    expect(ready).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should accept any HTTP response as ready', async () => {
    // Mock fetch to return 500 (server error, but server is listening)
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));

    const ready = await checkHttpReady(5173, 'client');

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

    const readyPromise = checkHttpReady(5173, 'client');

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

    const ready = await checkHttpReady(5173, 'server');

    expect(ready).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(10);
  });

  it('should return false when signal is already aborted', async () => {
    // Mock fetch to always succeed (but we shouldn't even call it)
    global.fetch = vi.fn().mockResolvedValue(new Response());

    const abortController = new AbortController();
    abortController.abort(); // Abort before calling

    const ready = await checkHttpReady(5173, 'client', abortController.signal);

    expect(ready).toBe(false);
    // Should not make any fetch calls since signal was already aborted
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should log service name on success', async () => {
    // Mock global fetch to succeed
    global.fetch = vi.fn().mockResolvedValueOnce(new Response());
    const logSpy = vi.spyOn(dockerLogger, 'info');

    await checkHttpReady(5173, 'client');

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: 'client' }),
      expect.stringContaining('client'),
    );
  });

  it('should log service name on failure', async () => {
    // Mock fetch to always fail
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const errorSpy = vi.spyOn(dockerLogger, 'error');

    await checkHttpReady(3000, 'server');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: 'server' }),
      expect.stringContaining('server'),
    );
  });

  it('should distinguish between client and server in logs', async () => {
    // Mock global fetch to succeed
    global.fetch = vi.fn().mockResolvedValue(new Response());
    const logSpy = vi.spyOn(dockerLogger, 'info');

    // Check client
    await checkHttpReady(5173, 'client');
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: 'client', port: 5173 }),
      expect.stringContaining('client'),
    );

    logSpy.mockClear();

    // Check server
    await checkHttpReady(3000, 'server');
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: 'server', port: 3000 }),
      expect.stringContaining('server'),
    );
  });
});
