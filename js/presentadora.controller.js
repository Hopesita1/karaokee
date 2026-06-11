// ── PRESENTADORA CONTROLLER ──
import { FB_VER, firebaseConfig } from './firebase.config.js';
import { initBg } from './bg.js';

const BASE = `https://www.gstatic.com/firebasejs/${FB_VER}`;
const { initializeApp }  = await import(`${BASE}/firebase-app.js`);
const { getDatabase, ref, get, set, update, remove, onValue }
  = await import(`${BASE}/firebase-database.js`);
const { getAuth, onAuthStateChanged, signOut }
  = await import(`${BASE}/firebase-auth.js`);

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// ── Guard: si no está autenticado, manda al login ──
onAuthStateChanged(auth, user => {
  if(!user) window.location.href = 'login.html';
});

// ── Fondo animado ──
initBg('bgPres');

// ── Estado ──
let queue      = [];
let histVisible = false;
let editingKey  = null;

// ── Toast ──
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── MODEL: escucha en tiempo real ──
onValue(ref(db,'queue'), snap => {
  queue = snap.exists()
    ? Object.entries(snap.val()).map(([k,v]) => ({_key:k,...v})).sort((a,b) => (a.ts||0)-(b.ts||0))
    : [];
  renderQueue();
});

// ── MODEL: historial ──
async function fetchHist(){
  const s = await get(ref(db,'hist'));
  return s.exists() ? Object.values(s.val()) : [];
}

