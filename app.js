import { FIREBASE_CONFIG, isFirebaseConfigured, SHARED_LOGIN_EMAIL } from './firebase-config.js';

// ============================================================================
// Constantes
// ============================================================================
const PLANTS = [
  { id: 'neau', label: 'Neau' },
  { id: 'saint-gaultier', label: 'Saint-Gaultier' },
  { id: 'terrasson', label: 'Terrasson' },
  { id: 'sauveterre', label: 'Sauveterre' },
  { id: 'lotus', label: 'Lotus' },
];

const ROWS = [
  { key: 'S', label: 'Sécurité', accent: '#C9542C' },
  { key: 'Q', label: 'Qualité', accent: '#3E6B8A' },
  { key: 'C', label: 'Coûts', accent: '#B08A3E' },
  { key: 'D', label: 'Délais', accent: '#3E7A8A' },
  { key: 'P', label: 'Personnel', accent: '#7A5C8A' },
  { key: 'E', label: 'Environnement', accent: '#3E8A78' },
];

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAY_LETTERS = ['L','M','M','J','V','S','D'];

const STATE_STYLE = {
  neutral: { bg: '#33373A', border: '#44494C' },
  green:   { bg: '#3F9142', border: '#2E6B31' },
  red:     { bg: '#C0392B', border: '#8E2A20' },
};

// ============================================================================
// Store : abstraction Firestore (multi-appareils) ou localStorage (secours)
// ============================================================================
let firestoreDb = null;
let firestoreApi = null;
let firebaseAuth = null;
let authApi = null;
const USING_CLOUD = isFirebaseConfigured();

async function initFirebaseIfNeeded() {
  if (!USING_CLOUD) return;
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js');
  const fs = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js');
  const app = initializeApp(FIREBASE_CONFIG);

  firestoreDb = fs.getFirestore(app);
  try {
    await fs.enableIndexedDbPersistence(firestoreDb);
  } catch (e) {
    console.warn('Persistance hors-ligne indisponible :', e.message);
  }
  firestoreApi = fs;

  firebaseAuth = authMod.getAuth(app);
  try {
    await authMod.setPersistence(firebaseAuth, authMod.browserLocalPersistence);
  } catch (e) {
    console.warn('Persistance de connexion indisponible :', e.message);
  }
  authApi = authMod;
}

function docKey(plantId, year, month) {
  return `${plantId}__${year}-${String(month).padStart(2, '0')}`;
}

/**
 * subscribe(plantId, year, month, callback)
 * callback reçoit { states, comments } à chaque mise à jour.
 * Retourne une fonction unsubscribe().
 */
function subscribe(plantId, year, month, callback) {
  if (USING_CLOUD && firestoreDb) {
    const ref = firestoreApi.doc(firestoreDb, 'plants', plantId, 'months', `${year}-${String(month).padStart(2,'0')}`);
    return firestoreApi.onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {};
      callback({ states: data.states || {}, comments: data.comments || {} });
    }, (err) => {
      console.error('Erreur de synchronisation Firestore :', err);
    });
  }
  // Mode local : lecture immédiate + écoute des changements inter-onglets
  const key = 'sf_' + docKey(plantId, year, month);
  const read = () => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : { states: {}, comments: {} };
    } catch (e) {
      return { states: {}, comments: {} };
    }
  };
  callback(read());
  const onStorage = (e) => { if (e.key === key) callback(read()); };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

async function saveData(plantId, year, month, { states, comments }) {
  if (USING_CLOUD && firestoreDb) {
    const ref = firestoreApi.doc(firestoreDb, 'plants', plantId, 'months', `${year}-${String(month).padStart(2,'0')}`);
    await firestoreApi.setDoc(ref, { states, comments, updatedAt: Date.now() }, { merge: true });
    return;
  }
  const key = 'sf_' + docKey(plantId, year, month);
  localStorage.setItem(key, JSON.stringify({ states, comments }));
}

