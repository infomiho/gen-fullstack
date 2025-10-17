import { describe, expect, it } from 'vitest';
import { getToolSummary, truncate } from './tool-utils';

describe('tool-utils', () => {
  describe('getToolSummary', () => {
    it('returns "Loading..." for undefined args', () => {
      const result = getToolSummary('writeFile', undefined);
      expect(result).toBe('Loading...');
    });

    it('formats writeFile summary', () => {
      const result = getToolSummary('writeFile', { path: 'src/App.tsx' });
      expect(result).toBe('Writing to src/App.tsx');
    });

    it('formats writeFile with unknown path', () => {
      const result = getToolSummary('writeFile', {});
      expect(result).toBe('Writing to unknown');
    });

    it('formats readFile summary', () => {
      const result = getToolSummary('readFile', { path: 'package.json' });
      expect(result).toBe('Reading package.json');
    });

    it('formats readFile with unknown path', () => {
      const result = getToolSummary('readFile', {});
      expect(result).toBe('Reading unknown');
    });

    it('formats listFiles summary', () => {
      const result = getToolSummary('listFiles', { directory: 'src/components' });
      expect(result).toBe('Listing src/components');
    });

    it('formats listFiles with default directory', () => {
      const result = getToolSummary('listFiles', {});
      expect(result).toBe('Listing .');
    });

    it('formats executeCommand summary', () => {
      const result = getToolSummary('executeCommand', { command: 'npm install' });
      expect(result).toBe('npm install');
    });

    it('formats executeCommand with unknown command', () => {
      const result = getToolSummary('executeCommand', {});
      expect(result).toBe('unknown command');
    });

    it('returns default for unknown tool', () => {
      const result = getToolSummary('unknownTool', { foo: 'bar' });
      expect(result).toBe('Click for details');
    });
  });

  describe('truncate', () => {
    it('returns string as-is if shorter than maxLength', () => {
      const result = truncate('Hello', 10);
      expect(result).toBe('Hello');
    });

    it('returns string as-is if equal to maxLength', () => {
      const result = truncate('Hello', 5);
      expect(result).toBe('Hello');
    });

    it('truncates string longer than maxLength', () => {
      const result = truncate('Hello world', 5);
      expect(result).toBe('Hello...');
    });

    it('truncates long text correctly', () => {
      const result = truncate('This is a very long string that needs truncation', 10);
      expect(result).toBe('This is a ...');
    });

    it('handles empty string', () => {
      const result = truncate('', 10);
      expect(result).toBe('');
    });

    it('handles maxLength of 0', () => {
      const result = truncate('Hello', 0);
      expect(result).toBe('...');
    });
  });
});
