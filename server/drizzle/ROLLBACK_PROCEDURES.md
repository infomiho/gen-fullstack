# Migration Rollback Procedures

This project uses Drizzle ORM, which follows a **forward-only migration** philosophy. However, manual rollback procedures are documented here for emergency situations.

## Important Notes

- **Drizzle does not support automated down migrations** - This is intentional design
- **Preferred approach**: Create new forward migrations to fix issues
- **These procedures are for emergencies only** - Test thoroughly before use
- **Always backup data before manual rollbacks**

---

## Migration 0002: Unique Message ID Index

**File**: `0002_unique_message_id.sql`
**Applied**: Creates unique index `timeline_items_session_message_idx` on `(session_id, message_id)`

### Rollback Procedure

```sql
-- Drop the unique index
DROP INDEX IF EXISTS timeline_items_session_message_idx;
```

### Validation

```sql
-- Verify index is removed
SELECT name FROM sqlite_master
WHERE type='index'
AND tbl_name='timeline_items'
AND name='timeline_items_session_message_idx';
-- Should return no rows

-- Verify data integrity (table still accessible)
SELECT COUNT(*) FROM timeline_items;
```

### Risks
- **Low risk**: Removing this index only affects constraint enforcement
- **Impact**: Duplicate message_ids per session become possible again
- **Data loss**: None

---

## Migration 0001: Add message_id Column

**File**: `0001_sweet_nekra.sql`
**Applied**: Adds `message_id` TEXT column to `timeline_items` table

### Rollback Procedure

⚠️ **WARNING**: This rollback will **permanently delete data** in the `message_id` column

```sql
-- SQLite doesn't support DROP COLUMN directly prior to version 3.35.0
-- Method 1: If SQLite version >= 3.35.0
ALTER TABLE timeline_items DROP COLUMN message_id;

-- Method 2: For older SQLite (requires recreation)
-- 1. Backup the data
CREATE TABLE timeline_items_backup AS
SELECT id, session_id, timestamp, type, role, content,
       tool_call_id, tool_name, tool_args, tool_result_id,
       tool_result_for, result, is_error
FROM timeline_items;

-- 2. Drop the original table
DROP TABLE timeline_items;

-- 3. Recreate table without message_id (from 0000 schema)
CREATE TABLE timeline_items (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  session_id text NOT NULL,
  timestamp integer NOT NULL,
  type text NOT NULL,
  role text,
  content text,
  tool_call_id text,
  tool_name text,
  tool_args text,
  tool_result_id text,
  tool_result_for text,
  result text,
  is_error integer DEFAULT false,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE no action ON DELETE cascade
);

-- 4. Restore the data
INSERT INTO timeline_items
SELECT * FROM timeline_items_backup;

-- 5. Drop backup table
DROP TABLE timeline_items_backup;
```

### Validation

```sql
-- Verify column is removed
PRAGMA table_info(timeline_items);
-- Should not show message_id column

-- Verify data integrity
SELECT COUNT(*) FROM timeline_items;
-- Should match pre-rollback count
```

### Risks
- **HIGH RISK**: Data loss in `message_id` column
- **Impact**: Message deduplication and streaming accumulation will break
- **Application compatibility**: Must also rollback application code changes

---

## Migration 0000: Initial Schema

**File**: `0000_cuddly_sersi.sql`
**Applied**: Creates initial tables: `sessions`, `timeline_items`, `files`

### Rollback Procedure

⚠️ **DANGER**: This will **delete all application data**

```sql
-- Drop all tables in reverse order (respect foreign keys)
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS timeline_items;
DROP TABLE IF EXISTS sessions;
```

### Validation

```sql
-- Verify all tables are removed
SELECT name FROM sqlite_master WHERE type='table';
-- Should show no application tables (only sqlite_sequence if exists)
```

### Risks
- **CRITICAL RISK**: Complete data loss
- **Impact**: Entire database is wiped
- **Recovery**: Only possible from backups

---

## General Rollback Best Practices

1. **Backup First**: Always create a full database backup before any rollback
   ```bash
   # Create backup
   cp server/data/gen-fullstack.db server/data/gen-fullstack.db.backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **Test in Development**: Never run rollback procedures in production without testing

3. **Forward-Fix Preferred**: Consider creating a new forward migration instead

4. **Document Changes**: Update this file when adding new migrations

5. **Verify Application Compatibility**: Ensure application code is compatible with rolled-back schema

---

## Forward-Only Migration Philosophy

Drizzle ORM intentionally avoids automated rollbacks because:

- **Rollbacks are rarely safe in production** (data may have been created)
- **Forward fixes are more reliable** (create new migration to fix issues)
- **Simpler mental model** (always moving forward)
- **Forces better testing** (can't rely on easy rollback)

**Recommended approach**: If a migration causes issues, create a new migration to fix it rather than rolling back.
