import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LayoutDashboard, Map, MapPin, Boxes, ClipboardList, Droplets, HeartPulse, Wallet, Menu, Plus, LogOut, Hexagon, Trash2, X, ChevronRight, Pencil, Eye, Users, UserRound, Sprout, Copy, Check, Shield, Mail, Package, Smartphone, CalendarDays } from 'lucide-react';
import './style.css';
import './app.css';

const request = async (path, options = {}) => {
  const response = await fetch('/api' + path, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Nastala chyba.');
  return data;
};
const blank = { farms: [], farm: null, apiaries: [], hives: [], records: [], stock: [], members: [], invites: [] };
const nav = [['Úvod', Hexagon], ['Přehled', LayoutDashboard], ['Mapa', Map], ['Stanoviště', MapPin], ['Úly', Boxes], ['Záznamy', ClipboardList], ['Med', Droplets], ['Léčení', HeartPulse], ['Finance', Wallet], ['Sklad', Package], ['Farmy', Sprout], ['Uživatelé', Users], ['Profil', UserRound]];
const types = ['Prohlídka', 'Krmení', 'Léčení', 'Med', 'Finance', 'Poznámka'];
const today = () => new Date().toLocaleDateString('sv-SE');
const roleName = { owner: 'Vlastník', editor: 'Editor', viewer: 'Náhled' };
const cityLocations = [
  ['Praha',50.0755,14.4378],['Brno',49.1951,16.6068],['Ostrava',49.8209,18.2625],['Plzeň',49.7384,13.3736],['Liberec',50.7663,15.0543],['Olomouc',49.5938,17.2509],['České Budějovice',48.9745,14.4743],['Hradec Králové',50.2092,15.8328],['Pardubice',50.0343,15.7812],['Ústí nad Labem',50.6607,14.0323],['Zlín',49.2244,17.6628],['Karlovy Vary',50.2319,12.8714],['Jihlava',49.3961,15.5912],['Kladno',50.1473,14.1029],['Mladá Boleslav',50.4114,14.9032],['Příbram',49.6899,14.0104],['Tábor',49.4144,14.6578],['Písek',49.3088,14.1475],['Strakonice',49.2614,13.9024],['Domažlice',49.4407,12.9298],['Cheb',50.0795,12.3739],['Sokolov',50.1813,12.6401],['Chomutov',50.4605,13.4178],['Most',50.5030,13.6362],['Teplice',50.6404,13.8245],['Děčín',50.7822,14.2148],['Česká Lípa',50.6855,14.5376],['Jablonec nad Nisou',50.7243,15.1711],['Jičín',50.4372,15.3516],['Trutnov',50.5610,15.9127],['Náchod',50.4167,16.1629],['Kolín',50.0281,15.2006],['Kutná Hora',49.9484,15.2682],['Benešov',49.7838,14.6874],['Beroun',49.9638,14.0720],['Rakovník',50.1037,13.7334],['Klatovy',49.3955,13.2950],['Tachov',49.7982,12.6362],['Havlíčkův Brod',49.6069,15.5794],['Třebíč',49.2148,15.8817],['Žďár nad Sázavou',49.5626,15.9392],['Pelhřimov',49.4313,15.2234],['Chrudim',49.9511,15.7956],['Svitavy',49.7559,16.4683],['Litomyšl',49.8681,16.3129],['Šumperk',49.9653,16.9706],['Jeseník',50.2294,17.2046],['Prostějov',49.4729,17.1118],['Přerov',49.4551,17.4509],['Kroměříž',49.2978,17.3931],['Uherské Hradiště',49.0698,17.4597],['Vsetín',49.3389,17.9962],['Valašské Meziříčí',49.4718,17.9711],['Nový Jičín',49.5944,18.0103],['Frýdek-Místek',49.6834,18.3500],['Karviná',49.8540,18.5417],['Opava',49.9387,17.9026],['Krnov',50.0897,17.7039],['Znojmo',48.8555,16.0488],['Břeclav',48.7589,16.8820],['Hodonín',48.8489,17.1324],['Vyškov',49.2775,16.9989],['Blansko',49.3630,16.6445]
];
const normalizeCity = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('cs-CZ');
const apiaryIcon = L.divIcon({ className: 'apiary-marker', html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 36], popupAnchor: [0, -34] });
const subtitles = { Úvod: 'Novinky a informace o Včelím deníku.', Mapa: 'Umístění stanovišť ve vybrané farmě.', Stanoviště: 'Místa, kde se staráte o svá včelstva.', Úly: 'Přehled úlů a matek.', Záznamy: 'Chronologický deník práce u včel.', Med: 'Záznamy o vytáčení a zásobách medu.', Léčení: 'Přehled provedeného léčení.', Finance: 'Příjmy a výdaje spojené se včelařením.', Sklad: 'Zásoby a pomůcky vaší farmy.', Farmy: 'Vaše farmy a společné pracovní prostory.', Uživatelé: 'Členové a pozvánky vybrané farmy.', Profil: 'Vaše osobní údaje a přístupové heslo.' };

