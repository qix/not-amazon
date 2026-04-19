import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { getDbPath } from "./env";

// Use globalThis to survive Next.js dev hot reloads
const g = globalThis as typeof globalThis & { __notAmazonDb?: Database.Database };

export function getDb(): Database.Database {
  if (g.__notAmazonDb) return g.__notAmazonDb;

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS store_photos (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      photo_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL,
      cropped_image_path TEXT,
      original_image_path TEXT,
      bbox_x REAL,
      bbox_y REAL,
      bbox_w REAL,
      bbox_h REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (photo_id) REFERENCES store_photos(id)
    )
  `);

  g.__notAmazonDb = db;
  return db;
}