// ── VIEW: render cola ──
function formatTime(ts){
  return new Date(ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
}

function renderQueue(){
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  const filtered = search ? queue.filter(item =>
    item.team.toLowerCase().includes(search) ||
    String(item.mesa).includes(search) ||
    (item.songs||[]).some(s => s.title.toLowerCase().includes(search))
  ) : queue;

  const waiting    = queue.filter(q => q.status==='waiting').length;
  const playing    = queue.filter(q => q.status==='playing').length;
  const done       = queue.filter(q => q.status==='done').length;
  const mesas      = new Set(queue.filter(q => q.status!=='done').map(q => q.mesa)).size;
  const totalSongs = queue.reduce((acc,q) => acc+(q.songs||[]).length, 0);

  document.getElementById('statEspera').textContent    = waiting + playing;
  document.getElementById('statCanciones').textContent = totalSongs;
  document.getElementById('statMesas').textContent     = mesas;
  document.getElementById('badgeTotal').textContent    = `${queue.length} total`;
  document.getElementById('badgeWait').textContent     = `${waiting} en espera`;
  document.getElementById('badgeDone').textContent     = `${done} listos`;
  document.getElementById('queueLabel').textContent    = search
    ? `Resultados (${filtered.length})`
    : `Cola de peticiones (${queue.length})`;

  const c = document.getElementById('qList');
  if(!filtered.length){
    c.innerHTML = `<div class="empty"><div class="empty-icon">—</div><p>${
      search ? `Sin resultados para "${search}"` : 'Aun no hay peticiones.<br>Las mesas empezaran pronto.'
    }</p></div>`;
    return;
  }

  c.innerHTML = '';
  let waitPos = 0;
  filtered.forEach(item => {
    const isPlaying = item.status === 'playing';
    const isDone    = item.status === 'done';
    if(!isDone && !isPlaying) waitPos++;

    const qIdx     = queue.findIndex(x => x._key === item._key);
    const mClass   = 'q-mesa-badge' + (isPlaying?' playing-b':'') + (isDone?' done-b':'');
    const songTags = (item.songs||[]).map(s =>
      `<span class="q-song-tag">${s.title}${s.artist?' — '+s.artist:''}</span>`
    ).join('');
    const pillHtml = isPlaying
      ? '<span class="q-pill pill-playing">&#9654; En turno</span>'
      : isDone ? '' : '<span class="q-pill pill-wait">En espera</span>';

    const d = document.createElement('div');
    d.className = 'q-item' + (isPlaying?' playing':'') + (isDone?' done':'');
    d.innerHTML = `
      <div class="q-order">
        <div class="q-pos">${isDone ? '&#10003;' : (isPlaying ? '&#9654;' : '#'+waitPos)}</div>
        <div class="${mClass}">${item.mesa}</div>
      </div>
      <div class="q-info">
        <div class="q-top">
          <span class="q-pill pill-mesa">Mesa ${item.mesa}</span>
          <span class="q-team">${item.team}</span>
          ${pillHtml}
        </div>
        <div class="q-songs">${songTags}</div>
        <div class="q-time">Pedido a las ${formatTime(item.ts||0)}</div>
      </div>
      <div class="q-actions">
        ${!isDone ? `
          ${qIdx > 0 && queue[qIdx-1]?.status !== 'done'
            ? `<button class="qa" data-action="up" data-key="${item._key}" title="Subir">&#8593;</button>` : ''}
          ${qIdx < queue.length-1
            ? `<button class="qa" data-action="down" data-key="${item._key}" title="Bajar">&#8595;</button>` : ''}
          ${!isPlaying
            ? `<button class="qa play-qa" data-action="play" data-key="${item._key}" title="Dar turno">&#9654;</button>` : ''}
          <button class="qa" data-action="edit" data-key="${item._key}" title="Editar">&#9998;</button>
          <button class="qa done-qa" data-action="done" data-key="${item._key}" title="Marcar listo">&#10003;</button>
        ` : `<button class="qa del-qa" data-action="del" data-key="${item._key}" title="Eliminar">&#10005;</button>`}
      </div>`;
    c.appendChild(d);
  });

  if(histVisible) renderHist();
}

// ── VIEW: historial ──
async function renderHist(){
  const hist = await fetchHist();
  const c = document.getElementById('histList');
  c.innerHTML = hist.length
    ? hist.map(h => {
        const label = typeof h === 'object' ? `${h.title}${h.artist?' — '+h.artist:''}` : h;
        return `<span class="hist-tag">${label}</span>`;
      }).join('')
    : '<span style="font-size:12px;color:#3a4a30;">Sin canciones aun</span>';
}

// ── CONTROLLER: delegación de eventos en cola ──
document.getElementById('qList').addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const { action, key } = btn.dataset;
  const idx = queue.findIndex(x => x._key === key);

  if(action === 'up' && idx > 0){
    const tsA = queue[idx].ts, tsB = queue[idx-1].ts;
    await Promise.all([
      update(ref(db,`queue/${queue[idx]._key}`),   {ts: tsB}),
      update(ref(db,`queue/${queue[idx-1]._key}`), {ts: tsA})
    ]);
    toast('Orden actualizado');
  }
  if(action === 'down' && idx < queue.length-1){
    const tsA = queue[idx].ts, tsB = queue[idx+1].ts;
    await Promise.all([
      update(ref(db,`queue/${queue[idx]._key}`),   {ts: tsB}),
      update(ref(db,`queue/${queue[idx+1]._key}`), {ts: tsA})
    ]);
    toast('Orden actualizado');
  }
  if(action === 'play'){
    const updates = {};
    queue.forEach(item => {
      if(item.status === 'playing') updates[`queue/${item._key}/status`] = 'waiting';
    });
    updates[`queue/${key}/status`] = 'playing';
    await update(ref(db), updates);
    const item = queue.find(x => x._key === key);
    toast(`Es el turno de: ${item.team} — Mesa ${item.mesa}`);
  }
  if(action === 'done'){
    await update(ref(db,`queue/${key}`), {status:'done'});
    toast('Marcado como listo');
  }
  if(action === 'del'){
    await remove(ref(db,`queue/${key}`));
    toast('Peticion eliminada');
  }
  if(action === 'edit') openEdit(key);
});

// ── CONTROLLER: reset ──
document.getElementById('resetBtn').addEventListener('click', async () => {
  if(!confirm('¿Resetear toda la noche? Se borraran peticiones, historial y cooldowns.')) return;
  await Promise.all([
    set(ref(db,'queue'), null),
    set(ref(db,'hist'),  null),
    set(ref(db,'cool'),  null)
  ]);
  toast('Noche reiniciada');
});

// ── CONTROLLER: historial ──
document.getElementById('histBtn').addEventListener('click', () => {
  histVisible = !histVisible;
  document.getElementById('histSection').style.display = histVisible ? 'block' : 'none';
  if(histVisible) renderHist();
});

// ── CONTROLLER: búsqueda ──
document.getElementById('searchInput').addEventListener('input', renderQueue);

// ── CONTROLLER: logout ──
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

// ── CONTROLLER: modal editar ──
function openEdit(key){
  editingKey = key;
  const item = queue.find(x => x._key === key);
  document.getElementById('editTeam').value   = item.team;
  document.getElementById('editArtist').value = item.artist || '';
  const sc = document.getElementById('editSongs');
  sc.innerHTML = '';
  (item.songs||[]).forEach((s, i) => {
    sc.innerHTML += `
      <div class="fld"><label>Cancion ${i+1}</label>
        <input type="text" id="eSong${i}" value="${s.title}" maxlength="60">
      </div>
      <div class="fld"><label>Artista cancion ${i+1}</label>
        <input type="text" id="eArt${i}" value="${s.artist||''}" maxlength="40">
      </div>`;
  });
  document.getElementById('modalBg').classList.add('open');
}

document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalBg').addEventListener('click', e => {
  if(e.target === document.getElementById('modalBg')) closeModal();
});

function closeModal(){
  document.getElementById('modalBg').classList.remove('open');
  editingKey = null;
}

document.getElementById('modalSave').addEventListener('click', async () => {
  if(!editingKey) return;
  const item    = queue.find(x => x._key === editingKey);
  const newTeam = document.getElementById('editTeam').value.trim()   || item.team;
  const newArt  = document.getElementById('editArtist').value.trim();
  const newSongs = (item.songs||[]).map((s, i) => ({
    title:  (document.getElementById(`eSong${i}`)?.value.trim() || s.title),
    artist: (document.getElementById(`eArt${i}`)?.value.trim()  || '')
  }));
  await update(ref(db,`queue/${editingKey}`), {team: newTeam, artist: newArt, songs: newSongs});
  closeModal();
  toast('Peticion actualizada');
});