function App() {
  const [user, setUser] = useState(undefined);
  const [data, setData] = useState(blank);
  const [farmId, setFarmId] = useState(localStorage.getItem('farm_id') || '');
  const [page, setPage] = useState('Přehled');
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteLink, setInviteLink] = useState(null);
  const inviteToken = new URLSearchParams(window.location.search).get('pozvanka');
  const inviteHandled = useRef(false);
  const refresh = async (selected = farmId) => {
    try {
      const next = await request('/data' + (selected ? '?farm_id=' + encodeURIComponent(selected) : ''));
      setData(next);
      const actual = next.farm?.id || '';
      setFarmId(actual);
      if (actual) localStorage.setItem('farm_id', actual); else localStorage.removeItem('farm_id');
      return next;
    } catch (e) {
      if (selected) return refresh('');
      setError(e.message);
      throw e;
    }
  };
  useEffect(() => { request('/me').then(({ user }) => { setUser(user); if (user) refresh().catch(() => {}); }).catch(() => setUser(null)); }, []);
  useEffect(() => {
    if (!user || !inviteToken || inviteHandled.current) return;
    inviteHandled.current = true;
    request('/invites/accept', { method: 'POST', body: JSON.stringify({ token: inviteToken }) })
      .then(async ({ farm_id }) => { setNotice('Pozvánka byla přijata. Farma je nyní dostupná.'); await refresh(farm_id); setPage('Přehled'); })
      .catch(e => setError(e.message))
      .finally(() => { history.replaceState(null, '', location.pathname); });
  }, [user]);
  const canWrite = ['owner', 'editor'].includes(data.farm?.role);
  const isOwner = data.farm?.role === 'owner';
  const selectFarm = async id => { setError(''); setNotice(''); await refresh(id); setPage('Přehled'); };
  const logout = async () => { await request('/logout', { method: 'POST' }); setUser(null); setData(blank); localStorage.removeItem('farm_id'); };
  const save = async (kind, item, payload) => {
    if (kind === 'apiaries' || kind === 'records' || kind === 'stock') payload.farm_id = data.farm?.id;
    const url = item ? `/${kind}/${item.id}` : `/${kind}`;
    const result = await request(url, { method: item ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    await refresh(kind === 'farms' && !item ? result.id : farmId);
    setModal(null); setNotice(item ? 'Změny byly uloženy.' : 'Položka byla vytvořena.'); setError('');
  };
  const remove = async (kind, item) => {
    if (!window.confirm(`Opravdu chcete smazat ${kind === 'farms' ? 'farmu' : 'položku'} „${item.name || item.title}“?`)) return;
    try { await request(`/${kind}/${item.id}`, { method: 'DELETE' }); await refresh(kind === 'farms' ? '' : farmId); setNotice('Položka byla smazána.'); setModal(null); }
    catch (e) { setError(e.message); }
  };
  const invite = async payload => {
    const result = await request(`/farms/${farmId}/invites`, { method: 'POST', body: JSON.stringify(payload) });
    setInviteLink({ id: result.id, farmId, url: `${window.location.origin}/?pozvanka=${result.token}` });
    await refresh(farmId); setModal(null);
    setNotice(result.email_sent ? 'Pozvánka byla odeslána e-mailem. Odkaz můžete také zkopírovat.' : 'Pozvánka byla vytvořena. Zkopírujte odkaz a pošlete jej pozvanému uživateli.');
  };
  const changeMember = async (member, role) => { try { await request(`/farms/${farmId}/members/${member.id}`, { method: 'PATCH', body: JSON.stringify({ role }) }); await refresh(farmId); } catch (e) { setError(e.message); } };
  const removeMember = async member => { if (!confirm(`Odebrat uživatele ${member.name} z farmy?`)) return; try { await request(`/farms/${farmId}/members/${member.id}`, { method: 'DELETE' }); await refresh(member.id === user.id ? '' : farmId); } catch (e) { setError(e.message); } };
  const removeInvite = async invite => { try { await request(`/farms/${farmId}/invites/${invite.id}`, { method: 'DELETE' }); if (inviteLink?.id === invite.id) setInviteLink(null); await refresh(farmId); } catch (e) { setError(e.message); } };
  const saveProfile = async payload => { const { user: updated } = await request('/profile', { method: 'PATCH', body: JSON.stringify(payload) }); setUser(updated); setNotice('Profil byl aktualizován.'); };
  if (user === undefined) return <div className="loading">Načítám Včelí deník…</div>;
  if (!user && window.location.pathname === '/uvod') return <div className="public-home"><header><div className="auth-brand"><Hexagon size={24}/> Včelí<span>deník</span></div><a className="primary-button" href="/">Přihlášení</a></header><HomePage/></div>;
  if (!user) return <><Auth invite={!!inviteToken} onSuccess={u => { setUser(u); refresh('').catch(() => {}); }} /><a className="public-home-link" href="/uvod">Novinky a informace o aplikaci</a></>;
  const visibleRecords = ['Med', 'Léčení', 'Finance'].includes(page) ? data.records.filter(r => r.type === page) : data.records;
  const totalHoney = data.records.filter(r => r.type === 'Med' && r.unit === 'kg').reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const createKind = page === 'Stanoviště' ? 'apiaries' : page === 'Úly' ? 'hives' : page === 'Farmy' ? 'farms' : page === 'Sklad' ? 'stock' : ['Záznamy', 'Med', 'Léčení', 'Finance', 'Přehled'].includes(page) ? 'records' : null;
  const createLabel = { apiaries: 'Nové stanoviště', hives: 'Nový úl', farms: 'Nová farma', records: 'Nový záznam', stock: 'Nová zásoba' }[createKind];
  return <div className="app-shell">
    <aside className={'sidebar ' + (menu ? 'open' : '')}>
      <div className="brand"><div className="brand-mark"><Hexagon size={25}/></div><span>Včelí<span className="brand-light">deník</span></span></div>
      <div className="nav-label">PRACOVNÍ PROSTOR</div>
      <nav>{nav.map(([label, Icon]) => <button key={label} className={'nav-item ' + (page === label ? 'active' : '')} onClick={() => { setPage(label); setMenu(false); setError(''); setNotice(''); }}><Icon size={19}/><span>{label}</span>{page === label && <ChevronRight size={16} className="nav-chevron"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div><div className="profile-copy"><strong>{user.name}</strong><span>{user.email}</span></div><button aria-label="Odhlásit se" className="icon-button logout" onClick={logout}><LogOut size={18}/></button></div>
    </aside>
    {menu && <div className="scrim" onClick={() => setMenu(false)}/>}
    <main className="main"><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMenu(true)} aria-label="Otevřít menu"><Menu size={23}/></button><div className="breadcrumb">Včelí deník <span>/</span> <strong>{page}</strong></div><div className="topbar-right"><select className="farm-select" aria-label="Vybrat farmu" value={farmId} onChange={e => selectFarm(e.target.value)}>{data.farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select><span className="season">{roleName[data.farm?.role] || 'Farma'}</span><div className="small-avatar">{user.name.charAt(0).toUpperCase()}</div></div></header>
      <div className="content"><div className="page-head"><div><div className="eyebrow">{data.farm?.name?.toUpperCase() || 'VAŠE VČELAŘSTVÍ'}</div><h1>{page === 'Přehled' ? `Dobrý den, ${user.name.split(' ')[0]} 👋` : page}</h1><p>{page === 'Přehled' ? 'Vše důležité o vašich včelstvech na jednom místě.' : subtitles[page]}</p></div>{createKind && (createKind === 'farms' || canWrite) && <button className="primary-button" onClick={() => setModal({ type: 'form', kind: createKind })}><Plus size={18}/>{createLabel}</button>}{page === 'Uživatelé' && isOwner && <button className="primary-button" onClick={() => setModal({ type: 'invite' })}><Mail size={17}/>Pozvat uživatele</button>}</div>
      {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Zavřít"><X size={16}/></button></div>}{notice && <div className="success-banner" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Zavřít"><X size={16}/></button></div>}
      {page === 'Úvod' && <HomePage/>}
      {page === 'Přehled' && <><div className="stats"><Stat icon={MapPin} label="Stanoviště" value={data.apiaries.length} tone="green"/><Stat icon={Boxes} label="Aktivní úly" value={data.hives.filter(h => h.status === 'Aktivní').length} tone="amber"/><Stat icon={ClipboardList} label="Záznamy" value={data.records.length} tone="blue"/><Stat icon={Droplets} label="Med celkem" value={`${totalHoney.toLocaleString('cs-CZ')} kg`} tone="rose"/></div><div className="dashboard-grid"><section className="panel"><PanelHead title="Poslední záznamy" action={() => setPage('Záznamy')}/><RecordList records={data.records.slice(0, 5)} data={data} compact onView={item => setModal({ type: 'detail', kind: 'records', item })}/></section><section className="panel"><PanelHead title="Stanoviště" action={() => setPage('Stanoviště')}/>{data.apiaries.length ? data.apiaries.slice(0, 4).map(a => <button className="apiary-mini mini-button" key={a.id} onClick={() => setModal({ type: 'detail', kind: 'apiaries', item: a })}><div className="mini-icon"><MapPin size={18}/></div><div><strong>{a.name}</strong><small>{a.location || 'Bez uvedené lokality'} · {data.hives.filter(h => h.apiary_id === a.id).length} úlů</small></div><ChevronRight size={16}/></button>) : <Empty title="Zatím žádné stanoviště" text="Začněte přidáním místa, kde chováte včely."/>}</section></div></>}
      {page === 'Mapa' && <section className="panel map-panel"><MapCanvas apiaries={data.apiaries} hives={data.hives} records={data.records}/><div className="map-list"><h2>Stanoviště na mapě</h2>{data.apiaries.filter(a => a.latitude !== null && a.longitude !== null).length ? data.apiaries.filter(a => a.latitude !== null && a.longitude !== null).map(a => <button key={a.id} onClick={() => setModal({ type: 'detail', kind: 'apiaries', item: a })}><MapPin size={16}/><span>{a.name}</span><small>{a.location}</small><ChevronRight size={16}/></button>) : <p>Stanoviště zatím nemají souřadnice. Otevřete stanoviště a vyberte jeho polohu na mapě.</p>}</div></section>}
      {page === 'Stanoviště' && <EntityList kind="apiaries" items={data.apiaries} data={data} onView={item => setModal({ type: 'detail', kind: 'apiaries', item })}/>}
      {page === 'Úly' && <EntityList kind="hives" items={data.hives} data={data} onView={item => setModal({ type: 'detail', kind: 'hives', item })}/>}
      {['Záznamy', 'Med', 'Léčení', 'Finance'].includes(page) && <section className="panel list-panel"><RecordList records={visibleRecords} data={data} onView={item => setModal({ type: 'detail', kind: 'records', item })}/></section>}
      {page === 'Sklad' && <StockPage items={data.stock} canWrite={canWrite} onEdit={item => setModal({ type: 'form', kind: 'stock', item })} onDelete={item => remove('stock', item)}/>}
      {page === 'Farmy' && <section className="farm-grid">{data.farms.map(f => <div className={'panel farm-card ' + (f.id === farmId ? 'selected' : '')} key={f.id}><div className="farm-card-icon"><Sprout size={23}/></div><div><h2>{f.name}</h2><span className="role-pill">{roleName[f.role]}</span></div><p>{f.note || 'Společný prostor pro stanoviště, úly a záznamy.'}</p><div className="farm-card-actions"><button className="secondary-button" onClick={() => selectFarm(f.id)}>Otevřít</button>{f.role === 'owner' && <button className="icon-button" aria-label="Upravit farmu" onClick={() => setModal({ type: 'form', kind: 'farms', item: f })}><Pencil size={17}/></button>}</div></div>)}</section>}
      {page === 'Uživatelé' && <UsersPage data={data} user={user} isOwner={isOwner} inviteLink={inviteLink?.farmId === farmId ? inviteLink : null} onChange={changeMember} onRemove={removeMember} onRemoveInvite={removeInvite} onCopyInvite={async url => { await navigator.clipboard.writeText(url); setNotice('Odkaz byl zkopírován.'); }}/>}
      {page === 'Profil' && <ProfilePage user={user} onSave={saveProfile} onError={setError}/>}
      </div></main>
    {modal?.type === 'form' && (modal.kind === 'stock' ? <StockForm key={modal.item?.id || 'new'} item={modal.item} onClose={() => setModal(null)} onSave={payload => save('stock', modal.item, payload)}/> : <EntityForm key={`${modal.kind}:${modal.item?.id || 'new'}`} kind={modal.kind} item={modal.item} data={data} defaultType={types.includes(page) ? page : 'Prohlídka'} onClose={() => setModal(null)} onSave={save}/>)}
    {modal?.type === 'detail' && <DetailModal kind={modal.kind} item={modal.item} data={data} canWrite={canWrite} onClose={() => setModal(null)} onEdit={() => setModal({ type: 'form', kind: modal.kind, item: modal.item })} onDelete={() => remove(modal.kind, modal.item)}/>}
    {modal?.type === 'invite' && <InviteModal onClose={() => setModal(null)} onSave={invite}/>}
  </div>;
}

function Auth({ invite, onSuccess }) {
  const [mode, setMode] = useState('login'), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const submit = async e => { e.preventDefault(); setBusy(true); setError(''); try { const result = await request('/' + mode, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) }); onSuccess(result.user); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <div className="auth-page"><div className="auth-art"><div className="auth-brand"><div className="brand-mark"><Hexagon size={28}/></div>Včelí<span>deník</span></div><div className="auth-art-copy"><span className="auth-overline">CHYTŘEJŠÍ VČELAŘENÍ</span><h1>Vše o vašich včelách.<br/><em>Na jednom místě.</em></h1><p>Stanoviště, úly a důležité záznamy přehledně v počítači i v mobilu.</p></div><div className="auth-art-footer">Vytvořeno pro české včelaře</div></div><div className="auth-form-wrap"><div className="auth-card"><div className="mobile-auth-brand"><Hexagon size={24}/> Včelídeník</div><span className="eyebrow">{invite ? 'POZVÁNKA DO FARMY' : 'VÍTEJTE ZPĚT'}</span><h2>{mode === 'login' ? 'Přihlášení' : 'Vytvořit účet'}</h2><p>{invite ? 'Přihlaste se nebo zaregistrujte e-mailem, na který jste dostali pozvánku.' : mode === 'login' ? 'Přihlaste se do svého včelařského deníku.' : 'Začněte evidovat svá včelstva během chvilky.'}</p><form onSubmit={submit}>{mode === 'register' && <label>Jméno a příjmení<input name="name" autoComplete="name" required placeholder="Jan Novák"/></label>}<label>E-mail<input type="email" name="email" autoComplete="email" required placeholder="vas@email.cz"/></label><label>Heslo<input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} required placeholder="Alespoň 8 znaků"/></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Chvíli strpení…' : mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}<ChevronRight size={18}/></button></form><div className="auth-switch">{mode === 'login' ? 'Ještě nemáte účet?' : 'Už máte účet?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Zaregistrovat se' : 'Přihlásit se'}</button></div></div></div></div>;
}
function Stat({ icon: Icon, label, value, tone }) { return <div className="stat"><div className={'stat-icon ' + tone}><Icon size={21}/></div><span>{label}</span><strong>{value}</strong></div>; }
function PanelHead({ title, action }) { return <div className="panel-head"><h2>{title}</h2><button onClick={action}>Zobrazit vše <ChevronRight size={16}/></button></div>; }
function Empty({ title, text }) { return <div className="empty"><div className="empty-icon"><Hexagon size={27}/></div><h3>{title}</h3><p>{text}</p></div>; }
function EntityList({ kind, items, data, onView }) { return <section className="panel list-panel">{items.length ? items.map(item => <button className="entity-row entity-button" key={item.id} onClick={() => onView(item)}><div className={'entity-icon ' + (kind === 'apiaries' ? 'green' : 'amber')}>{kind === 'apiaries' ? <MapPin size={22}/> : <Boxes size={22}/>}</div><div className="entity-main"><h3>{item.name} {kind === 'hives' && <span className="badge">{item.status}</span>}</h3><p>{kind === 'apiaries' ? `${item.location || 'Bez uvedené lokality'} · ${data.hives.filter(h => h.apiary_id === item.id).length} úlů` : `${data.apiaries.find(a => a.id === item.apiary_id)?.name || 'Stanoviště'}${item.queen_year ? ` · Matka ${item.queen_year}` : ''}`}</p>{item.note && <small>{item.note}</small>}</div><Eye size={18} className="row-eye"/></button>) : <Empty title={kind === 'apiaries' ? 'Zatím žádná stanoviště' : 'Zatím žádné úly'} text={kind === 'apiaries' ? 'Přidejte první stanoviště a označte jeho polohu na mapě.' : 'Nejprve založte stanoviště a pak na něj přidejte úly.'}/>}</section>; }
function RecordList({ records, data, compact, onView }) { return records.length ? <div className="record-list">{records.map(r => <button className="record-row record-button" key={r.id} onClick={() => onView(r)}><div className={'record-type ' + r.type.toLowerCase()}>{({ Med: <Droplets size={19}/>, Léčení: <HeartPulse size={19}/>, Finance: <Wallet size={19}/> })[r.type] || <ClipboardList size={19}/>}</div><div className="record-copy"><strong>{r.title}</strong><span>{r.type} · {data.hives.find(h => h.id === r.hive_id)?.name || data.apiaries.find(a => a.id === r.apiary_id)?.name || 'Obecný záznam'}</span>{!compact && r.note && <small>{r.note}</small>}</div><div className="record-side"><time>{new Date(r.date + 'T12:00:00').toLocaleDateString('cs-CZ')}</time>{r.amount != null && <b>{Number(r.amount).toLocaleString('cs-CZ')} {r.unit}</b>}</div><Eye size={17} className="row-eye"/></button>)}</div> : <Empty title="Zatím tu nic není" text="Přidejte první záznam a začněte si tvořit historii svého včelaření."/>; }

function MapCanvas({ apiaries = [], hives = [], records = [], onPick, picked, compact = false }) {
  const root = useRef(null), mapRef = useRef(null), layerRef = useRef(null), onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  useEffect(() => {
    if (!root.current || mapRef.current) return;
    const map = L.map(root.current, { scrollWheelZoom: false }).setView([49.8, 15.5], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    map.on('click', e => onPickRef.current?.({ latitude: Number(e.latlng.lat.toFixed(6)), longitude: Number(e.latlng.lng.toFixed(6)) }));
    mapRef.current = map; layerRef.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 80);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current; if (!map || !layer) return;
    layer.clearLayers(); const points = [];
    apiaries.filter(a => a.latitude != null && a.longitude != null).forEach(a => {
      const point = [Number(a.latitude), Number(a.longitude)]; points.push(point);
      const marker = L.marker(point, { icon: apiaryIcon }).addTo(layer);
      const popup = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = a.name; popup.appendChild(strong);
      if (a.location) { const small = document.createElement('div'); small.textContent = a.location; popup.appendChild(small); }
      if (!compact) {
        const localHives = hives.filter(h => h.apiary_id === a.id);
        const count = document.createElement('div'); count.textContent = `Úly: ${localHives.length}`; popup.appendChild(count);
        localHives.forEach(h => { const line = document.createElement('div'); line.textContent = `${h.name} · ${h.status}${h.queen_year ? ` · matka ${h.queen_year}` : ''}`; popup.appendChild(line); });
        const last = records.filter(r => r.apiary_id === a.id).sort((x, y) => y.date.localeCompare(x.date))[0];
        const visit = document.createElement('div'); visit.textContent = last ? `Poslední záznam: ${new Date(last.date + 'T12:00:00').toLocaleDateString('cs-CZ')}` : 'Zatím bez záznamu návštěvy'; popup.appendChild(visit);
      }
      marker.bindPopup(popup);
    });
    if (picked?.latitude != null && picked?.longitude != null && picked.latitude !== '' && picked.longitude !== '') { const point = [Number(picked.latitude), Number(picked.longitude)]; points.push(point); L.circleMarker(point, { radius: 9, color: '#173f36', fillColor: '#e5af48', fillOpacity: 1 }).addTo(layer); }
    if (points.length > 1) map.fitBounds(points, { padding: [35, 35], maxZoom: 13 });
    else if (points.length === 1) map.setView(points[0], 13);
  }, [apiaries, hives, records, compact, picked?.latitude, picked?.longitude]);
  return <div className={'map-canvas ' + (compact ? 'compact' : '')} ref={root} role="img" aria-label={onPick ? 'Kliknutím na mapu vyberete souřadnice stanoviště' : 'Mapa včelích stanovišť'}/>;
}

function ModalShell({ title, onClose, children }) { return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><span className="eyebrow">VČELÍ DENÍK</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={21}/></button></div>{children}</div></div>; }
function CitySearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const matches = normalizeCity(query.trim()).length >= 2 ? cityLocations.filter(([name]) => normalizeCity(name).includes(normalizeCity(query.trim()))).slice(0, 8) : [];
  return <div className="city-search"><label>Vyhledat město<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Např. Brno, Znojmo, Tábor…" autoComplete="off"/></label>{matches.length > 0 && <div className="city-results">{matches.map(([name, latitude, longitude]) => <button type="button" key={name} onClick={() => { onSelect({ name, latitude, longitude }); setQuery(''); }}><MapPin size={15}/>{name}<small>Česko</small></button>)}</div>}{query.trim().length >= 2 && matches.length === 0 && <small className="city-help">Město není v rychlém seznamu. Polohu můžete vybrat kliknutím do mapy.</small>}</div>;
}
function EntityForm({ kind, item, data, defaultType, onClose, onSave }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [coords, setCoords] = useState({ latitude: item?.latitude ?? '', longitude: item?.longitude ?? '' });
  const [apiaryLocation, setApiaryLocation] = useState(item?.location || '');
  const titles = { apiaries: 'stanoviště', hives: 'úl', records: 'záznam', farms: 'farmu' };
  const submit = async e => { e.preventDefault(); setBusy(true); setError(''); const payload = Object.fromEntries(new FormData(e.currentTarget)); if (kind === 'apiaries') Object.assign(payload, coords); try { await onSave(kind, item, payload); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <ModalShell title={`${item ? 'Upravit' : 'Přidat'} ${titles[kind]}`} onClose={onClose}><form onSubmit={submit} className="app-form">{kind === 'farms' && <><label>Název farmy *<input name="name" defaultValue={item?.name || ''} required autoFocus placeholder="Např. Rodinná farma"/></label><label>Popis<textarea name="note" rows="3" defaultValue={item?.note || ''}/></label></>}{kind === 'apiaries' && <><label>Název stanoviště *<input name="name" defaultValue={item?.name || ''} required autoFocus placeholder="Např. Zahrada"/></label><label>Lokalita<input name="location" value={apiaryLocation} onChange={event => setApiaryLocation(event.target.value)} placeholder="Obec nebo adresa"/></label><label>Poznámka<textarea name="note" rows="3" defaultValue={item?.note || ''}/></label><CitySearch onSelect={({ name, latitude, longitude }) => { setApiaryLocation(name); setCoords({ latitude, longitude }); }}/><div className="map-picker-head"><strong>Poloha na mapě</strong><small>Klikněte na mapu nebo zadejte souřadnice</small></div><MapCanvas compact apiaries={[]} picked={coords} onPick={setCoords}/><div className="form-grid"><label>Zeměpisná šířka<input type="number" step="any" min="-90" max="90" value={coords.latitude} onChange={e => setCoords(c => ({ ...c, latitude: e.target.value }))} placeholder="49.8175"/></label><label>Zeměpisná délka<input type="number" step="any" min="-180" max="180" value={coords.longitude} onChange={e => setCoords(c => ({ ...c, longitude: e.target.value }))} placeholder="15.4730"/></label></div></>}{kind === 'hives' && <><label>Stanoviště *<select name="apiary_id" required defaultValue={item?.apiary_id || ''}><option value="" disabled>Vyberte stanoviště</option>{data.apiaries.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Označení úlu *<input name="name" defaultValue={item?.name || ''} required placeholder="Např. Úl 01"/></label><div className="form-grid"><label>Rok matky<input name="queen_year" type="number" min="2000" max="2100" defaultValue={item?.queen_year || ''}/></label><label>Stav<select name="status" defaultValue={item?.status || 'Aktivní'}><option>Aktivní</option><option>Slabé</option><option>Prázdné</option></select></label></div><label>Poznámka<textarea name="note" rows="3" defaultValue={item?.note || ''}/></label></>}{kind === 'records' && <><div className="form-grid"><label>Typ záznamu *<select name="type" defaultValue={item?.type || defaultType}>{types.map(t => <option key={t}>{t}</option>)}</select></label><label>Datum *<input name="date" type="date" required defaultValue={item?.date || today()}/></label></div><label>Název *<input name="title" required defaultValue={item?.title || ''} placeholder="Co se stalo?"/></label><div className="form-grid"><label>Stanoviště<select name="apiary_id" defaultValue={item?.apiary_id || ''}><option value="">Bez stanoviště</option>{data.apiaries.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Úl<select name="hive_id" defaultValue={item?.hive_id || ''}><option value="">Bez úlu</option>{data.hives.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label></div><div className="form-grid"><label>Množství / částka<input name="amount" type="number" step="any" defaultValue={item?.amount ?? ''}/></label><label>Jednotka<select name="unit" defaultValue={item?.unit || ''}><option value="">Bez jednotky</option><option>kg</option><option>l</option><option>Kč</option><option>ks</option></select></label></div><label>Poznámka<textarea name="note" rows="3" defaultValue={item?.note || ''}/></label></>}{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Zrušit</button><button className="primary-button" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit'}</button></div></form></ModalShell>;
}
function DetailModal({ kind, item, data, canWrite, onClose, onEdit, onDelete }) {
  const name = item.name || item.title;
  const rows = kind === 'apiaries' ? [['Lokalita', item.location || 'Neuvedena'], ['Souřadnice', item.latitude != null ? `${item.latitude}, ${item.longitude}` : 'Neuvedeny'], ['Počet úlů', data.hives.filter(h => h.apiary_id === item.id).length]] : kind === 'hives' ? [['Stanoviště', data.apiaries.find(a => a.id === item.apiary_id)?.name || '—'], ['Stav', item.status], ['Rok matky', item.queen_year || 'Neuveden']] : [['Typ', item.type], ['Datum', new Date(item.date + 'T12:00:00').toLocaleDateString('cs-CZ')], ['Stanoviště', data.apiaries.find(a => a.id === item.apiary_id)?.name || '—'], ['Úl', data.hives.find(h => h.id === item.hive_id)?.name || '—'], ['Množství / částka', item.amount == null ? '—' : `${Number(item.amount).toLocaleString('cs-CZ')} ${item.unit || ''}`]];
  return <ModalShell title={name} onClose={onClose}><div className="detail-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>{item.note && <div className="detail-note"><span>Poznámka</span><p>{item.note}</p></div>}{canWrite && <div className="modal-actions detail-actions"><button className="secondary-button danger-button" onClick={onDelete}><Trash2 size={16}/>Smazat</button><button className="primary-button" onClick={onEdit}><Pencil size={16}/>Upravit</button></div>}</ModalShell>;
}
function InviteModal({ onClose, onSave }) { const [busy, setBusy] = useState(false), [error, setError] = useState(''); const submit = async e => { e.preventDefault(); setBusy(true); try { await onSave(Object.fromEntries(new FormData(e.currentTarget))); } catch (err) { setError(err.message); } finally { setBusy(false); } }; return <ModalShell title="Pozvat uživatele" onClose={onClose}><p className="modal-help">Vytvoří se odkaz platný 7 dní. Pozvaný se musí přihlásit nebo zaregistrovat uvedeným e-mailem.</p><form onSubmit={submit} className="app-form"><label>E-mail pozvaného *<input name="email" type="email" required placeholder="kolega@email.cz"/></label><label>Oprávnění<select name="role"><option value="editor">Editor — může měnit data</option><option value="viewer">Náhled — pouze čtení</option></select></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Zrušit</button><button className="primary-button" disabled={busy}>Vytvořit pozvánku</button></div></form></ModalShell>; }
function UsersPage({ data, user, isOwner, inviteLink, onChange, onRemove, onRemoveInvite, onCopyInvite }) {
  return <div className="users-layout">
    <section className="panel"><div className="panel-head"><h2>Členové farmy</h2><span className="count-pill">{data.members.length}</span></div>{data.members.map(member => <div className="member-row" key={member.id}><div className="member-avatar">{member.name.charAt(0).toUpperCase()}</div><div className="member-info"><strong>{member.name}{member.id === user.id && ' (vy)'}</strong><small>{member.email}</small></div>{isOwner && member.role !== 'owner' ? <select aria-label={`Role uživatele ${member.name}`} value={member.role} onChange={e => onChange(member, e.target.value)}><option value="editor">Editor</option><option value="viewer">Náhled</option></select> : <span className="role-pill">{roleName[member.role]}</span>}{member.role !== 'owner' && (isOwner || member.id === user.id) && <button className="icon-button delete" onClick={() => onRemove(member)} aria-label="Odebrat člena"><Trash2 size={17}/></button>}</div>)}</section>
    <section className="panel"><div className="panel-head"><h2>Čekající pozvánky</h2><span className="count-pill">{data.invites.length}</span></div>{data.invites.length ? data.invites.map(invite => <div className="invite-row" key={invite.id}><div className="member-row"><div className="member-avatar invited"><Mail size={18}/></div><div className="member-info"><strong>{invite.email}</strong><small>Platí do {new Date(invite.expires_at).toLocaleDateString('cs-CZ')}</small></div><span className="role-pill">{roleName[invite.role]}</span>{isOwner && <button className="icon-button delete" onClick={() => onRemoveInvite(invite)} aria-label="Zrušit pozvánku"><X size={17}/></button>}</div>{inviteLink?.id === invite.id && <div className="invite-inline"><label>Odkaz pro {invite.email}<input readOnly value={inviteLink.url} onFocus={e => e.target.select()}/></label><button className="secondary-button" onClick={() => onCopyInvite(inviteLink.url)}><Copy size={15}/> Kopírovat</button></div>}</div>) : <Empty title="Žádné čekající pozvánky" text={isOwner ? 'Pozvěte uživatele a sdílejte s ním farmu.' : 'Pozvánky může spravovat vlastník farmy.'}/>}</section>
  </div>;
}
function ProfilePage({ user, onSave, onError }) { const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''); const submit = async e => { e.preventDefault(); const form = e.currentTarget; setBusy(true); setError(''); setSuccess(''); try { await onSave(Object.fromEntries(new FormData(form))); form.elements.namedItem('current_password').value = ''; form.elements.namedItem('new_password').value = ''; setSuccess('Údaje byly uloženy.'); } catch (err) { setError(err.message); onError(err.message); } finally { setBusy(false); } }; return <section className="panel profile-panel"><div className="profile-heading"><div className="member-avatar large">{user.name.charAt(0).toUpperCase()}</div><div><h2>{user.name}</h2><p>{user.email}</p></div></div><form onSubmit={submit} className="app-form"><label>Jméno a příjmení<input name="name" defaultValue={user.name} required/></label><label>E-mail<input name="email" type="email" defaultValue={user.email} required/></label><div className="section-divider"><Shield size={18}/>Zabezpečení účtu</div><label>Nové heslo<input name="new_password" type="password" minLength="8" autoComplete="new-password" placeholder="Ponechte prázdné, pokud jej nechcete měnit"/></label><label>Současné heslo<input name="current_password" type="password" autoComplete="current-password" placeholder="Povinné při změně e-mailu nebo hesla"/></label>{error && <div className="form-error">{error}</div>}{success && <div className="success-banner">{success}</div>}<div><button className="primary-button" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit profil'}</button></div></form></section>; }

function HomePage() {
  return <div className="home-layout"><section className="home-hero"><span className="eyebrow">NOVINKY V APLIKACI</span><h2>Včelaření přehledně,<br/>na každém zařízení.</h2><p>Včelí deník pomáhá spravovat farmy, stanoviště, úly, zásoby i práci u včel. Přístup můžete sdílet s dalšími včelaři.</p><span className="version-badge">Aktuální verze v101126</span></section><div className="home-columns"><section className="panel home-card"><CalendarDays size={25}/><h3>Co je nového</h3><p className="home-version">v101126 · 10. 11. 2026</p><ul><li>Skladové zásoby včetně fotografií</li><li>Podrobnosti o úlech a matkách na mapě</li><li>Nová úvodní stránka</li></ul><p className="home-version">v91126 · 9. 11. 2026</p><ul><li>Farmy, pozvánky a role uživatelů</li><li>Mapa včelích stanovišť</li><li>Správa profilu a evidence</li></ul></section><section className="panel home-card"><Smartphone size={25}/><h3>Aplikace v telefonu</h3><div className="install-step"><strong>Android</strong><p>Otevřete web v Chromu, klepněte na nabídku ⋮ a zvolte „Přidat na plochu“ nebo „Nainstalovat aplikaci“, pokud je tato volba dostupná.</p></div><div className="install-step"><strong>iPhone a iPad</strong><p>Otevřete web v Safari, klepněte na Sdílet a vyberte „Přidat na plochu“.</p></div><p className="install-note">Pro plnohodnotnou instalaci webové aplikace ještě připravujeme podporu PWA.</p></section></div></div>;
}

function StockPage({ items = [], canWrite, onEdit, onDelete }) {
  return items.length ? <div className="stock-grid">{items.map(item => <article className="panel stock-card" key={item.id}><div className="stock-photo">{item.photo ? <img src={item.photo} alt={item.name}/> : <Package size={36}/>}</div><div className="stock-copy"><small>{item.category || 'Ostatní'}</small><h2>{item.name}</h2><strong>{Number(item.quantity).toLocaleString('cs-CZ')} {item.unit}</strong>{item.note && <p>{item.note}</p>}</div>{canWrite && <div className="stock-actions"><button className="secondary-button" onClick={() => onEdit(item)}><Pencil size={15}/> Upravit</button><button className="icon-button delete" onClick={() => onDelete(item)} aria-label={`Smazat ${item.name}`}><Trash2 size={17}/></button></div>}</article>)}</div> : <section className="panel"><Empty title="Sklad je zatím prázdný" text="Přidejte například sklenice, víčka, krmivo nebo včelařské pomůcky."/></section>;
}

async function compressPhoto(file) {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/)) throw Error('Vyberte fotku JPG, PNG nebo WebP.');
  if (file.size > 8_000_000) throw Error('Fotka může mít nejvýše 8 MB.');
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
  const result = canvas.toDataURL('image/jpeg', 0.7);
  if (result.length > 400000) throw Error('Fotka je příliš velká. Vyberte menší obrázek.');
  return result;
}

function StockForm({ item, onClose, onSave }) {
  const [photo, setPhoto] = useState(item?.photo || ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { await onSave({ ...Object.fromEntries(new FormData(event.currentTarget)), photo }); } catch (cause) { setError(cause.message); } finally { setBusy(false); } };
  const choosePhoto = async event => { const file = event.target.files?.[0]; if (!file) return; try { setPhoto(await compressPhoto(file)); setError(''); } catch (cause) { setError(cause.message); } };
  return <ModalShell title={item ? 'Upravit zásobu' : 'Přidat zásobu'} onClose={onClose}><form className="app-form" onSubmit={submit}><label>Název *<input name="name" required maxLength="120" defaultValue={item?.name || ''} placeholder="Např. Sklenice 720 ml"/></label><div className="form-grid"><label>Kategorie<input name="category" maxLength="60" defaultValue={item?.category || ''} placeholder="Sklenice, víčka, krmivo…"/></label><label>Jednotka<input name="unit" maxLength="20" defaultValue={item?.unit || 'ks'} placeholder="ks"/></label></div><label>Množství *<input name="quantity" type="number" min="0" step="any" required defaultValue={item?.quantity ?? 0}/></label><label>Fotka<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto}/></label>{photo && <div className="stock-photo-preview"><img src={photo} alt="Náhled zásoby"/><button type="button" className="secondary-button" onClick={() => setPhoto('')}>Odebrat fotku</button></div>}<label>Poznámka<textarea name="note" rows="3" defaultValue={item?.note || ''}/></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Zrušit</button><button className="primary-button" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit'}</button></div></form></ModalShell>;
}

createRoot(document.getElementById('root')).render(<App/>);
