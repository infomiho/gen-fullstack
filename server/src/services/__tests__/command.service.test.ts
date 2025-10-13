import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeCommand } from '../command.service.js';
import { initializeSandbox, cleanupSandbox } from '../filesystem.service.js';

describe('Command Service', () => {
  const sessionId = 'test-session-cmd-123';

  beforeEach(async () => {
    await initializeSandbox(sessionId);
  });

  afterEach(async () => {
    await cleanupSandbox(sessionId);
  });

  describe('Whitelisted commands', () => {
    it('should execute echo command', async () => {
      const result = await executeCommand(sessionId, 'echo "Hello, World!"');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello, World!');
    });

    it('should execute pwd command', async () => {
      const result = await executeCommand(sessionId, 'pwd');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('generated');
      expect(result.stdout).toContain(sessionId);
    });

    it('should execute ls command', async () => {
      const result = await executeCommand(sessionId, 'ls');
      expect(result.success).toBe(true);
    });

    it('should execute mkdir command', async () => {
      const result = await executeCommand(sessionId, 'mkdir test-dir');
      expect(result.success).toBe(true);

      // Verify directory was created
      const lsResult = await executeCommand(sessionId, 'ls');
      expect(lsResult.success).toBe(true);
      expect(lsResult.stdout).toContain('test-dir');
    });

    it('should execute node command', async () => {
      const result = await executeCommand(sessionId, 'node --version');
      expect(result.success).toBe(true);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
    });

    it('should execute npm command', async () => {
      const result = await executeCommand(sessionId, 'npm --version');
      expect(result.success).toBe(true);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should execute pnpm command', async () => {
      const result = await executeCommand(sessionId, 'pnpm --version');
      expect(result.success).toBe(true);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Command validation', () => {
    const nonWhitelistedCommands = [
      'curl https://malicious.com',
      'wget http://evil.com',
      'ssh user@server',
      'scp file.txt user@server:',
      'git clone https://repo.git',
      'docker run ubuntu',
      'sudo rm -rf /',
      'chmod 777 file.txt',
      'chown root file.txt',
    ];

    nonWhitelistedCommands.forEach((cmd) => {
      it(`should reject non-whitelisted command: ${cmd}`, async () => {
        await expect(
          executeCommand(sessionId, cmd)
        ).rejects.toThrow('not whitelisted');
      });
    });
  });

  describe('Command chaining prevention', () => {
    it('should reject commands with &&', async () => {
      await expect(
        executeCommand(sessionId, 'echo "test" && echo "chained"')
      ).rejects.toThrow('chaining');
    });

    it('should reject commands with ||', async () => {
      await expect(
        executeCommand(sessionId, 'echo "test" || echo "fallback"')
      ).rejects.toThrow('chaining');
    });

    it('should reject commands with semicolon', async () => {
      await expect(
        executeCommand(sessionId, 'echo "test"; echo "another"')
      ).rejects.toThrow('chaining');
    });

    it('should reject commands with pipe operator', async () => {
      await expect(
        executeCommand(sessionId, 'echo "test" | grep test')
      ).rejects.toThrow('Pipe operator');
    });

    it('should reject commands with backticks', async () => {
      await expect(
        executeCommand(sessionId, 'echo `whoami`')
      ).rejects.toThrow('substitution');
    });

    it('should reject commands with $() substitution', async () => {
      await expect(
        executeCommand(sessionId, 'echo $(whoami)')
      ).rejects.toThrow('substitution');
    });
  });

  describe('Command timeout', () => {
    it('should timeout long-running commands', async () => {
      const result = await executeCommand(sessionId, 'node -e "while(true){}"');
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('timed out');
    }, 130000); // 130 seconds to account for 120s timeout + overhead

    it('should complete fast commands before timeout', async () => {
      const result = await executeCommand(sessionId, 'echo "fast"');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('fast');
    });
  });

  describe('Command output handling', () => {
    it('should capture stdout', async () => {
      const result = await executeCommand(sessionId, 'echo "stdout test"');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('stdout test');
    });

    it('should capture stderr', async () => {
      // ls on non-existent file writes to stderr
      const result = await executeCommand(sessionId, 'ls nonexistent-file-xyz');
      expect(result.success).toBe(false);
      expect(result.stderr).toBeTruthy();
    });

    it('should truncate very long output', async () => {
      // Generate output longer than 50K chars
      const result = await executeCommand(
        sessionId,
        'node -e "console.log(\\"x\\".repeat(60000))"'
      );

      expect(result.stdout.length).toBeLessThanOrEqual(50000 + 100); // Allow small buffer
    });

    it('should handle commands with no output', async () => {
      const result = await executeCommand(sessionId, 'mkdir -p empty-test');
      expect(result.success).toBe(true);
    });
  });

  describe('Working directory', () => {
    it('should execute commands in sandbox directory', async () => {
      const result = await executeCommand(sessionId, 'pwd');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('generated');
      expect(result.stdout).toContain(sessionId);
    });

    it('should maintain working directory across commands', async () => {
      await executeCommand(sessionId, 'mkdir test-dir');
      const lsResult = await executeCommand(sessionId, 'ls');

      expect(lsResult.success).toBe(true);
      expect(lsResult.stdout).toContain('test-dir');
    });
  });

  describe('Command arguments', () => {
    it('should handle commands with flags', async () => {
      const result = await executeCommand(sessionId, 'ls -la');
      expect(result.success).toBe(true);
    });

    it('should handle commands with multiple arguments', async () => {
      const result = await executeCommand(
        sessionId,
        'echo "arg1" "arg2" "arg3"'
      );
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('arg1');
      expect(result.stdout).toContain('arg2');
      expect(result.stdout).toContain('arg3');
    });

    it('should handle quoted arguments with spaces', async () => {
      const result = await executeCommand(
        sessionId,
        'echo "Hello World with spaces"'
      );
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello World with spaces');
    });
  });

  describe('Error handling', () => {
    it('should return error for command failures', async () => {
      const result = await executeCommand(sessionId, 'cat nonexistent-file.txt');
      expect(result.success).toBe(false);
      expect(result.stderr).toBeTruthy();
    });

    it('should include error message in result', async () => {
      const result = await executeCommand(sessionId, 'cat nonexistent-file.txt');
      expect(result.success).toBe(false);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe('Security edge cases', () => {
    it('should reject command with environment variable expansion', async () => {
      await expect(
        executeCommand(sessionId, 'echo $HOME')
      ).rejects.toThrow('substitution');
    });

    it('should allow commands with glob patterns', async () => {
      // Allow glob patterns within sandbox
      const result = await executeCommand(sessionId, 'ls *.txt');
      expect(result).toBeDefined();
      expect(result.success).toBeDefined(); // May succeed or fail depending on files
    });

    it('should reject empty command', async () => {
      await expect(
        executeCommand(sessionId, '')
      ).rejects.toThrow();
    });

    it('should reject whitespace-only command', async () => {
      await expect(
        executeCommand(sessionId, '   ')
      ).rejects.toThrow();
    });
  });
});
