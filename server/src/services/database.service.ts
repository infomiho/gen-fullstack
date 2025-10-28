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
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getEnv } from '../config/env.js';
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
import { databaseLogger } from '../lib/logger.js';

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

    // Use in-memory database for tests to avoid polluting production DB
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    const dbPath = isTest
      ? ':memory:'
      : env.DATABASE_URL || path.join(__dirname, '../../data/gen-fullstack.db');

    // Ensure data directory exists (skip for in-memory DB)
    if (dbPath !== ':memory:') {
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    }

    // Initialize SQLite connection
    this.sqlite = new Database(dbPath);
    this.sqlite.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
    this.sqlite.pragma('foreign_keys = ON'); // Enable foreign key constraints for cascade deletes
    this.db = drizzle(this.sqlite);

    databaseLogger.info({ dbPath, isTest }, 'Connected to SQLite database');
  }

  /**
   * Initialize database with schema (run migrations)
   *
   * Uses Drizzle's built-in migrate() function which handles:
   * - Migration tracking table creation (__drizzle_migrations)
   * - Atomic migration application
   * - Concurrent execution safety
   * - Proper ordering and idempotency
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Use Drizzle's built-in migration system
      // This automatically creates __drizzle_migrations table and applies pending migrations
      const migrationsFolder = path.join(__dirname, '../../drizzle');

      await migrate(this.db, { migrationsFolder });

      databaseLogger.info({ migrationsFolder }, 'Database migrations completed');
      this.initialized = true;
    } catch (error) {
      databaseLogger.error({ error }, 'Failed to initialize database');
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
   * Find stuck sessions (in 'generating' state for longer than threshold)
   */
  async findStuckSessions(thresholdMs: number): Promise<Session[]> {
    const allSessions = await this.listSessions(500); // Check more sessions for recovery
    const now = Date.now();

    return allSessions.filter((session) => {
      if (session.status !== 'generating') {
        return false;
      }
      const sessionAge = now - new Date(session.createdAt).getTime();
      return sessionAge > thresholdMs;
    });
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

  /**
   * Upsert pipeline stage by stageId
   * If stageId exists, updates status and data. Otherwise inserts new stage.
   *
   * This allows stages to update in-place (e.g., "started" → "completed")
   * while preserving their original timestamp for stable timeline positioning.
   */
  async upsertPipelineStage(
    sessionId: string,
    stageId: string,
    stageType: 'planning' | 'validation' | 'template_loading' | 'completing',
    stageStatus: 'started' | 'completed' | 'failed',
    timestamp: Date,
    stageData?: Record<string, unknown>,
  ): Promise<TimelineItem> {
    try {
      const dataJson = stageData ? JSON.stringify(stageData) : null;

      // Use raw SQL for proper UPSERT
      const result = this.sqlite
        .prepare(
          `
        INSERT INTO timeline_items (session_id, timestamp, type, stage_id, stage_type, stage_status, stage_data)
        VALUES (?, ?, 'pipeline_stage', ?, ?, ?, ?)
        ON CONFLICT (session_id, stage_id) WHERE stage_id IS NOT NULL
        DO UPDATE SET
          stage_status = excluded.stage_status,
          stage_data = excluded.stage_data
        RETURNING *
      `,
        )
        .get(
          sessionId,
          timestamp.getTime(),
          stageId,
          stageType,
          stageStatus,
          dataJson,
        ) as TimelineItem;

      if (!result) {
        throw new Error('Failed to upsert pipeline stage: no result returned');
      }

      return result;
    } catch (error) {
      databaseLogger.error(
        {
          sessionId,
          stageId,
          stageType,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to upsert pipeline stage',
      );
      throw error;
    }
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
