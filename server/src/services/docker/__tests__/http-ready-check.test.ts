/**
 * Tests for HTTP Ready Check Module
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkHttpReady } from '../http-ready-check.js';

describe('checkHttpReady', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    vi.unstubAllGlobals();
  });

  it('should return true when server responds immediately', async () => {
    // Mock global fetch to succeed
    global.fetch = vi.fn().mockResolvedValueOnce(new Response());

    const ready = await checkHttpReady(5173);

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

    const ready = await checkHttpReady(5173);

    expect(ready).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should return false after all retries fail', async () => {
    // Mock fetch to always fail
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const ready = await checkHttpReady(5173);

    expect(ready).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(10); // maxAttempts from HTTP_READY_CHECK
  });

  it('should accept 404 responses as ready', async () => {
    // Mock fetch to return 404 (which means server is listening)
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }));

    const ready = await checkHttpReady(5173);

    expect(ready).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should accept any HTTP response as ready', async () => {
    // Mock fetch to return 500 (server error, but server is listening)
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));

    const ready = await checkHttpReady(5173);

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

    const readyPromise = checkHttpReady(5173);

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

    const ready = await checkHttpReady(5173);

    expect(ready).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(10);
  });

  it('should return false when signal is already aborted', async () => {
    // Mock fetch to always succeed (but we shouldn't even call it)
    global.fetch = vi.fn().mockResolvedValue(new Response());

    const abortController = new AbortController();
    abortController.abort(); // Abort before calling

    const ready = await checkHttpReady(5173, abortController.signal);

    expect(ready).toBe(false);
    // Should not make any fetch calls since signal was already aborted
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
