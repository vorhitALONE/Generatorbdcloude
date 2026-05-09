// db.js
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Writable по умолчанию на хостингах
const DATA_DIR = process.env.DATA_DIR || "/tmp/generatornumbers";
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "database.sqlite");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Таблица пользователей (админ)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Таблица “номеров”
db.exec(`
  CREATE TABLE IF NOT EXISTS numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
