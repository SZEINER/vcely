import express from 'express';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import path from 'node:path';
import { get, all, run } from './db.js';
import { runMigrations } from './migrations.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
const id = () => randomUUID();
const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const bad = (res, message, code = 400) => res.status(code).json({ error: message });
const tokenFor = req => /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
const route = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function userFor(req) {
  const token = tokenFor(req);
  if (!token) return null;
  return get('SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?', [hash(token), now()]);
}
const auth = route(async (req, res, next) => {
  req.user = await userFor(req);
  if (!req.user) return bad(res, 'Nejste přihlášeni.', 401);
  next();
});
function cookie(res, token, age) {
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
async function session(res, userId) {
  const token = randomBytes(32).toString('hex');
  await run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)', [hash(token), userId, new Date(Date.now() + 30 * 86400000).toISOString()]);
  cookie(res, token, 30 * 86400);
}

app.get('/run-migrace', route(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let message, status = 200;
  try {
    message = await runMigrations();
  } catch (error) {
    console.error('Migrace selhala:', error);
    message = 'Migrace selhala. Podrobnosti jsou v logu serveru.';
    status = 500;
  }
  res.status(status).type('html').send(`<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Migrace databáze</title><style>body{font-family:system-ui,sans-serif;background:#f6f8f5;color:#203a32;min-height:100vh;display:grid;place-items:center;margin:0;padding:20px}.card{background:white;border:1px solid #e1e9e2;border-radius:16px;padding:32px;max-width:520px;box-shadow:0 10px 30px #173f3610}h1{font-size:24px;margin:0 0 12px}p{line-height:1.6}a{color:#7d581c}</style></head><body><main class="card"><h1>Migrace databáze</h1><p>${message}</p><a href="/">Zpět do aplikace</a></main></body></html>`);
}));

