/**
 * Cleanup script for old generations
 *
 * Removes all generated apps from disk and clears the database.
 * Run with: npx tsx scripts/cleanup-generations.ts
 */

/* biome-ignore lint/suspicious/noConsole: CLI script requires console output */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseService } from '../server/src/services/database.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATED_DIR = path.join(__dirname, '../generated');

async function cleanup() {
  console.log('🧹 Starting cleanup...\n');

  // 1. Clean up database
  console.log('📊 Cleaning up database...');
  try {
    await databaseService.initialize();

    const sessions = await databaseService.listSessions(1000);
    console.log(`   Found ${sessions.length} sessions in database`);

    for (const session of sessions) {
      await databaseService.deleteSession(session.id);
      console.log(`   ✓ Deleted session: ${session.id} (${session.prompt?.slice(0, 50)}...)`);
    }

    console.log(`   ✅ Database cleaned (${sessions.length} sessions removed)\n`);
  } catch (error) {
    console.error('   ❌ Database cleanup failed:', error);
  }

  // 2. Clean up disk
  console.log('💾 Cleaning up disk...');
  try {
    const entries = fs.readdirSync(GENERATED_DIR);
    let removedCount = 0;
    let totalSize = 0;

    for (const entry of entries) {
      // Skip .gitkeep and hidden files
      if (entry === '.gitkeep' || entry.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(GENERATED_DIR, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        // Calculate size before removing
        const size = getDirectorySize(fullPath);
        totalSize += size;

        // Remove directory
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`   ✓ Removed: ${entry} (${formatBytes(size)})`);
        removedCount++;
      }
    }

    console.log(
      `   ✅ Disk cleaned (${removedCount} directories removed, ${formatBytes(totalSize)} freed)\n`,
    );
  } catch (error) {
    console.error('   ❌ Disk cleanup failed:', error);
  }

  // 3. Close database connection
  databaseService.close();

  console.log('✨ Cleanup complete!');
}

/**
 * Calculate total size of directory in bytes
 */
function getDirectorySize(dirPath: string): number {
  let totalSize = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += getDirectorySize(fullPath);
      } else {
        const stats = fs.statSync(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (_error) {
    // Ignore errors (e.g., permission denied)
  }

  return totalSize;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

// Run cleanup
cleanup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
