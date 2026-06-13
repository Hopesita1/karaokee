// ── MESAS CONTROLLER ──
import { firebaseConfig, FB_VER, COOL_MS, TOTAL_MESAS } from './firebase.config.js';
import { initBg } from './bg.js';

const BASE = `https://www.gstatic.com/firebasejs/${FB_VER}`;
const { initializeApp } = await import(`${BASE}/firebase-app.js`);
const { getDatabase, ref, get, set, push, update } = await import(`${BASE}/firebase-database.js`);

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ── Estado ──
let curMesa = null;
let songs   = [];
let cdTimer = null;

// ── Fondo animado (solo en pantalla home) ──
initBg('bg');

// ── MODEL ──
async function getCool(){
  const s = await get(ref(db,'cool'));
  return s.exists() ? s.val() : {};
}

async function getHist(){
  const s = await get(ref(db,'hist'));
  if(!s.exists()) return [];
  return Object.values(s.val()).map(h =>
    typeof h === 'string' ? {title:h, artist:''} : h
  );
}

// ── VIEW: pantallas ──
function show(id){
  ['home','pedir'].forEach(x => {
    const el = document.getElementById(x);
    if(el) el.style.display = x === id ? (x === 'home' ? 'flex' : 'block') : 'none';
  });
}
window.show = show;

// ── CONTROLLER: abrir mesa ──
function openMesa(n){
  curMesa = n;
  document.getElementById('mesaNum').textContent = n;
  document.getElementById('fTeam').value = '';
  document.getElementById('okBox').style.display = 'none';
  songs = [];
  document.getElementById('songsContainer').innerHTML = '';
  addSong();
  checkCD();
  show('pedir');
}
window.openMesa = openMesa;

// ── CONTROLLER: ir a mesas ──
function showMesas(){ renderMesas(); show('mesas'); }
window.showMesas = showMesas;

// ── CONTROLLER: cooldown ──
async function checkCD(){
  if(cdTimer) clearTimeout(cdTimer);
  const cool = await getCool();
  const cd   = cool[curMesa];
  const btn  = document.getElementById('subBtn');
  const box  = document.getElementById('timerBox');
  if(cd && Date.now() < cd){
    const rem = Math.ceil((cd - Date.now()) / 1000);
    const m   = Math.floor(rem/60);
    const s   = rem % 60;
    box.style.display = 'block';
    box.textContent   = `— Podras pedir de nuevo en ${m}:${s<10?'0':''}${s}`;
    btn.disabled      = true;
    btn.textContent   = 'Espera tu turno';
    cdTimer = setTimeout(checkCD, 1000);
  } else {
    box.style.display = 'none';
    btn.disabled      = false;
    btn.textContent   = 'Pedir canciones';
  }
}

// ── VIEW: agregar canción ──
function addSong(){
  const idx = songs.length;
  if(idx >= 3) return;
  songs.push({ title:'', artist:'' });
  const c = document.getElementById('songsContainer');
  const d = document.createElement('div');
  d.className = 'song-box';
  d.id = `s${idx}`;
  d.innerHTML = `
    <div class="song-hdr">
      <h4>Cancion ${idx+1}</h4>
      ${idx > 0 ? `<button class="rm-btn" data-idx="${idx}">✕</button>` : ''}
    </div>
    <div class="fld" style="margin-bottom:8px;">
      <label>Nombre de la cancion</label>
      <input type="text" id="songTitle${idx}" placeholder="Ej: Amor Eterno" maxlength="60">
    </div>
    <div class="fld" style="margin-bottom:0;">
      <label>Artista (si es diferente)</label>
      <input type="text" id="songArtist${idx}" placeholder="Ej: Rocio Durcal" maxlength="40">
    </div>`;
  c.appendChild(d);
  if(songs.length >= 3) document.getElementById('addBtn').style.display = 'none';
}
window.addSong = addSong;

// ── CONTROLLER: eliminar canción ──
document.getElementById('songsContainer').addEventListener('click', e => {
  const btn = e.target.closest('.rm-btn');
  if(!btn) return;
  const idx = parseInt(btn.dataset.idx);
  songs.splice(idx, 1);
  document.getElementById('songsContainer').innerHTML = '';
  document.getElementById('addBtn').style.display = 'block';
  const count = songs.length;
  songs = [];
  for(let i = 0; i < count; i++) addSong();
});

// ── VIEW: overlay duplicado ──
function showDupOverlay(dups){
  document.getElementById('dupSongsList').innerHTML = dups.map(d =>
    `<div class="dup-song-tag">${d.title}${d.artist?' — '+d.artist:''}</div>`
  ).join('');
  document.getElementById('dupOverlay').classList.add('show');
}

function closeDupOverlay(){
  document.getElementById('dupOverlay').classList.remove('show');
}
window.closeDupOverlay = closeDupOverlay;

// ── CONTROLLER: enviar petición ──
async function submitReq(){
  const team  = document.getElementById('fTeam').value.trim();
  const valid = [];
  for(let i = 0; i < songs.length; i++){
    const title  = (document.getElementById(`songTitle${i}`)?.value  || '').trim();
    const artist = (document.getElementById(`songArtist${i}`)?.value || '').trim();
    if(title) valid.push({ title, artist });
  }

  if(!team)         { alert('Por favor escribe el nombre de tu equipo.'); return; }
  if(!valid.length) { alert('Agrega al menos una cancion.'); return; }

  // Validar duplicados: mismo título Y mismo artista
  const hist = await getHist();
  const dups = valid.filter(s =>
    hist.some(h => {
      const sameTitle  = h.title.trim().toLowerCase() === s.title.toLowerCase();
      const bothArtist = h.artist.trim() !== '' && s.artist !== '';
      const sameArtist = h.artist.trim().toLowerCase() === s.artist.toLowerCase();
      return sameTitle && (!bothArtist || sameArtist);
    })
  );
  if(dups.length){ showDupOverlay(dups); return; }

  const btn = document.getElementById('subBtn');
  btn.disabled    = true;
  btn.textContent = 'Enviando...';

  try {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    await set(ref(db,`queue/${id}`), {
      mesa: curMesa, team, songs: valid, status:'waiting', ts: Date.now()
    });

    const histUpdates = {};
    valid.forEach(s => {
      histUpdates[`hist/${Date.now()}_${Math.random().toString(36).slice(2)}`] = {
        title: s.title, artist: s.artist
      };
    });
    await update(ref(db), histUpdates);
    await set(ref(db,`cool/${curMesa}`), Date.now() + COOL_MS);

    document.getElementById('okBox').style.display = 'block';
    checkCD();
  } catch(e){
    console.error(e);
    alert('Error al enviar. Verifica tu conexion.');
    btn.disabled    = false;
    btn.textContent = 'Pedir canciones';
  }
}
window.submitReq = submitReq;

// ── Arranque ──
const params    = new URLSearchParams(window.location.search);
const mesaParam = parseInt(params.get('mesa'));
if(mesaParam >= 1 && mesaParam <= TOTAL_MESAS){
  openMesa(mesaParam);
} else {
  show('home');
}

// Refresco cooldown cada 5s
setInterval(() => {
  if(curMesa && document.getElementById('pedir').style.display !== 'none') checkCD();
}, 5000);
