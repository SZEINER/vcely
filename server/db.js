import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import mysql from 'mysql2/promise';

export const driver = process.env.DB_DRIVER || (process.env.NODE_ENV === 'production' ? 'mysql' : 'sqlite');

let database;
let pool;

if (driver === 'sqlite') {
  mkdirSync('data', { recursive: true });
  database = new DatabaseSync('data/vcely.sqlite');
  database.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS apiaries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS hives (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, apiary_id TEXT NOT NULL, name TEXT NOT NULL, queen_year INTEGER, status TEXT NOT NULL DEFAULT 'Aktivní', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, hive_id TEXT, apiary_id TEXT, type TEXT NOT NULL, date TEXT NOT NULL, title TEXT NOT NULL, amount REAL, unit TEXT, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);`);
} else if (driver === 'mysql') {
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (!process.env[key]) throw new Error(`Chybí proměnná prostředí ${key}.`);
  }
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: 10,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  });
} else {
  throw new Error(`Nepodporovaný DB_DRIVER: ${driver}`);
}

export async function get(sql, values = []) {
  if (database) return database.prepare(sql).get(...values) || null;
  const [rows] = await pool.execute(sql, values);
  return rows[0] || null;
}

export async function all(sql, values = []) {
  if (database) return database.prepare(sql).all(...values);
  const [rows] = await pool.execute(sql, values);
  return rows;
}

export async function run(sql, values = []) {
  if (database) return database.prepare(sql).run(...values);
  const [result] = await pool.execute(sql, values);
  return result;
}

export async function executeSchema(sql) {
  if (database) return database.exec(sql);
  return pool.query(sql);
}

export async function close() {
  if (database) database.close();
  if (pool) await pool.end();
}
