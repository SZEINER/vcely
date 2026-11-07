import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

mkdirSync('data', { recursive: true });
const db = new DatabaseSync('data/vcely.sqlite');
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apiaries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hives (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, apiary_id TEXT NOT NULL, name TEXT NOT NULL, queen_year INTEGER, status TEXT NOT NULL DEFAULT 'Aktivní', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, hive_id TEXT, apiary_id TEXT, type TEXT NOT NULL, date TEXT NOT NULL, title TEXT NOT NULL, amount REAL, unit TEXT, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);`);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
const id = () => randomUUID();
const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const bad = (res, message, code = 400) => res.status(code).json({ error: message });
function userFor(req) {
  const token = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!token) return null;
  return db.prepare('SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(hash(token), now()) || null;
}
function auth(req, res, next) { req.user = userFor(req); if (!req.user) return bad(res, 'Nejste přihlášeni.', 401); next(); }
function cookie(res, token, age) { res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); }
function session(res, userId) { const token = randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token), userId, new Date(Date.now() + 30 * 86400000).toISOString()); cookie(res, token, 30 * 86400); }
app.post('/api/register', (req, res) => {
  const name = clean(req.body.name, 80), email = clean(req.body.email, 160).toLowerCase(), password = String(req.body.password ?? '');
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return bad(res, 'Vyplňte jméno, platný e-mail a heslo alespoň o 8 znacích.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'Účet s tímto e-mailem už existuje.', 409);
  const salt = randomBytes(16).toString('hex'), userId = id();
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(userId, name, email, salt, scryptSync(password, salt, 64).toString('hex'), now());
  session(res, userId); res.status(201).json({ user: { id: userId, name, email } });
});
app.post('/api/login', (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase(), password = String(req.body.password ?? '');
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  const candidate = scryptSync(password, user?.salt || 'fallback', 64);
  if (!user || !timingSafeEqual(candidate, Buffer.from(user.password_hash, 'hex'))) return bad(res, 'Nesprávný e-mail nebo heslo.', 401);
  session(res, user.id); res.json({ user: { id: user.id, name: user.name, email: user.email } });
});
app.post('/api/logout', (req, res) => { const token = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '')?.[1]; if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); cookie(res, '', 0); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ user: userFor(req) }));
app.get('/api/data', auth, (req, res) => {
  const uid = req.user.id;
  res.json({ apiaries: db.prepare('SELECT * FROM apiaries WHERE user_id=? ORDER BY created_at DESC').all(uid), hives: db.prepare('SELECT * FROM hives WHERE user_id=? ORDER BY created_at DESC').all(uid), records: db.prepare('SELECT * FROM records WHERE user_id=? ORDER BY date DESC, created_at DESC').all(uid) });
});
app.post('/api/apiaries', auth, (req, res) => {
  const name = clean(req.body.name, 100); if (!name) return bad(res, 'Zadejte název stanoviště.');
  const item = { id: id(), user_id: req.user.id, name, location: clean(req.body.location, 160), note: clean(req.body.note, 1000), created_at: now() };
  db.prepare('INSERT INTO apiaries VALUES (?,?,?,?,?,?)').run(...Object.values(item)); res.status(201).json(item);
});
app.post('/api/hives', auth, (req, res) => {
  const name = clean(req.body.name, 100), apiaryId = clean(req.body.apiary_id, 50);
  if (!name || !db.prepare('SELECT 1 FROM apiaries WHERE id=? AND user_id=?').get(apiaryId, req.user.id)) return bad(res, 'Vyberte stanoviště a zadejte název úlu.');
  const year = req.body.queen_year ? Number(req.body.queen_year) : null;
  if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) return bad(res, 'Neplatný rok matky.');
  const item = { id: id(), user_id: req.user.id, apiary_id: apiaryId, name, queen_year: year, status: clean(req.body.status, 40) || 'Aktivní', note: clean(req.body.note, 1000), created_at: now() };
  db.prepare('INSERT INTO hives VALUES (?,?,?,?,?,?,?,?)').run(...Object.values(item)); res.status(201).json(item);
});
app.post('/api/records', auth, (req, res) => {
  const types = ['Prohlídka', 'Krmení', 'Léčení', 'Med', 'Finance', 'Poznámka'];
  const type = clean(req.body.type, 30), date = clean(req.body.date, 10), title = clean(req.body.title, 120);
  const hiveId = clean(req.body.hive_id, 50) || null, apiaryId = clean(req.body.apiary_id, 50) || null;
  if (!types.includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return bad(res, 'Vyplňte typ, datum a název záznamu.');
  if (hiveId && !db.prepare('SELECT 1 FROM hives WHERE id=? AND user_id=?').get(hiveId, req.user.id)) return bad(res, 'Neplatný úl.');
  if (apiaryId && !db.prepare('SELECT 1 FROM apiaries WHERE id=? AND user_id=?').get(apiaryId, req.user.id)) return bad(res, 'Neplatné stanoviště.');
  const amount = req.body.amount === '' || req.body.amount == null ? null : Number(req.body.amount);
  if (amount !== null && !Number.isFinite(amount)) return bad(res, 'Neplatné množství.');
  const item = { id: id(), user_id: req.user.id, hive_id: hiveId, apiary_id: apiaryId, type, date, title, amount, unit: clean(req.body.unit, 20) || null, note: clean(req.body.note, 2000), created_at: now() };
  db.prepare('INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(item)); res.status(201).json(item);
});
app.delete('/api/:kind/:id', auth, (req, res) => {
  const table = { apiaries: 'apiaries', hives: 'hives', records: 'records' }[req.params.kind];
  if (!table) return bad(res, 'Neplatný typ.', 404);
  const item = db.prepare(`SELECT id FROM ${table} WHERE id=? AND user_id=?`).get(req.params.id, req.user.id);
  if (!item) return bad(res, 'Záznam neexistuje.', 404);
  if (table === 'apiaries' && db.prepare('SELECT 1 FROM hives WHERE apiary_id=? AND user_id=?').get(item.id, req.user.id)) return bad(res, 'Stanoviště obsahuje úly.');
  if (table === 'hives' && db.prepare('SELECT 1 FROM records WHERE hive_id=? AND user_id=?').get(item.id, req.user.id)) return bad(res, 'Úl obsahuje záznamy.');
  db.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).run(item.id, req.user.id); res.json({ ok: true });
});
if (process.env.NODE_ENV === 'production') { app.use(express.static(path.resolve('dist'))); app.get('/{*splat}', (req, res) => res.sendFile(path.resolve('dist/index.html'))); }
app.listen(Number(process.env.PORT || 3001), () => console.log(`API běží na portu ${process.env.PORT || 3001}`));
