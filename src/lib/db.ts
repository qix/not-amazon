import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import { getDbPath } from "./env";

// Use globalThis to survive Next.js dev hot reloads — without this,
// each module re-evaluation creates a new in-memory database and
// concurrent route handlers can end up writing to different instances.
const globalDb = globalThis as typeof globalThis & { __notAmazonDb?: Database };

export async function getDb(): Promise<Database> {
  if (globalDb.__notAmazonDb) return globalDb.__notAmazonDb;

  const dbPath = getDbPath();
  const SQL = await initSqlJs();

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let db: Database;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS store_photos (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  db.run(`
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

  globalDb.__notAmazonDb = db;
  saveDb();
  return db;
}

export function saveDb() {
  const db = globalDb.__notAmazonDb;
  if (!db) return;
  const dbPath = getDbPath();
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, buffer);
}