app.post('/api/register', route(async (req, res) => {
  const name = clean(req.body.name, 80), email = clean(req.body.email, 160).toLowerCase(), password = String(req.body.password ?? '');
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return bad(res, 'Vyplňte jméno, platný e-mail a heslo alespoň o 8 znacích.');
  if (await get('SELECT id FROM users WHERE email=?', [email])) return bad(res, 'Účet s tímto e-mailem už existuje.', 409);
  const salt = randomBytes(16).toString('hex'), userId = id();
  try {
    await run('INSERT INTO users (id, name, email, salt, password_hash, created_at) VALUES (?,?,?,?,?,?)', [userId, name, email, salt, scryptSync(password, salt, 64).toString('hex'), now()]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') return bad(res, 'Účet s tímto e-mailem už existuje.', 409);
    throw error;
  }
  await session(res, userId);
  res.status(201).json({ user: { id: userId, name, email } });
}));
app.post('/api/login', route(async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase(), password = String(req.body.password ?? '');
  const user = await get('SELECT * FROM users WHERE email=?', [email]);
  const candidate = scryptSync(password, user?.salt || 'fallback', 64);
  if (!user || !timingSafeEqual(candidate, Buffer.from(user.password_hash, 'hex'))) return bad(res, 'Nesprávný e-mail nebo heslo.', 401);
  await session(res, user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
}));
app.post('/api/logout', route(async (req, res) => {
  const token = tokenFor(req);
  if (token) await run('DELETE FROM sessions WHERE token_hash=?', [hash(token)]);
  cookie(res, '', 0);
  res.json({ ok: true });
}));
app.get('/api/me', route(async (req, res) => res.json({ user: await userFor(req) })));
app.get('/api/data', auth, route(async (req, res) => {
  const uid = req.user.id;
  res.json({
    apiaries: await all('SELECT * FROM apiaries WHERE user_id=? ORDER BY created_at DESC', [uid]),
    hives: await all('SELECT * FROM hives WHERE user_id=? ORDER BY created_at DESC', [uid]),
    records: await all('SELECT * FROM records WHERE user_id=? ORDER BY date DESC, created_at DESC', [uid]),
  });
}));
app.post('/api/apiaries', auth, route(async (req, res) => {
  const name = clean(req.body.name, 100);
  if (!name) return bad(res, 'Zadejte název stanoviště.');
  const item = { id: id(), user_id: req.user.id, name, location: clean(req.body.location, 160), note: clean(req.body.note, 1000), created_at: now() };
  await run('INSERT INTO apiaries (id, user_id, name, location, note, created_at) VALUES (?,?,?,?,?,?)', Object.values(item));
  res.status(201).json(item);
}));
app.post('/api/hives', auth, route(async (req, res) => {
  const name = clean(req.body.name, 100), apiaryId = clean(req.body.apiary_id, 50);
  if (!name || !await get('SELECT id FROM apiaries WHERE id=? AND user_id=?', [apiaryId, req.user.id])) return bad(res, 'Vyberte stanoviště a zadejte název úlu.');
  const year = req.body.queen_year ? Number(req.body.queen_year) : null;
  if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) return bad(res, 'Neplatný rok matky.');
  const item = { id: id(), user_id: req.user.id, apiary_id: apiaryId, name, queen_year: year, status: clean(req.body.status, 40) || 'Aktivní', note: clean(req.body.note, 1000), created_at: now() };
  await run('INSERT INTO hives (id, user_id, apiary_id, name, queen_year, status, note, created_at) VALUES (?,?,?,?,?,?,?,?)', Object.values(item));
  res.status(201).json(item);
}));
app.post('/api/records', auth, route(async (req, res) => {
  const types = ['Prohlídka', 'Krmení', 'Léčení', 'Med', 'Finance', 'Poznámka'];
  const type = clean(req.body.type, 30), date = clean(req.body.date, 10), title = clean(req.body.title, 120);
  const hiveId = clean(req.body.hive_id, 50) || null, apiaryId = clean(req.body.apiary_id, 50) || null;
  if (!types.includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return bad(res, 'Vyplňte typ, datum a název záznamu.');
  if (hiveId && !await get('SELECT id FROM hives WHERE id=? AND user_id=?', [hiveId, req.user.id])) return bad(res, 'Neplatný úl.');
  if (apiaryId && !await get('SELECT id FROM apiaries WHERE id=? AND user_id=?', [apiaryId, req.user.id])) return bad(res, 'Neplatné stanoviště.');
  const amount = req.body.amount === '' || req.body.amount == null ? null : Number(req.body.amount);
  if (amount !== null && !Number.isFinite(amount)) return bad(res, 'Neplatné množství.');
  const item = { id: id(), user_id: req.user.id, hive_id: hiveId, apiary_id: apiaryId, type, date, title, amount, unit: clean(req.body.unit, 20) || null, note: clean(req.body.note, 2000), created_at: now() };
  await run('INSERT INTO records (id, user_id, hive_id, apiary_id, type, date, title, amount, unit, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', Object.values(item));
  res.status(201).json(item);
}));
app.delete('/api/:kind/:id', auth, route(async (req, res) => {
  const table = { apiaries: 'apiaries', hives: 'hives', records: 'records' }[req.params.kind];
  if (!table) return bad(res, 'Neplatný typ.', 404);
  const item = await get(`SELECT id FROM ${table} WHERE id=? AND user_id=?`, [req.params.id, req.user.id]);
  if (!item) return bad(res, 'Záznam neexistuje.', 404);
  if (table === 'apiaries' && await get('SELECT id FROM hives WHERE apiary_id=? AND user_id=?', [item.id, req.user.id])) return bad(res, 'Stanoviště obsahuje úly.');
  if (table === 'hives' && await get('SELECT id FROM records WHERE hive_id=? AND user_id=?', [item.id, req.user.id])) return bad(res, 'Úl obsahuje záznamy.');
  await run(`DELETE FROM ${table} WHERE id=? AND user_id=?`, [item.id, req.user.id]);
  res.json({ ok: true });
}));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('dist')));
  app.get('/{*splat}', (req, res) => res.sendFile(path.resolve('dist/index.html')));
}
app.use((error, req, res, next) => {
  console.error(error);
  if (!res.headersSent) res.status(500).json({ error: 'Serverová chyba. Zkuste to prosím znovu.' });
});
app.listen(Number(process.env.PORT || 3001), () => console.log(`API běží na portu ${process.env.PORT || 3001}`));
