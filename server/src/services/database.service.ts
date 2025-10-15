/**
 * Database Service
 *
 * Manages database connections and operations using Drizzle ORM.
 * Provides methods for session persistence, timeline management, and file storage.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, desc, and } from 'drizzle-orm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import {
  sessions,
  timelineItems,
  files,
  type NewSession,
  type NewTimelineItem,
  type NewFile,
  type Session,
  type TimelineItem,
  type File,
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
    const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../../data/gen-fullstack.db');

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

    console.log(`[Database] Connected to SQLite database: ${dbPath}`);
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
          console.log('[Database] Initial migration applied successfully');
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
          console.log('[Database] Migration 0001 (message_id) applied successfully');
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('[Database] Failed to initialize:', error);
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
   */
  async upsertMessage(
    sessionId: string,
    messageId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    timestamp: Date,
  ): Promise<TimelineItem> {
    // Check if message exists
    const [existing] = await this.db
      .select()
      .from(timelineItems)
      .where(and(eq(timelineItems.sessionId, sessionId), eq(timelineItems.messageId, messageId)));

    if (existing) {
      // Update existing message (accumulate content)
      const [updated] = await this.db
        .update(timelineItems)
        .set({
          content: existing.content + content,
          timestamp, // Update timestamp to latest chunk
        })
        .where(eq(timelineItems.id, existing.id))
        .returning();
      return updated;
    }

    // Insert new message
    const [created] = await this.db
      .insert(timelineItems)
      .values({
        sessionId,
        timestamp,
        type: 'message',
        messageId,
        role,
        content,
      })
      .returning();
    return created;
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
    console.log('[Database] Connection closed');
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
