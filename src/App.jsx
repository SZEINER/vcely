import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LayoutDashboard, Map, MapPin, Boxes, ClipboardList, Droplets, HeartPulse, Wallet, Menu, Plus, LogOut, Hexagon, Trash2, X, ChevronRight, Pencil, Eye, Users, UserRound, Sprout, Copy, Check, Shield, Mail } from 'lucide-react';
import './style.css';
import './app.css';

const request = async (path, options = {}) => {
  const response = await fetch('/api' + path, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Nastala chyba.');
  return data;
};
const blank = { farms: [], farm: null, apiaries: [], hives: [], records: [], members: [], invites: [] };
const nav = [['Přehled', LayoutDashboard], ['Mapa', Map], ['Stanoviště', MapPin], ['Úly', Boxes], ['Záznamy', ClipboardList], ['Med', Droplets], ['Léčení', HeartPulse], ['Finance', Wallet], ['Farmy', Sprout], ['Uživatelé', Users], ['Profil', UserRound]];
const types = ['Prohlídka', 'Krmení', 'Léčení', 'Med', 'Finance', 'Poznámka'];
const today = () => new Date().toLocaleDateString('sv-SE');
const roleName = { owner: 'Vlastník', editor: 'Editor', viewer: 'Náhled' };
const subtitles = { Mapa: 'Umístění stanovišť ve vybrané farmě.', Stanoviště: 'Místa, kde se staráte o svá včelstva.', Úly: 'Přehled úlů a matek.', Záznamy: 'Chronologický deník práce u včel.', Med: 'Záznamy o vytáčení a zásobách medu.', Léčení: 'Přehled provedeného léčení.', Finance: 'Příjmy a výdaje spojené se včelařením.', Farmy: 'Vaše farmy a společné pracovní prostory.', Uživatelé: 'Členové a pozvánky vybrané farmy.', Profil: 'Vaše osobní údaje a přístupové heslo.' };

function App() {
  const [user, setUser] = useState(undefined);
  const [data, setData] = useState(blank);
  const [farmId, setFarmId] = useState(localStorage.getItem('farm_id') || '');
  const [page, setPage] = useState('Přehled');
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteLink, setInviteLink] = useState('');
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
    if (kind === 'apiaries' || kind === 'records') payload.farm_id = data.farm?.id;
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
    setInviteLink(`${window.location.origin}/?pozvanka=${result.token}`);
    await refresh(farmId); setModal(null);
    setNotice('Pozvánka byla vytvořena. Zkopírujte odkaz a pošlete jej pozvanému uživateli.');
  };
  const changeMember = async (member, role) => { try { await request(`/farms/${farmId}/members/${member.id}`, { method: 'PATCH', body: JSON.stringify({ role }) }); await refresh(farmId); } catch (e) { setError(e.message); } };
  const removeMember = async member => { if (!confirm(`Odebrat uživatele ${member.name} z farmy?`)) return; try { await request(`/farms/${farmId}/members/${member.id}`, { method: 'DELETE' }); await refresh(member.id === user.id ? '' : farmId); } catch (e) { setError(e.message); } };
  const removeInvite = async invite => { try { await request(`/farms/${farmId}/invites/${invite.id}`, { method: 'DELETE' }); await refresh(farmId); } catch (e) { setError(e.message); } };
  const saveProfile = async payload => { const { user: updated } = await request('/profile', { method: 'PATCH', body: JSON.stringify(payload) }); setUser(updated); setNotice('Profil byl aktualizován.'); };
  if (user === undefined) return <div className="loading">Načítám Včelí deník…</div>;
  if (!user) return <Auth invite={!!inviteToken} onSuccess={u => { setUser(u); refresh('').catch(() => {}); }} />;
  const visibleRecords = ['Med', 'Léčení', 'Finance'].includes(page) ? data.records.filter(r => r.type === page) : data.records;
  const totalHoney = data.records.filter(r => r.type === 'Med' && r.unit === 'kg').reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const createKind = page === 'Stanoviště' ? 'apiaries' : page === 'Úly' ? 'hives' : page === 'Farmy' ? 'farms' : ['Záznamy', 'Med', 'Léčení', 'Finance', 'Přehled'].includes(page) ? 'records' : null;
  const createLabel = { apiaries: 'Nové stanoviště', hives: 'Nový úl', farms: 'Nová farma', records: 'Nový záznam' }[createKind];
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
      {inviteLink && <div className="invite-link-box"><div><strong>Odkaz na pozvánku</strong><input readOnly value={inviteLink} onFocus={e => e.target.select()}/></div><button className="secondary-button" onClick={async () => { await navigator.clipboard.writeText(inviteLink); setNotice('Odkaz byl zkopírován.'); }}><Copy size={15}/> Kopírovat</button><button className="icon-button" onClick={() => setInviteLink('')} aria-label="Zavřít"><X size={16}/></button></div>}
      {page === 'Přehled' && <><div className="stats"><Stat icon={MapPin} label="Stanoviště" value={data.apiaries.length} tone="green"/><Stat icon={Boxes} label="Aktivní úly" value={data.hives.filter(h => h.status === 'Aktivní').length} tone="amber"/><Stat icon={ClipboardList} label="Záznamy" value={data.records.length} tone="blue"/><Stat icon={Droplets} label="Med celkem" value={`${totalHoney.toLocaleString('cs-CZ')} kg`} tone="rose"/></div><div className="dashboard-grid"><section className="panel"><PanelHead title="Poslední záznamy" action={() => setPage('Záznamy')}/><RecordList records={data.records.slice(0, 5)} data={data} compact onView={item => setModal({ type: 'detail', kind: 'records', item })}/></section><section className="panel"><PanelHead title="Stanoviště" action={() => setPage('Stanoviště')}/>{data.apiaries.length ? data.apiaries.slice(0, 4).map(a => <button className="apiary-mini mini-button" key={a.id} onClick={() => setModal({ type: 'detail', kind: 'apiaries', item: a })}><div className="mini-icon"><MapPin size={18}/></div><div><strong>{a.name}</strong><small>{a.location || 'Bez uvedené lokality'} · {data.hives.filter(h => h.apiary_id === a.id).length} úlů</small></div><ChevronRight size={16}/></button>) : <Empty title="Zatím žádné stanoviště" text="Začněte přidáním místa, kde chováte včely."/>}</section></div></>}
      {page === 'Mapa' && <section className="panel map-panel"><MapCanvas apiaries={data.apiaries}/><div className="map-list"><h2>Stanoviště na mapě</h2>{data.apiaries.filter(a => a.latitude !== null && a.longitude !== null).length ? data.apiaries.filter(a => a.latitude !== null && a.longitude !== null).map(a => <button key={a.id} onClick={() => setModal({ type: 'detail', kind: 'apiaries', item: a })}><MapPin size={16}/><span>{a.name}</span><small>{a.location}</small><ChevronRight size={16}/></button>) : <p>Stanoviště zatím nemají souřadnice. Otevřete stanoviště a vyberte jeho polohu na mapě.</p>}</div></section>}
      {page === 'Stanoviště' && <EntityList kind="apiaries" items={data.apiaries} data={data} onView={item => setModal({ type: 'detail', kind: 'apiaries', item })}/>}
      {page === 'Úly' && <EntityList kind="hives" items={data.hives} data={data} onView={item => setModal({ type: 'detail', kind: 'hives', item })}/>}
      {['Záznamy', 'Med', 'Léčení', 'Finance'].includes(page) && <section className="panel list-panel"><RecordList records={visibleRecords} data={data} onView={item => setModal({ type: 'detail', kind: 'records', item })}/></section>}
      {page === 'Farmy' && <section className="farm-grid">{data.farms.map(f => <div className={'panel farm-card ' + (f.id === farmId ? 'selected' : '')} key={f.id}><div className="farm-card-icon"><Sprout size={23}/></div><div><h2>{f.name}</h2><span className="role-pill">{roleName[f.role]}</span></div><p>{f.note || 'Společný prostor pro stanoviště, úly a záznamy.'}</p><div className="farm-card-actions"><button className="secondary-button" onClick={() => selectFarm(f.id)}>Otevřít</button>{f.role === 'owner' && <button className="icon-button" aria-label="Upravit farmu" onClick={() => setModal({ type: 'form', kind: 'farms', item: f })}><Pencil size={17}/></button>}</div></div>)}</section>}
      {page === 'Uživatelé' && <UsersPage data={data} user={user} isOwner={isOwner} onChange={changeMember} onRemove={removeMember} onRemoveInvite={removeInvite}/>}
      {page === 'Profil' && <ProfilePage user={user} onSave={saveProfile} onError={setError}/>}
      </div></main>
    {modal?.type === 'form' && <EntityForm key={`${modal.kind}:${modal.item?.id || 'new'}`} kind={modal.kind} item={modal.item} data={data} defaultType={types.includes(page) ? page : 'Prohlídka'} onClose={() => setModal(null)} onSave={save}/>}
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

