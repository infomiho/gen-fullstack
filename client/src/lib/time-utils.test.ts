import { describe, expect, it } from 'vitest';
import { formatTime, formatTimestamp, getRelativeTime } from './time-utils';

describe('time-utils', () => {
  describe('formatTimestamp', () => {
    it('formats timestamp to HH:MM:SS.mmm', () => {
      // January 1, 2024, 14:30:45.123
      const timestamp = new Date(2024, 0, 1, 14, 30, 45, 123).getTime();
      const result = formatTimestamp(timestamp);
      expect(result).toBe('14:30:45.123');
    });

    it('pads single digits with zeros', () => {
      // January 1, 2024, 09:05:03.007
      const timestamp = new Date(2024, 0, 1, 9, 5, 3, 7).getTime();
      const result = formatTimestamp(timestamp);
      expect(result).toBe('09:05:03.007');
    });

    it('handles midnight correctly', () => {
      // January 1, 2024, 00:00:00.000
      const timestamp = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const result = formatTimestamp(timestamp);
      expect(result).toBe('00:00:00.000');
    });

    it('handles noon correctly', () => {
      // January 1, 2024, 12:00:00.000
      const timestamp = new Date(2024, 0, 1, 12, 0, 0, 0).getTime();
      const result = formatTimestamp(timestamp);
      expect(result).toBe('12:00:00.000');
    });

    it('handles 999 milliseconds correctly', () => {
      const timestamp = new Date(2024, 0, 1, 12, 0, 0, 999).getTime();
      const result = formatTimestamp(timestamp);
      expect(result).toBe('12:00:00.999');
    });
  });

  describe('formatTime', () => {
    it('formats Date to HH:MM:SS', () => {
      const date = new Date(2024, 0, 1, 14, 30, 45, 123);
      const result = formatTime(date);
      expect(result).toBe('14:30:45');
    });

    it('pads single digits with zeros', () => {
      const date = new Date(2024, 0, 1, 9, 5, 3);
      const result = formatTime(date);
      expect(result).toBe('09:05:03');
    });

    it('does not include milliseconds', () => {
      const date = new Date(2024, 0, 1, 14, 30, 45, 999);
      const result = formatTime(date);
      expect(result).toBe('14:30:45');
    });
  });

  describe('getRelativeTime', () => {
    const now = Date.now();

    it('formats seconds ago', () => {
      expect(getRelativeTime(now - 5000)).toBe('5s ago');
      expect(getRelativeTime(now - 30000)).toBe('30s ago');
      expect(getRelativeTime(now - 59000)).toBe('59s ago');
    });

    it('formats minutes ago', () => {
      expect(getRelativeTime(now - 60000)).toBe('1m ago');
      expect(getRelativeTime(now - 120000)).toBe('2m ago');
      expect(getRelativeTime(now - 3540000)).toBe('59m ago');
    });

    it('formats hours ago', () => {
      expect(getRelativeTime(now - 3600000)).toBe('1h ago');
      expect(getRelativeTime(now - 7200000)).toBe('2h ago');
      expect(getRelativeTime(now - 86340000)).toBe('23h ago');
    });

    it('formats days ago', () => {
      expect(getRelativeTime(now - 86400000)).toBe('1d ago');
      expect(getRelativeTime(now - 172800000)).toBe('2d ago');
      expect(getRelativeTime(now - 604800000)).toBe('7d ago');
    });

    it('handles 0 seconds', () => {
      expect(getRelativeTime(now)).toBe('0s ago');
    });
  });
});
