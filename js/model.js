// ── MODEL — toda la lógica de datos con Firebase ──
import { FB_VER } from './firebase.config.js';

const BASE = `https://www.gstatic.com/firebasejs/${FB_VER}`;

const { initializeApp }  = await import(`${BASE}/firebase-app.js`);
const { getDatabase, ref, get, set, push, update, remove, onValue }
  = await import(`${BASE}/firebase-database.js`);
const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  = await import(`${BASE}/firebase-auth.js`);

import { firebaseConfig } from './firebase.config.js';

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
export const auth = getAuth(app);

// ── Queue ──
export async function fetchQueue(){
  const s = await get(ref(db,'queue'));
  if(!s.exists()) return [];
  return Object.entries(s.val())
    .map(([k,v])=>({_key:k,...v}))
    .sort((a,b)=>(a.ts||0)-(b.ts||0));
}

export function listenQueue(callback){
  return onValue(ref(db,'queue'), snap => {
    const data = snap.exists()
      ? Object.entries(snap.val()).map(([k,v])=>({_key:k,...v})).sort((a,b)=>(a.ts||0)-(b.ts||0))
      : [];
    callback(data);
  });
}

export async function addToQueue(payload){
  const id = `${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  await set(ref(db,`queue/${id}`), { ...payload, ts: Date.now() });
  return id;
}

export async function updateQueueItem(key, data){
  await update(ref(db,`queue/${key}`), data);
}

export async function removeQueueItem(key){
  await remove(ref(db,`queue/${key}`));
}

export async function swapQueueOrder(keyA, tsA, keyB, tsB){
  await Promise.all([
    update(ref(db,`queue/${keyA}`), {ts: tsB}),
    update(ref(db,`queue/${keyB}`), {ts: tsA})
  ]);
}

// ── Historial ──
export async function fetchHist(){
  const s = await get(ref(db,'hist'));
  if(!s.exists()) return [];
  return Object.values(s.val()).map(h =>
    typeof h === 'string' ? {title:h, artist:''} : h
  );
}

export async function addToHist(songs){
  const updates = {};
  songs.forEach(s => {
    updates[`hist/${Date.now()}_${Math.random().toString(36).slice(2)}`] = {
      title: s.title, artist: s.artist || ''
    };
  });
  await update(ref(db), updates);
}

// ── Cooldown ──
export async function fetchCool(){
  const s = await get(ref(db,'cool'));
  return s.exists() ? s.val() : {};
}

export async function setCool(mesa){
  const { COOL_MS } = await import('./firebase.config.js');
  await set(ref(db,`cool/${mesa}`), Date.now() + COOL_MS);
}

// ── Reset noche ──
export async function resetNoche(){
  await Promise.all([
    set(ref(db,'queue'), null),
    set(ref(db,'hist'),  null),
    set(ref(db,'cool'),  null)
  ]);
}

// ── Auth ──
export async function login(email, password){
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout(){
  return signOut(auth);
}

export function onAuth(callback){
  return onAuthStateChanged(auth, callback);
}
