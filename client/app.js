// ===== Config API =====
function getApiBase() {
  const url = localStorage.getItem('apiBase') || 'https://restaurante-parcial2.onrender.com';
  return url.replace(/\/+$/, ''); // sin slash final
}
function setApiBase(url) {
  if (url && typeof url === 'string') {
    localStorage.setItem('apiBase', url.replace(/\/+$/, ''));
  }
}
const API_BASE = getApiBase();

// ===== Estado simple =====
let me = JSON.parse(localStorage.getItem('me') || 'null');

// ===== Tabs / Vistas =====
const tabRegister = document.getElementById('tabRegister');
const tabLogin = document.getElementById('tabLogin');
const tabPedidos = document.getElementById('tabPedidos');

const registerView = document.getElementById('registerView');
const loginView = document.getElementById('loginView');
const pedidosView = document.getElementById('pedidosView');

function show(view) {
  [registerView, loginView, pedidosView].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

function syncNav() {
  if (me) tabPedidos.classList.remove('hidden');
  else tabPedidos.classList.add('hidden');
}

tabRegister.onclick = () => show(registerView);
tabLogin.onclick = () => show(loginView);
tabPedidos.onclick = () => show(pedidosView);

// ===== Helpers =====
async function fetchJSON(url, options = {}) {
  try {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); } catch { /* puede no ser JSON */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && /fetch/i.test(err.message)) {
      throw new Error('No se pudo conectar con la API (verifica API_BASE y CORS)');
    }
    throw err;
  }
}

function setBusy(btn, busy) {
  if (!btn) return;
  btn.disabled = !!busy;
}

// ===== Registro =====
const rForm = document.getElementById('registerForm');
const rMsg = document.getElementById('rMsg');

rForm.onsubmit = async (e) => {
  e.preventDefault();
  const submitBtn = rForm.querySelector('button');
  const payload = {
    nombre: document.getElementById('rNombre').value.trim(),
    email: document.getElementById('rEmail').value.trim(),
    telefono: document.getElementById('rTelefono').value.trim(),
  };

  if (!payload.nombre || !payload.email || !payload.telefono) {
    rMsg.textContent = 'Completa todos los campos';
    return;
  }

  rMsg.textContent = 'Enviando...';
  setBusy(submitBtn, true);
  try {
    await fetchJSON(`${API_BASE}/clientes/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    rMsg.textContent = 'Cuenta creada ✔ Ahora inicia sesión.';
    rForm.reset();
  } catch (err) {
    rMsg.textContent = err.message;
  } finally {
    setBusy(submitBtn, false);
  }
};

// ===== Login =====
const lForm = document.getElementById('loginForm');
const lMsg = document.getElementById('lMsg');

lForm.onsubmit = async (e) => {
  e.preventDefault();
  const submitBtn = lForm.querySelector('button');
  const payload = {
    email: document.getElementById('lEmail').value.trim(),
    telefono: document.getElementById('lTelefono').value.trim(),
  };

  if (!payload.email || !payload.telefono) {
    lMsg.textContent = 'Ingresa email y teléfono';
    return;
  }

  lMsg.textContent = 'Autenticando...';
  setBusy(submitBtn, true);
  try {
    const data = await fetchJSON(`${API_BASE}/clientes/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    me = data;
    localStorage.setItem('me', JSON.stringify(me));
    document.getElementById('userInfo').textContent = `${me.nombre} (${me.email})`;
    syncNav();
    show(pedidosView);
    loadOrders();
  } catch (err) {
    lMsg.textContent = err.message;
  } finally {
    setBusy(submitBtn, false);
  }
};

// ===== Logout =====
document.getElementById('logoutBtn').onclick = () => {
  me = null;
  localStorage.removeItem('me');
  syncNav();
  show(loginView);
};

// ===== Crear pedido =====
const pForm = document.getElementById('pedidoForm');
const pMsg = document.getElementById('pMsg');
const ordersDiv = document.getElementById('orders');

pForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!me) return alert('Inicia sesión');

  const submitBtn = pForm.querySelector('button');
  const payload = {
    cliente_id: me.id,
    platillo_nombre: document.getElementById('pPlatillo').value.trim(),
    notas: document.getElementById('pNotas').value.trim()
  };

  if (!payload.platillo_nombre) {
    pMsg.textContent = 'Escribe el nombre del platillo';
    return;
  }

  setBusy(submitBtn, true);
  pMsg.textContent = 'Creando pedido...';
  try {
    await fetchJSON(`${API_BASE}/ordenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    pMsg.textContent = 'Pedido creado ';
    pForm.reset();
    loadOrders();
  } catch (err) {
    pMsg.textContent = err.message;
  } finally {
    setBusy(submitBtn, false);
  }
};

// ===== Listar pedidos =====
async function loadOrders() {
  if (!me) return;
  ordersDiv.textContent = 'Cargando...';
  try {
    const data = await fetchJSON(`${API_BASE}/ordenes/${me.id}`);
    renderOrders(data);
  } catch (err) {
    ordersDiv.textContent = err.message;
  }
}

function renderOrders(list) {
  ordersDiv.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
    ordersDiv.textContent = 'Sin pedidos aún.';
    return;
  }

  list.forEach(o => {
    const el = document.createElement('div');
    el.className = 'order';
    el.innerHTML = `
      <div>
        <strong>${escapeHtml(o.platillo_nombre)}</strong>
        <small> · ${formatDate(o.creado)}</small><br/>
        <small>${escapeHtml(o.notas || '')}</small>
      </div>
      <div>
        <span class="state" data-st="${escapeHtml(o.estado)}">${escapeHtml(o.estado)}</span>
        <div class="actions">
          ${stateButtons(o).join('')}
        </div>
      </div>`;
    ordersDiv.appendChild(el);

    // Handlers de estado
    ['pending','preparing','delivered'].forEach(st => {
      const btn = el.querySelector(`button[data-id="${o.id}"][data-st="${st}"]`);
      if (btn) btn.onclick = () => updateState(o.id, st, btn);
    });
  });
}

function stateButtons(o) {
  const states = ['pending','preparing','delivered'];
  return states.map(st => `<button data-id="${o.id}" data-st="${st}">${st}</button>`);
}

async function updateState(id, estado, btn) {
  setBusy(btn, true);
  try {
    await fetchJSON(`${API_BASE}/ordenes/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
    loadOrders();
  } catch (err) {
    alert(err.message);
  } finally {
    setBusy(btn, false);
  }
}

// ===== Utils =====
function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString();
}
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ===== Init =====
syncNav();
if (me) {
  document.getElementById('userInfo').textContent = `${me.nombre} (${me.email})`;
  show(pedidosView);
  loadOrders();
} else {
  show(registerView);
}