// ============================================================================
// Helpers date
// ============================================================================
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function dowLetter(year, month, day) {
  const jsDow = new Date(year, month - 1, day).getDay();
  return DAY_LETTERS[(jsDow + 6) % 7];
}
function isWeekend(year, month, day) {
  const jsDow = new Date(year, month - 1, day).getDay();
  return jsDow === 0 || jsDow === 6;
}
function nextState(s) {
  if (!s || s === 'neutral') return 'green';
  if (s === 'green') return 'red';
  return 'neutral';
}

function isPastDay(year, month, day) {
  const t = new Date();
  const todayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return new Date(year, month - 1, day) < todayStart;
}

// ============================================================================
// État applicatif
// ============================================================================
const today = new Date();
let state = {
  plantId: localStorage.getItem('sf_plant') || 'neau',
  year: today.getFullYear(),
  month: today.getMonth() + 1,
  states: {},
  comments: {},
  loading: true,
  unsubscribe: null,
  modal: null, // { type: 'note'|'confirm', rowKey, day, label }
};

// ============================================================================
// Rendu
// ============================================================================
const app = document.getElementById('app');

function render() {
  const totalDays = daysInMonth(state.year, state.month);
  const isCurrentMonth = state.year === today.getFullYear() && state.month === today.getMonth() + 1;
  const todayDay = today.getDate();
  const plant = PLANTS.find(p => p.id === state.plantId);

  app.innerHTML = `
    ${!USING_CLOUD ? `
    <div class="banner">
      ⚠️ Mode local : les données sont sauvegardées uniquement sur cet appareil. Configurez Firebase (voir README.md) pour synchroniser tous les sites et appareils en temps réel.
    </div>` : ''}

    <div class="header">
      <div>
        <div class="eyebrow">SITE : ${plant.label.toUpperCase()}</div>
        <h1>Usine de ${plant.label} <span class="dash">–</span> <span class="accent">Safety First</span></h1>
        <p class="subtitle">Sécurité · Qualité · Coûts · Délais · Personnel · Environnement — point quotidien de l'équipe de direction</p>
      </div>
      <div class="controls">
        <select id="plant-select">
          ${PLANTS.map(p => `<option value="${p.id}" ${p.id === state.plantId ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select>
        <button class="nav-btn" id="prev-month" aria-label="Mois précédent">‹</button>
        <div class="month-label">${MONTHS_FR[state.month - 1]} ${state.year}</div>
        <button class="nav-btn" id="next-month" aria-label="Mois suivant">›</button>
        ${!isCurrentMonth ? `<button class="btn nav-btn btn-today" id="go-today">Aujourd'hui</button>` : ''}
        ${USING_CLOUD ? `<button class="btn nav-btn btn-today" id="logout-btn" title="Se déconnecter">Déconnexion</button>` : ''}
      </div>
    </div>

    ${isCurrentMonth ? renderTodayPanel(todayDay) : ''}

    <div class="legend">
      <span class="legend-item"><span class="legend-dot" style="background:${STATE_STYLE.green.bg}"></span>Objectif atteint</span>
      <span class="legend-item"><span class="legend-dot" style="background:${STATE_STYLE.red.bg}"></span>Écart constaté</span>
      <span class="legend-item"><span class="legend-dot" style="background:${STATE_STYLE.neutral.bg}"></span>Non renseigné</span>
      <span class="legend-item"><span class="legend-dot" style="background:#E08B2E;border-radius:50%;width:14px;height:14px;"></span>Commentaire (s'affiche au clic)</span>
      <span class="legend-item"><span class="legend-dot" style="background:#5A5F62;width:8px;height:8px;border-radius:50%"></span>Jour passé (confirmation requise)</span>
    </div>

    <div class="grid-panel">
      ${state.loading ? `<div style="padding:30px;text-align:center;color:var(--text-muted)">Chargement du tableau…</div>` : renderGrid(totalDays, isCurrentMonth, todayDay)}
    </div>

    <div class="footer-note">
      ${USING_CLOUD ? "Les données et commentaires sont synchronisés en temps réel entre tous les appareils connectés à ce site." : "Passez en mode cloud (README.md) pour partager ce tableau entre plusieurs appareils et sites."}
      Clic simple : voir le commentaire s'il existe, et changer le statut (confirmation demandée pour les jours passés). Double-clic : ajouter / modifier le commentaire.
    </div>

    <div class="modal-overlay ${state.modal ? '' : 'hidden'}" id="modal-overlay">
      ${state.modal ? renderModal() : ''}
    </div>
  `;

  attachEvents(totalDays);
}

function renderTodayPanel(todayDay) {
  return `
    <div class="today-panel">
      <div class="today-panel-head">
        <div class="today-panel-title">POINT DU JOUR — ${todayDay} ${MONTHS_FR[state.month - 1]}</div>
        <div class="save-status" id="save-status">Clic : statut · icône note : commentaire</div>
      </div>
      <div class="lamps">
        ${ROWS.map(({ key, label, accent }) => {
          const s = state.states[`${key}-${todayDay}`] || 'neutral';
          const st = STATE_STYLE[s];
          const hasNote = !!state.comments[`${key}-${todayDay}`];
          return `
            <div class="lamp-card" style="border:1px solid ${accent}55">
              <button class="note-icon ${hasNote ? 'has-note' : ''}" data-note-row="${key}" data-note-day="${todayDay}" data-note-label="${label}" title="Ajouter / voir le commentaire">✎</button>
              <button class="lamp" data-cell-row="${key}" data-cell-day="${todayDay}" style="background:${st.bg};border-color:${st.border};${s !== 'neutral' ? `box-shadow:0 0 18px 2px ${st.bg}88;` : ''}">${key}</button>
              <span class="lamp-label">${label}</span>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderGrid(totalDays, isCurrentMonth, todayDay) {
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  return `
    <table>
      <thead>
        <tr>
          <th style="width:140px"></th>
          ${days.map(d => `
            <th style="padding:0">
              <div class="day-col-head ${isCurrentMonth && d === todayDay ? 'today' : ''}">
                <span>${dowLetter(state.year, state.month, d)}</span>
                <span class="num">${d}</span>
              </div>
            </th>`).join('')}
          <th style="width:70px;font-size:11px;color:#7C8186">% VERT</th>
        </tr>
      </thead>
      <tbody>
        ${ROWS.map(({ key, label, accent }) => {
          let green = 0, filled = 0;
          days.forEach(d => {
            const s = state.states[`${key}-${d}`];
            if (s === 'green') { green++; filled++; }
            else if (s === 'red') { filled++; }
          });
          const pct = filled ? Math.round((green / filled) * 100) : null;
          const pctColor = pct === null ? '#5A5F62' : pct >= 80 ? '#3F9142' : pct >= 50 ? '#B08A3E' : '#C0392B';
          return `
            <tr>
              <td>
                <div class="row-label" style="border-left:4px solid ${accent}">
                  <span class="row-letter" style="color:${accent}">${key}</span>
                  <span class="row-name">${label}</span>
                </div>
              </td>
              ${days.map(d => {
                const s = state.states[`${key}-${d}`] || 'neutral';
                const st = STATE_STYLE[s];
                const isToday = isCurrentMonth && d === todayDay;
                const weekend = isWeekend(state.year, state.month, d);
                const hasNote = !!state.comments[`${key}-${d}`];
                const past = isPastDay(state.year, state.month, d);
                return `
                  <td style="padding:0">
                    <button class="cell-btn" data-cell-row="${key}" data-cell-day="${d}"
                      title="${label} — jour ${d}${past ? ' (jour passé, confirmation requise)' : ''}"
                      style="background:${st.bg};border:${isToday ? '2px solid #E08B2E' : `1px solid ${st.border}`};opacity:${weekend && s === 'neutral' ? 0.45 : 1}">
                      ${hasNote ? '<span class="note-dot"></span>' : ''}
                      ${past ? '<span class="lock-dot"></span>' : ''}
                    </button>
                  </td>`;
              }).join('')}
              <td><div class="pct-cell" style="color:${pctColor}">${pct === null ? '—' : pct + '%'}</div></td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderModal() {
  const { type, rowKey, day, label } = state.modal;
  const id = `${rowKey}-${day}`;

  if (type === 'confirm') {
    return `
      <div class="modal">
        <div class="modal-title warn">MODIFICATION D'UNE DONNÉE PASSÉE</div>
        <div class="modal-sub">${label} — jour ${day} ${MONTHS_FR[state.month - 1]} ${state.year}</div>
        <div class="modal-body-text">Cette journée est déjà passée. Confirmez-vous le changement de statut pour ce critère ?</div>
        <div class="modal-actions">
          <button class="btn-cancel" id="confirm-cancel">Annuler</button>
          <button class="btn-save" id="confirm-ok">Confirmer la modification</button>
        </div>
      </div>`;
  }

  const text = state.comments[id] || '';
  return `
    <div class="modal">
      <div class="modal-title">COMMENTAIRE</div>
      <div class="modal-sub">${label} — jour ${day} ${MONTHS_FR[state.month - 1]} ${state.year}</div>
      <textarea id="note-textarea" rows="5" placeholder="Précisez le contexte, l'action corrective, le responsable…">${text}</textarea>
      <div class="modal-actions">
        <button class="btn-cancel" id="note-cancel">Annuler</button>
        <button class="btn-save" id="note-save">Enregistrer</button>
      </div>
    </div>`;
}

// ============================================================================
// Événements
// ============================================================================
function attachEvents() {
  document.getElementById('plant-select')?.addEventListener('change', (e) => {
    state.plantId = e.target.value;
    localStorage.setItem('sf_plant', state.plantId);
    resubscribe();
  });

  document.getElementById('prev-month')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month')?.addEventListener('click', () => changeMonth(1));
  document.getElementById('go-today')?.addEventListener('click', () => {
    state.year = today.getFullYear();
    state.month = today.getMonth() + 1;
    resubscribe();
  });
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  app.querySelectorAll('[data-cell-row]').forEach(btn => {
    btn.addEventListener('click', () => onCellClick(btn.dataset.cellRow, Number(btn.dataset.cellDay)));
    btn.addEventListener('dblclick', () => {
      const label = ROWS.find(r => r.key === btn.dataset.cellRow)?.label || '';
      openNote(btn.dataset.cellRow, Number(btn.dataset.cellDay), label);
    });
  });

  app.querySelectorAll('[data-note-row]').forEach(btn => {
    btn.addEventListener('click', () => openNote(btn.dataset.noteRow, Number(btn.dataset.noteDay), btn.dataset.noteLabel));
  });

  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeNote();
  });
  document.getElementById('note-cancel')?.addEventListener('click', closeNote);
  document.getElementById('note-save')?.addEventListener('click', saveNote);
  document.getElementById('confirm-cancel')?.addEventListener('click', closeNote);
  document.getElementById('confirm-ok')?.addEventListener('click', confirmPastChange);
}

// ---------------------------------------------------------------------------
// Clic principal sur une case : affiche le commentaire s'il existe, et
// change le statut — avec confirmation obligatoire pour les jours passés.
// ---------------------------------------------------------------------------
function onCellClick(rowKey, day) {
  const id = `${rowKey}-${day}`;
  const label = ROWS.find(r => r.key === rowKey)?.label || '';

  if (state.comments[id]) {
    showToast(`${label} — jour ${day}`, state.comments[id]);
  }

  if (isPastDay(state.year, state.month, day)) {
    state.modal = { type: 'confirm', rowKey, day, label };
    render();
    return;
  }

  toggleCell(rowKey, day);
}

function confirmPastChange() {
  const { rowKey, day } = state.modal;
  state.modal = null;
  toggleCell(rowKey, day);
}

let toastTimer = null;
function showToast(title, text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-text').textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

function changeMonth(delta) {
  let m = state.month + delta, y = state.year;
  if (m < 1) { m = 12; y -= 1; }
  if (m > 12) { m = 1; y += 1; }
  state.month = m; state.year = y;
  resubscribe();
}

function flashStatus(kind) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.textContent = kind === 'ok' ? 'Enregistré' : 'Erreur d\'enregistrement';
  el.className = 'save-status ' + kind;
  setTimeout(() => {
    if (el) { el.textContent = "Clic : statut · icône note : commentaire"; el.className = 'save-status'; }
  }, 900);
}

async function toggleCell(rowKey, day) {
  const id = `${rowKey}-${day}`;
  const updatedStates = { ...state.states, [id]: nextState(state.states[id]) };
  state.states = updatedStates;
  render();
  try {
    await saveData(state.plantId, state.year, state.month, { states: updatedStates, comments: state.comments });
    flashStatus('ok');
  } catch (e) {
    console.error(e);
    flashStatus('err');
  }
}

function openNote(rowKey, day, label) {
  state.modal = { type: 'note', rowKey, day, label };
  render();
  document.getElementById('note-textarea')?.focus();
}
function closeNote() { state.modal = null; render(); }

async function saveNote() {
  const ta = document.getElementById('note-textarea');
  const text = ta ? ta.value.trim() : '';
  const { rowKey, day } = state.modal;
  const id = `${rowKey}-${day}`;
  const updatedComments = { ...state.comments };
  if (text) updatedComments[id] = text; else delete updatedComments[id];
  state.comments = updatedComments;
  state.modal = null;
  render();
  try {
    await saveData(state.plantId, state.year, state.month, { states: state.states, comments: updatedComments });
  } catch (e) {
    console.error(e);
  }
}

// ============================================================================
// Abonnement aux données (plant/mois courant)
// ============================================================================
function resubscribe() {
  if (state.unsubscribe) state.unsubscribe();
  state.loading = true;
  render();
  state.unsubscribe = subscribe(state.plantId, state.year, state.month, ({ states, comments }) => {
    state.states = states;
    state.comments = comments;
    state.loading = false;
    render();
  });
}

// ============================================================================
// Authentification (mot de passe unique partagé)
// ============================================================================
function renderChecking() {
  app.innerHTML = `
    <div style="min-height:70vh;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;">
      Vérification de la connexion…
    </div>`;
}

function renderLogin(errorMsg) {
  app.innerHTML = `
    <div style="min-height:80vh;display:flex;align-items:center;justify-content:center;">
      <div style="max-width:360px;width:100%;background:#202325;padding:30px 28px;border-radius:14px;border:1px solid #2E3235;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04);">
        <div class="eyebrow">SAFETY FIRST</div>
        <h1 style="font-size:26px;margin:6px 0 6px;font-family:'Oswald',sans-serif;">Connexion</h1>
        <p class="subtitle" style="margin:0 0 18px;">Entrez le mot de passe partagé de l'équipe de direction.</p>
        <input id="login-password" type="password" autocomplete="current-password" placeholder="Mot de passe"
          style="width:100%;padding:11px 12px;border-radius:8px;border:1px solid #33373A;background:#181A1C;color:#EDEAE0;font-size:14px;margin-bottom:12px;font-family:'Inter',sans-serif;box-sizing:border-box;" />
        ${errorMsg ? `<div style="color:#C0392B;font-size:13px;margin-bottom:12px;">${errorMsg}</div>` : ''}
        <button id="login-submit" class="btn-save" style="width:100%;padding:11px;font-size:14px;">Se connecter</button>
      </div>
    </div>`;
  const pwField = document.getElementById('login-password');
  pwField?.focus();
  pwField?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('login-submit')?.addEventListener('click', doLogin);
}

async function doLogin() {
  const pwField = document.getElementById('login-password');
  const password = pwField ? pwField.value : '';
  if (!password) return;
  const btn = document.getElementById('login-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Connexion…'; }
  try {
    await authApi.signInWithEmailAndPassword(firebaseAuth, SHARED_LOGIN_EMAIL, password);
    // La suite est gérée par onAuthStateChanged
  } catch (e) {
    console.error(e);
    renderLogin('Mot de passe incorrect.');
  }
}

function logout() {
  if (authApi && firebaseAuth) authApi.signOut(firebaseAuth);
}

// ============================================================================
// Démarrage
// ============================================================================
(async function start() {
  await initFirebaseIfNeeded();

  if (!USING_CLOUD) {
    resubscribe();
  } else {
    renderChecking();
    authApi.onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        resubscribe();
      } else {
        if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }
        renderLogin();
      }
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW non enregistré :', err));
  }
})();