function MapCanvas({ apiaries = [], onPick, picked, compact = false }) {
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
      const marker = L.marker(point).addTo(layer);
      const popup = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = a.name; popup.appendChild(strong);
      if (a.location) { const small = document.createElement('div'); small.textContent = a.location; popup.appendChild(small); }
      marker.bindPopup(popup);
    });
    if (picked?.latitude != null && picked?.longitude != null && picked.latitude !== '' && picked.longitude !== '') { const point = [Number(picked.latitude), Number(picked.longitude)]; points.push(point); L.circleMarker(point, { radius: 9, color: '#173f36', fillColor: '#e5af48', fillOpacity: 1 }).addTo(layer); }
    if (points.length > 1) map.fitBounds(points, { padding: [35, 35], maxZoom: 13 });
    else if (points.length === 1) map.setView(points[0], 13);
  }, [apiaries, picked?.latitude, picked?.longitude]);
  return <div className={'map-canvas ' + (compact ? 'compact' : '')} ref={root} role="img" aria-label={onPick ? 'Kliknutím na mapu vyberete souřadnice stanoviště' : 'Mapa včelích stanovišť'}/>;
}

function ModalShell({ title, onClose, children }) { return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><span className="eyebrow">VČELÍ DENÍK</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Zavřít"><X size={21}/></button></div>{children}</div></div>; }
function EntityForm({ kind, item, data, defaultType, onClose, onSave }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [coords, setCoords] = useState({ latitude: item?.latitude ?? '', longitude: item?.longitude ?? '' });
  const titles = { apiaries: 'stanoviště', hives: 'úl', records: 'záznam', farms: 'farmu' };
  const submit = async e => { e.preventDefault(); setBusy(true); setError(''); const payload = Object.fromEntries(new FormData(e.currentTarget)); if (kind === 'apiaries') Object.assign(payload, coords); try { await onSave(kind, item, payload); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <ModalShell title={`${item ? 'Upravit' : 'Přidat'} ${titles[kind]}`} onClose={onClose}><form onSubmit={submit} className="app-form">{kind === 'farms' && <><label>Název farmy *<input name="name" defaultValue={item?.name || ''} required autoFocus placeholder="Např. Rodinná farma"/></label><label>Popis<textarea name="note" rows="3" defaultValue={item?.note || ''}/></label></>}{kind === 'apiaries' && <><label>Název stanoviště *<input name="name" defaultValue={item?.name || ''} required autoFocus placeholder="Např. Zahrada"/></label><label>Lokalita<input name="location" defaultValue={item?.location || ''} placeholder="Obec nebo adresa"/></label><label>Poznámka<textarea name="note" rows="3" defaultValue={item?.note || ''}/></label><div className="map-picker-head"><strong>Poloha na mapě</strong><small>Klikněte na mapu nebo zadejte souřadnice</small></div><MapCanvas compact apiaries={[]} picked={coords} onPick={setCoords}/><div className="form-grid"><label>Zeměpisná šířka<input type="number" step="any" min="-90" max="90" value={coords.latitude} onChange={e => setCoords(c => ({ ...c, latitude: e.target.value }))} placeholder="49.8175"/></label><label>Zeměpisná délka<input type="number" step="any" min="-180" max="180" value={coords.longitude} onChange={e => setCoords(c => ({ ...c, longitude: e.target.value }))} placeholder="15.4730"/></label></div></>}{kind === 'hives' && <><label>Stanoviště *<select name="apiary_id" required defaultValue={item?.apiary_id || ''}><option value="" disabled>Vyberte stanoviště</option>{data.apiaries.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Označení úlu *<input name="name" defaultValue={item?.name || ''} required placeholder="Např. Úl 01"/></label><div className="form-grid"><label>Rok matky<input name="queen_year" type="number" min="2000" max="2100" defaultValue={item?.queen_year || ''}/></label><label>Stav<select name="status" defaultValue={item?.status || 'Aktivní'}><option>Aktivní</option><option>Slabé</option><option>Prázdné</option></select></label></div><label>Poznámka<textarea name="note" rows="3" defaultValue={item?.note || ''}/></label></>}{kind === 'records' && <><div className="form-grid"><label>Typ záznamu *<select name="type" defaultValue={item?.type || defaultType}>{types.map(t => <option key={t}>{t}</option>)}</select></label><label>Datum *<input name="date" type="date" required defaultValue={item?.date || today()}/></label></div><label>Název *<input name="title" required defaultValue={item?.title || ''} placeholder="Co se stalo?"/></label><div className="form-grid"><label>Stanoviště<select name="apiary_id" defaultValue={item?.apiary_id || ''}><option value="">Bez stanoviště</option>{data.apiaries.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Úl<select name="hive_id" defaultValue={item?.hive_id || ''}><option value="">Bez úlu</option>{data.hives.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label></div><div className="form-grid"><label>Množství / částka<input name="amount" type="number" step="any" defaultValue={item?.amount ?? ''}/></label><label>Jednotka<select name="unit" defaultValue={item?.unit || ''}><option value="">Bez jednotky</option><option>kg</option><option>l</option><option>Kč</option><option>ks</option></select></label></div><label>Poznámka<textarea name="note" rows="3" defaultValue={item?.note || ''}/></label></>}{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Zrušit</button><button className="primary-button" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit'}</button></div></form></ModalShell>;
}
function DetailModal({ kind, item, data, canWrite, onClose, onEdit, onDelete }) {
  const name = item.name || item.title;
  const rows = kind === 'apiaries' ? [['Lokalita', item.location || 'Neuvedena'], ['Souřadnice', item.latitude != null ? `${item.latitude}, ${item.longitude}` : 'Neuvedeny'], ['Počet úlů', data.hives.filter(h => h.apiary_id === item.id).length]] : kind === 'hives' ? [['Stanoviště', data.apiaries.find(a => a.id === item.apiary_id)?.name || '—'], ['Stav', item.status], ['Rok matky', item.queen_year || 'Neuveden']] : [['Typ', item.type], ['Datum', new Date(item.date + 'T12:00:00').toLocaleDateString('cs-CZ')], ['Stanoviště', data.apiaries.find(a => a.id === item.apiary_id)?.name || '—'], ['Úl', data.hives.find(h => h.id === item.hive_id)?.name || '—'], ['Množství / částka', item.amount == null ? '—' : `${Number(item.amount).toLocaleString('cs-CZ')} ${item.unit || ''}`]];
  return <ModalShell title={name} onClose={onClose}><div className="detail-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>{item.note && <div className="detail-note"><span>Poznámka</span><p>{item.note}</p></div>}{canWrite && <div className="modal-actions detail-actions"><button className="secondary-button danger-button" onClick={onDelete}><Trash2 size={16}/>Smazat</button><button className="primary-button" onClick={onEdit}><Pencil size={16}/>Upravit</button></div>}</ModalShell>;
}
function InviteModal({ onClose, onSave }) { const [busy, setBusy] = useState(false), [error, setError] = useState(''); const submit = async e => { e.preventDefault(); setBusy(true); try { await onSave(Object.fromEntries(new FormData(e.currentTarget))); } catch (err) { setError(err.message); } finally { setBusy(false); } }; return <ModalShell title="Pozvat uživatele" onClose={onClose}><p className="modal-help">Vytvoří se odkaz platný 7 dní. Pozvaný se musí přihlásit nebo zaregistrovat uvedeným e-mailem.</p><form onSubmit={submit} className="app-form"><label>E-mail pozvaného *<input name="email" type="email" required placeholder="kolega@email.cz"/></label><label>Oprávnění<select name="role"><option value="editor">Editor — může měnit data</option><option value="viewer">Náhled — pouze čtení</option></select></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Zrušit</button><button className="primary-button" disabled={busy}>Vytvořit pozvánku</button></div></form></ModalShell>; }
function UsersPage({ data, user, isOwner, onChange, onRemove, onRemoveInvite }) { return <div className="users-layout"><section className="panel"><div className="panel-head"><h2>Členové farmy</h2><span className="count-pill">{data.members.length}</span></div>{data.members.map(member => <div className="member-row" key={member.id}><div className="member-avatar">{member.name.charAt(0).toUpperCase()}</div><div className="member-info"><strong>{member.name}{member.id === user.id && ' (vy)'}</strong><small>{member.email}</small></div>{isOwner && member.role !== 'owner' ? <select aria-label={`Role uživatele ${member.name}`} value={member.role} onChange={e => onChange(member, e.target.value)}><option value="editor">Editor</option><option value="viewer">Náhled</option></select> : <span className="role-pill">{roleName[member.role]}</span>}{member.role !== 'owner' && (isOwner || member.id === user.id) && <button className="icon-button delete" onClick={() => onRemove(member)} aria-label="Odebrat člena"><Trash2 size={17}/></button>}</div>)}</section><section className="panel"><div className="panel-head"><h2>Čekající pozvánky</h2><span className="count-pill">{data.invites.length}</span></div>{data.invites.length ? data.invites.map(invite => <div className="member-row" key={invite.id}><div className="member-avatar invited"><Mail size={18}/></div><div className="member-info"><strong>{invite.email}</strong><small>Platí do {new Date(invite.expires_at).toLocaleDateString('cs-CZ')}</small></div><span className="role-pill">{roleName[invite.role]}</span><button className="icon-button delete" onClick={() => onRemoveInvite(invite)} aria-label="Zrušit pozvánku"><X size={17}/></button></div>) : <Empty title="Žádné čekající pozvánky" text={isOwner ? 'Pozvěte uživatele a sdílejte s ním farmu.' : 'Pozvánky může spravovat vlastník farmy.'}/>}</section></div>; }
function ProfilePage({ user, onSave, onError }) { const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''); const submit = async e => { e.preventDefault(); const form = e.currentTarget; setBusy(true); setError(''); setSuccess(''); try { await onSave(Object.fromEntries(new FormData(form))); form.elements.namedItem('current_password').value = ''; form.elements.namedItem('new_password').value = ''; setSuccess('Údaje byly uloženy.'); } catch (err) { setError(err.message); onError(err.message); } finally { setBusy(false); } }; return <section className="panel profile-panel"><div className="profile-heading"><div className="member-avatar large">{user.name.charAt(0).toUpperCase()}</div><div><h2>{user.name}</h2><p>{user.email}</p></div></div><form onSubmit={submit} className="app-form"><label>Jméno a příjmení<input name="name" defaultValue={user.name} required/></label><label>E-mail<input name="email" type="email" defaultValue={user.email} required/></label><div className="section-divider"><Shield size={18}/>Zabezpečení účtu</div><label>Nové heslo<input name="new_password" type="password" minLength="8" autoComplete="new-password" placeholder="Ponechte prázdné, pokud jej nechcete měnit"/></label><label>Současné heslo<input name="current_password" type="password" autoComplete="current-password" placeholder="Povinné při změně e-mailu nebo hesla"/></label>{error && <div className="form-error">{error}</div>}{success && <div className="success-banner">{success}</div>}<div><button className="primary-button" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit profil'}</button></div></form></section>; }

createRoot(document.getElementById('root')).render(<App/>);
