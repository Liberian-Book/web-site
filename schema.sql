-- schema.sql
-- Run this Console inside Cloudflare D1 dashboard to initialize the database
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  element_id TEXT NOT NULL,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_lookup ON comments(book_id, page_id, element_id);
