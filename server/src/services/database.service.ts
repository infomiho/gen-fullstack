/**
 * Database Service
 *
 * Manages database connections and operations using Drizzle ORM.
 * Provides methods for session persistence, timeline management, and file storage.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { and, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getEnv } from '../config/env.js';
import { databaseLogger } from '../lib/logger.js';
import {
  type File,
  files,
  type NewFile,
  type NewSession,
  type NewTimelineItem,
  type Session,
  sessions,
  type TimelineItem,
  timelineItems,
} from '../db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database service singleton
 */
class DatabaseService {
  private sqlite: Database.Database;
  private db: ReturnType<typeof drizzle>;
  private initialized = false;

  constructor() {
    // Determine database path
    const env = getEnv();
    const dbPath = env.DATABASE_URL || path.join(__dirname, '../../data/gen-fullstack.db');

    // Ensure data directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize SQLite connection
    this.sqlite = new Database(dbPath);
    this.sqlite.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
    this.sqlite.pragma('foreign_keys = ON'); // Enable foreign key constraints for cascade deletes
    this.db = drizzle(this.sqlite);

    databaseLogger.info({ dbPath }, 'Connected to SQLite database');
  }

  /**
   * Initialize database with schema (run migrations)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Check if tables already exist
      const tablesExist = this.sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sessions', 'timeline_items', 'files')",
        )
        .all();

      const needsInitialMigration = tablesExist.length !== 3;

      // Run initial migration if needed
      if (needsInitialMigration) {
        const migrationPath = path.join(__dirname, '../../drizzle/0000_cuddly_sersi.sql');
        if (fs.existsSync(migrationPath)) {
          const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
          this.sqlite.exec(migrationSQL);
          databaseLogger.info('Initial migration applied successfully');
        }
      }

      // Check if message_id column exists (migration 0001)
      const columnCheck = this.sqlite
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('timeline_items') WHERE name='message_id'",
        )
        .get() as { count: number };

      if (columnCheck.count === 0) {
        const migration0001Path = path.join(__dirname, '../../drizzle/0001_sweet_nekra.sql');
        if (fs.existsSync(migration0001Path)) {
          const migrationSQL = fs.readFileSync(migration0001Path, 'utf8');
          this.sqlite.exec(migrationSQL);
          databaseLogger.info('Migration 0001 (message_id) applied successfully');
        }
      }

      // Check if unique message_id index exists (migration 0002)
      const indexCheck = this.sqlite
        .prepare(
          "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='timeline_items_session_message_idx'",
        )
        .get() as { count: number };

      if (indexCheck.count === 0) {
        const migration0002Path = path.join(__dirname, '../../drizzle/0002_unique_message_id.sql');
        if (fs.existsSync(migration0002Path)) {
          const migrationSQL = fs.readFileSync(migration0002Path, 'utf8');
          this.sqlite.exec(migrationSQL);
          databaseLogger.info('Migration 0002 (unique message_id) applied successfully');
        }
      }

      this.initialized = true;
    } catch (error) {
      databaseLogger.error({ error }, 'Failed to initialize');
      throw error;
    }
  }

  // ==================== Session Operations ====================

  /**
   * Create a new session
   */
  async createSession(session: NewSession): Promise<Session> {
    const [created] = await this.db.insert(sessions).values(session).returning();
    return created;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const [session] = await this.db.select().from(sessions).where(eq(sessions.id, sessionId));
    return session || null;
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, updates: Partial<NewSession>): Promise<Session> {
    const [updated] = await this.db
      .update(sessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning();
    return updated;
  }

  /**
   * List all sessions (most recent first)
   */
  async listSessions(limit = 50): Promise<Session[]> {
    return this.db.select().from(sessions).orderBy(desc(sessions.createdAt)).limit(limit);
  }

  /**
   * Delete session and all related data
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  // ==================== Timeline Operations ====================

  /**
   * Add timeline item
   */
  async addTimelineItem(item: NewTimelineItem): Promise<TimelineItem> {
    const [created] = await this.db.insert(timelineItems).values(item).returning();
    return created;
  }

  /**
   * Upsert message by messageId (for streaming message accumulation)
   * If messageId exists, updates content and timestamp. Otherwise inserts new message.
   *
   * Uses SQLite's INSERT ... ON CONFLICT DO UPDATE (UPSERT) for atomic operation.
   * This prevents race conditions during concurrent streaming updates.
   */
  async upsertMessage(
    sessionId: string,
    messageId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    timestamp: Date,
  ): Promise<TimelineItem> {
    try {
      // Use raw SQL for proper UPSERT with content concatenation
      // Must include WHERE clause to match the partial index definition
      const result = this.sqlite
        .prepare(
          `
        INSERT INTO timeline_items (session_id, timestamp, type, message_id, role, content)
        VALUES (?, ?, 'message', ?, ?, ?)
        ON CONFLICT (session_id, message_id) WHERE message_id IS NOT NULL
        DO UPDATE SET
          content = timeline_items.content || excluded.content,
          timestamp = excluded.timestamp
        RETURNING *
      `,
        )
        .get(sessionId, timestamp.getTime(), messageId, role, content) as TimelineItem;

      if (!result) {
        throw new Error('Failed to upsert message: no result returned');
      }

      return result;
    } catch (error) {
      databaseLogger.error(
        {
          sessionId,
          messageId,
          role,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to upsert message',
      );
      throw error;
    }
  }

  /**
   * Get timeline items for a session
   */
  async getTimelineItems(sessionId: string): Promise<TimelineItem[]> {
    return this.db
      .select()
      .from(timelineItems)
      .where(eq(timelineItems.sessionId, sessionId))
      .orderBy(timelineItems.timestamp);
  }

  /**
   * Delete all timeline items for a session
   */
  async deleteTimelineItems(sessionId: string): Promise<void> {
    await this.db.delete(timelineItems).where(eq(timelineItems.sessionId, sessionId));
  }

  // ==================== File Operations ====================

  /**
   * Save or update a file
   */
  async saveFile(file: NewFile): Promise<File> {
    // Check if file exists
    const [existing] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.sessionId, file.sessionId), eq(files.path, file.path)));

    if (existing) {
      // Update existing file
      const [updated] = await this.db
        .update(files)
        .set({ content: file.content, updatedAt: new Date() })
        .where(eq(files.id, existing.id))
        .returning();
      return updated;
    }

    // Create new file
    const [created] = await this.db.insert(files).values(file).returning();
    return created;
  }

  /**
   * Get all files for a session
   */
  async getFiles(sessionId: string): Promise<File[]> {
    return this.db.select().from(files).where(eq(files.sessionId, sessionId));
  }

  /**
   * Get a specific file
   */
  async getFile(sessionId: string, filePath: string): Promise<File | null> {
    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.sessionId, sessionId), eq(files.path, filePath)));
    return file || null;
  }

  /**
   * Delete all files for a session
   */
  async deleteFiles(sessionId: string): Promise<void> {
    await this.db.delete(files).where(eq(files.sessionId, sessionId));
  }

  // ==================== Utility ====================

  /**
   * Close database connection
   */
  close(): void {
    this.sqlite.close();
    databaseLogger.info('Connection closed');
  }

  /**
   * Get raw database instance (for advanced queries)
   */
  getRawDb() {
    return this.db;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
