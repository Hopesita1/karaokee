// ── LOGIN CONTROLLER ──
import { FB_VER, firebaseConfig } from './firebase.config.js';
import { initBg } from './bg.js';

const BASE = `https://www.gstatic.com/firebasejs/${FB_VER}`;
const { initializeApp }             = await import(`${BASE}/firebase-app.js`);
const { getAuth, signInWithEmailAndPassword, onAuthStateChanged }
  = await import(`${BASE}/firebase-auth.js`);

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Fondo animado
initBg('bgLogin');

// Si ya hay sesión activa, redirige directo al panel
onAuthStateChanged(auth, user => {
  if(user) window.location.href = 'Presentadora.html';
});

// ── DOM ──
const btn   = document.getElementById('loginBtn');
const email = document.getElementById('lEmail');
const pass  = document.getElementById('lPass');
const errEl = document.getElementById('loginError');

function showError(msg){
  errEl.textContent = msg;
  errEl.classList.add('show');
}
function clearError(){
  errEl.classList.remove('show');
}

async function doLogin(){
  clearError();
  const e = email.value.trim();
  const p = pass.value;
  if(!e || !p){ showError('Completa correo y contrasena.'); return; }

  btn.disabled    = true;
  btn.textContent = 'Verificando...';

  try {
    await signInWithEmailAndPassword(auth, e, p);
    // onAuthStateChanged redirige automáticamente
  } catch(err){
    console.error('Login error:', err.code, err.message);
    btn.disabled    = false;
    btn.textContent = 'Entrar';
    const msgs = {
      'auth/invalid-credential':  'Correo o contrasena incorrectos.',
      'auth/invalid-email':       'El correo no es valido.',
      'auth/user-not-found':      'No existe una cuenta con ese correo.',
      'auth/wrong-password':      'Contrasena incorrecta.',
      'auth/too-many-requests':   'Demasiados intentos. Espera un momento.',
      'auth/network-request-failed': 'Sin conexion. Verifica tu red.'
    };
    showError(msgs[err.code] || `Error: ${err.code}`);
  }
}

btn.addEventListener('click', doLogin);
pass.addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
