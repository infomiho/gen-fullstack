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

    it('formats getFileTree summary', () => {
      const result = getToolSummary('getFileTree', {});
      expect(result).toBe('Getting file tree');
    });

    it('formats executeCommand summary', () => {
      const result = getToolSummary('executeCommand', { command: 'npm install' });
      expect(result).toBe('npm install');
    });

    it('formats executeCommand with unknown command', () => {
      const result = getToolSummary('executeCommand', {});
      expect(result).toBe('unknown command');
    });

    it('formats requestBlock summary', () => {
      const result = getToolSummary('requestBlock', { blockId: 'auth-password' });
      expect(result).toBe('Asking for auth-password');
    });

    it('formats requestBlock with unknown block', () => {
      const result = getToolSummary('requestBlock', {});
      expect(result).toBe('Asking for unknown block');
    });

    it('formats planArchitecture with all parts', () => {
      const result = getToolSummary('planArchitecture', {
        databaseModels: [{}, {}],
        apiRoutes: [{}, {}, {}],
        clientComponents: [{}],
      });
      expect(result).toBe('Planning: 2 models, 3 routes, 1 components');
    });

    it('formats planArchitecture with only models', () => {
      const result = getToolSummary('planArchitecture', {
        databaseModels: [{}, {}, {}],
        apiRoutes: [],
        clientComponents: [],
      });
      expect(result).toBe('Planning: 3 models');
    });

    it('formats planArchitecture with only routes', () => {
      const result = getToolSummary('planArchitecture', {
        databaseModels: [],
        apiRoutes: [{}, {}],
        clientComponents: [],
      });
      expect(result).toBe('Planning: 2 routes');
    });

    it('formats planArchitecture with only components', () => {
      const result = getToolSummary('planArchitecture', {
        databaseModels: [],
        apiRoutes: [],
        clientComponents: [{}, {}, {}, {}],
      });
      expect(result).toBe('Planning: 4 components');
    });

    it('formats planArchitecture with models and routes', () => {
      const result = getToolSummary('planArchitecture', {
        databaseModels: [{}],
        apiRoutes: [{}],
        clientComponents: [],
      });
      expect(result).toBe('Planning: 1 models, 1 routes');
    });

    it('formats planArchitecture with empty arrays', () => {
      const result = getToolSummary('planArchitecture', {
        databaseModels: [],
        apiRoutes: [],
        clientComponents: [],
      });
      expect(result).toBe('Planning: ');
    });

    it('formats installNpmDep with dependencies only', () => {
      const result = getToolSummary('installNpmDep', {
        target: 'client',
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
        devDependencies: {},
      });
      expect(result).toBe('Installing to client: 2 deps');
    });

    it('formats installNpmDep with single dependency', () => {
      const result = getToolSummary('installNpmDep', {
        target: 'server',
        dependencies: { express: '^5.0.0' },
        devDependencies: {},
      });
      expect(result).toBe('Installing to server: 1 dep');
    });

    it('formats installNpmDep with devDependencies only', () => {
      const result = getToolSummary('installNpmDep', {
        target: 'client',
        dependencies: {},
        devDependencies: { typescript: '^5.0.0', vitest: '^3.0.0' },
      });
      expect(result).toBe('Installing to client: 2 devDeps');
    });

    it('formats installNpmDep with single devDependency', () => {
      const result = getToolSummary('installNpmDep', {
        target: 'server',
        dependencies: {},
        devDependencies: { '@types/node': '^20.0.0' },
      });
      expect(result).toBe('Installing to server: 1 devDep');
    });

    it('formats installNpmDep with both dependencies and devDependencies', () => {
      const result = getToolSummary('installNpmDep', {
        target: 'root',
        dependencies: { concurrently: '^8.0.0' },
        devDependencies: { prettier: '^3.0.0', eslint: '^8.0.0' },
      });
      expect(result).toBe('Installing to root: 1 dep, 2 devDeps');
    });

    it('formats installNpmDep with unknown target', () => {
      const result = getToolSummary('installNpmDep', {
        dependencies: { react: '^18.0.0' },
        devDependencies: {},
      });
      expect(result).toBe('Installing to unknown: 1 dep');
    });

    it('formats installNpmDep with no dependencies', () => {
      const result = getToolSummary('installNpmDep', {
        target: 'client',
        dependencies: {},
        devDependencies: {},
      });
      expect(result).toBe('Installing to client: ');
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
