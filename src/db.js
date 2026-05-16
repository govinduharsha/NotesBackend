import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function initDb() {
  const sql = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS notes (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS note_shares (
    id BIGSERIAL PRIMARY KEY,
    note_id BIGINT REFERENCES notes(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(note_id, user_id)
  );

  -- Full-text search index
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_indexes WHERE indexname = 'notes_fts_idx') THEN
      CREATE INDEX notes_fts_idx ON notes USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')));
    END IF;
  END $$;
  `;
  await pool.query(sql);
  // Ensure owner_id exists on notes (for older schema)
  const alter = `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notes' AND column_name='owner_id') THEN
        ALTER TABLE notes ADD COLUMN owner_id BIGINT;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_owner_id_fkey') THEN
        ALTER TABLE notes ADD CONSTRAINT notes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notes' AND column_name='pinned') THEN
        ALTER TABLE notes ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT false;
      END IF;
    END $$;
  `;
  await pool.query(alter);
}

export default pool;
