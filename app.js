// FORÇAR DESREGISTRO DE SERVICE WORKER ANTIGO NO NAVEGADOR
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}
if ('caches' in window) {
  caches.keys().then(names => {
    for (let name of names) caches.delete(name);
  });
}

// CONFIGURAÇÃO DO SEU PROJETO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCaz1JCXX1RLOZviyG3Ggf47B0blheSa68",
  authDomain: "reserva-escolamariaolimpia.firebaseapp.com",
  projectId: "reserva-escolamariaolimpia",
  storageBucket: "reserva-escolamariaolimpia",
  messagingSenderId: "reserva-escolamariaolimpia",
  appId: "1:122324755743:web:9060239e2572733dd4fc2a"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

// CHAVES DE SESSÃO ESTÁVEIS
const SESSION_KEY = "controle_sessao_proati_v11";
const USER_CACHE_KEY = "controle_user_data_v11";

// AVARIAS INICIAIS MAPEADAS
const AVARIAS_INICIAIS = [
  "SA3", "SA4", "SA10", "SA12", "SA29", "SA33", "SA34",
  "PV1", "PV3", "PV5", "PV9",
  "PN9"
];

// MODELOS OFICIAIS (TOTAL 158 MÁQUINAS)
const MODELOS_EQUIPAMENTO = [
  { id: "M", label: "M (Multilaser - M1 a M76)" },
  { id: "SA", label: "SA (Samsung - SA1 a SA45)" },
  { id: "PV", label: "PV (Positivo Velho - PV1 a PV15)" },
  { id: "PN", label: "PN (Positivo Novo - PN1 a PN11)" },
  { id: "TAB", label: "TAB (Tablet - TAB1 a TAB11)" }
];

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (user && !localStorage.getItem("pwa_tutorial_v1")) {
    modalPWAInstalacao();
  }
});

const TABELAS_HORARIOS = {
  "6_7": [
    { label: "1ª Aula", start: "07:00", end: "07:50" },
    { label: "2ª Aula", start: "07:50", end: "08:40" },
    { label: "3ª Aula", start: "08:40", end: "09:30" },
    { label: "4ª Aula", start: "09:50", end: "10:40" },
    { label: "5ª Aula", start: "10:40", end: "11:30" },
    { label: "6ª Aula", start: "11:30", end: "12:20" },
    { label: "7ª Aula", start: "13:10", end: "14:00" }
  ],
  "8_9": [
    { label: "1ª Aula", start: "07:00", end: "07:50" },
    { label: "2ª Aula", start: "07:50", end: "08:40" },
    { label: "3ª Aula", start: "09:00", end: "09:50" },
    { label: "4ª Aula", start: "09:50", end: "10:40" },
    { label: "5ª Aula", start: "10:40", end: "11:30" },
    { label: "6ª Aula", start: "12:20", end: "13:10" },
    { label: "7ª Aula", start: "13:10", end: "14:00" }
  ]
};

// LISTA DE FINALIDADES / MATÉRIAS ATUALIZADA
const FINALIDADES = [
  { id: "redacao", label: "✍️ Redação", priority: 1 },
  { id: "programacao", label: "💻 Programação", priority: 1 },
  { id: "speak", label: "🇬🇧 Speak (Inglês)", priority: 1 },
  { id: "matific", label: "📐 Matific (Matemática)", priority: 1 },
  { id: "sem_plataforma", label: "📚 Professor sem Plataforma", priority: 2 },
  { id: "outros", label: "📌 Outros", priority: 3 }
];

const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

let db = { users: [], machines: [], reservas: [], bloqueios: [], emprestimos: [], transferencias: [], reports: [] };
let user = null;
let currentPage = "dashboard";
const transferenciasExibidas = new Set();

const hojeData = new Date();
let calYear = hojeData.getFullYear();
let calMonth = hojeData.getMonth();

const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pill = s => `<span class="pill ${s}">${({ available: "Disponível", reserved: "Reservado", use: "Em uso", maintenance: "Avaria" }[s] || s)}</span>`;

function timeToMin(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function horariosConflitam(startA, endA, startB, endB) {
  return Math.max(timeToMin(startA), timeToMin(startB)) < Math.min(timeToMin(endA), timeToMin(endB));
}

document.addEventListener("input", e => {
  if (e.target && ["loginPass", "up", "eup", "paSenha"].includes(e.target.id)) {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  }
});

function nowFormatted() {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
}

function escutarColecao(colecao, chaveDb) {
  firestore.collection(colecao).onSnapshot(snapshot => {
    db[chaveDb] = snapshot.docs.map(doc => ({ idDoc: doc.id, ...doc.data() }));
    if (user) {
      verificarTransferenciasPendentes();
      if (typeof window[currentPage] === 'function') {
        window[currentPage]();
      }
    }
  });
}

function inicializarBancoEmNuvem() {
  escutarColecao("users", "users");
  escutarColecao("machines", "machines");
  escutarColecao("reservas", "reservas");
  escutarColecao("bloqueios", "bloqueios");
  escutarColecao("emprestimos", "emprestimos");
  escutarColecao("transferencias", "transferencias");
  escutarColecao("reports", "reports");

  firestore.collection("users").get().then(snap => {
    if (snap.empty) {
      firestore.collection("users").add({ id: "adm", name: "Administrador", userLogin: "adm", pass: "1703", role: "admin" });
      firestore.collection("users").add({ id: "demo", name: "Professor Exemplo", userLogin: "prof", pass: "0001", role: "professor" });
    }
  });

  firestore.collection("machines").get().then(snap => {
    const totalAtual = snap.docs.length;
    if (snap.empty || totalAtual !== 158) {
      const exclusoes = snap.docs.map(doc => doc.ref.delete());
      Promise.all(exclusoes).then(() => {
        for (let i = 1; i <= 76; i++) {
          const id = `M${i}`;
          firestore.collection("machines").add({ id, model: "M", type: "notebook", status: AVARIAS_INICIAIS.includes(id) ? "maintenance" : "available", serialNumber: "" });
        }
        for (let i = 1; i <= 45; i++) {
          const id = `SA${i}`;
          firestore.collection("machines").add({ id, model: "SA", type: "notebook", status: AVARIAS_INICIAIS.includes(id) ? "maintenance" : "available", serialNumber: "" });
        }
        for (let i = 1; i <= 15; i++) {
          const id = `PV${i}`;
          firestore.collection("machines").add({ id, model: "PV", type: "notebook", status: AVARIAS_INICIAIS.includes(id) ? "maintenance" : "available", serialNumber: "" });
        }
        for (let i = 1; i <= 11; i++) {
          const id = `PN${i}`;
          firestore.collection("machines").add({ id, model: "PN", type: "notebook", status: AVARIAS_INICIAIS.includes(id) ? "maintenance" : "available", serialNumber: "" });
        }
        for (let i = 1; i <= 11; i++) {
          const id = `TAB${i}`;
          firestore.collection("machines").add({ id, model: "TAB", type: "tablet", status: "available", serialNumber: "" });
        }
      });
    }
  });
}

inicializarBancoEmNuvem();

const isPastDate = d => d < new Date().toISOString().split("T")[0];
const isWeekend = d => [0, 6].includes(new Date(d + "T00:00:00").getDay());
const isHoliday = d => FERIADOS_FIXOS.includes(d.slice(5));

const availInLessons = (d, selectedIndices, t, targetSegment = "6_7", ignoreBatchId = null) => {
  const tabelaTarget = TABELAS_HORARIOS[targetSegment] || TABELAS_HORARIOS["6_7"];
  const selectedIntervals = selectedIndices.map(idx => tabelaTarget[idx]);

  return db.machines.filter(m => {
    if (m.type !== t || m.status === "maintenance") return false;

    const blocked = db.bloqueios.some(b => {
      if (b.date !== d) return false;
      if (b.equipment !== "all" && b.equipment !== m.id) return false;
      
      if (b.lesson === "all") return true;
      return selectedIndices.includes(parseInt(b.lesson, 10));
    });

    if (blocked) return false;

    const temConflito = db.reservas.some(r => {
      if (r.date !== d || r.equipment !== m.id || r.status === "confirmed") return false;
      if ((r.batchId || r.id) === ignoreBatchId) return false;

      const tabelaReserva = TABELAS_HORARIOS[r.segment || "6_7"] || TABELAS_HORARIOS["6_7"];
      const slotReserva = tabelaReserva[r.lesson];
      if (!slotReserva) return false;

      return selectedIntervals.some(sel => horariosConflitam(sel.start, sel.end, slotReserva.start, slotReserva.end));
    });

    return !temConflito;
  });
};

function verificarSessaoSalva() {
  const savedDocId = localStorage.getItem(SESSION_KEY) || localStorage.getItem("controle_sessao_v10") || localStorage.getItem("controle_sessao_v9");
  const cachedUserData = localStorage.getItem(USER_CACHE_KEY);

  if (cachedUserData) {
    try {
      const u = JSON.parse(cachedUserData);
      if (u && u.name) {
        iniciarSessao(u);
      }
    } catch (e) {}
  }

  if (savedDocId) {
    firestore.collection("users").doc(savedDocId).get().then(doc => {
      if (doc.exists) {
        iniciarSessao({ idDoc: doc.id, ...doc.data() });
      }
    }).catch(() => {});
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", verificarSessaoSalva);
} else {
  verificarSessaoSalva();
}

function iniciarSessao(u) {
  user = u;
  if (u.idDoc) {
    localStorage.setItem(SESSION_KEY, u.idDoc);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
  }
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("who").textContent = u.name + " · " + (u.role === "admin" ? "Admin" : "Prof.");
  
  verificarTransferenciasPendentes();
  nav("dashboard");
}

function modalPWAInstalacao() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  const m = modal(`
    <div class="modal-top">
      <h2>📲 Adicionar Atalho do Sistema</h2>
    </div>

    <div class="notice danger-notice" style="margin-bottom:12px; font-size:13px; border-left:4px solid #ef4444; background:#fef2f2; padding:10px; border-radius:6px; color:#991b1b;">
      ⚠️ <b>ATENÇÃO:</b> Utilize preferencialmente o navegador <b>GOOGLE CHROME</b>.<br>
      ❌ Caso não esteja usando o Google Chrome, <b>consulte o PROATI!</b>
    </div>
    
    ${deferredPrompt ? `
      <div style="text-align:center; padding:10px 0;">
        <button id="btnInstalarAuto" class="btn-primary" style="background:#10b981; font-size:15px; padding:12px; width:100%;">
          ⚡ Criar Atalho na Tela Inicial
        </button>
      </div>
    ` : isIOS ? `
      <div style="font-size:13px; color:#334155;">
        <p><b>No Safari:</b> Toque em <b>Compartilhar ⎘</b> > <b>Adicionar à Tela de Início</b>.</p>
        <button class="btn-primary" style="margin-top:12px; width:100%;" onclick="concluirTutorialPWA()">
          ✅ Continuar
        </button>
      </div>
    ` : `
      <div style="font-size:13px; color:#334155;">
        <p><b>No Chrome:</b> Clique nos <b>3 pontinhos (⋮)</b> > <b>Instalar página como app...</b></p>
        <button class="btn-primary" style="margin-top:12px; width:100%;" onclick="concluirTutorialPWA()">
          ✅ Entendi
        </button>
      </div>
    `}
  `);

  const btnAuto = document.getElementById("btnInstalarAuto");
  if (btnAuto) {
    btnAuto.onclick = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') concluirTutorialPWA();
        deferredPrompt = null;
      }
    };
  }
}

function concluirTutorialPWA() {
  localStorage.setItem("pwa_tutorial_v1", "true");
  document.querySelectorAll(".modal").forEach(m => m.remove());
}

function modalPrimeiroAcesso() {
  const m = modal(`
    <div class="modal-top">
      <h2>🆕 Primeiro Acesso - Cadastro de Professor</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fPrimeiroAcesso">
      <div class="notice" style="margin-bottom:12px; font-size:13px;">
        Preencha os dados abaixo para criar sua conta de <b>Professor</b> no sistema.
      </div>
      <div class="form-grid">
        <label>Nome Completo
          <input id="paNome" placeholder="Ex: Maria Souza" required style="width:100%;">
        </label>
        <label>Usuário de Login
          <input id="paLogin" placeholder="Ex: prof.maria" required style="width:100%;">
        </label>
        <label>Senha (Exatamente 4 números)
          <input id="paSenha" type="password" maxlength="4" pattern="\\d{4}" placeholder="Ex: 1234" required style="width:100%;">
        </label>
      </div>
      <button type="submit" class="btn-primary" style="margin-top:18px; width:100%">
        ✅ Criar Minha Conta
      </button>
    </form>
  `);

  m.querySelector("#paSenha").addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });

  m.querySelector(".close").onclick = () => m.remove();

  m.querySelector("#fPrimeiroAcesso").onsubmit = async e => {
    e.preventDefault();

    const nome = $("paNome").value.trim();
    const userLogin = $("paLogin").value.trim().toLowerCase();
    const pass = $("paSenha").value.trim();

    if (pass.length !== 4 || isNaN(pass)) {
      return alert("A senha deve conter exatamente 4 números.");
    }

    const usuarioExistente = db.users.find(u => 
      (u.userLogin && u.userLogin.toLowerCase() === userLogin) || 
      u.name.toLowerCase() === nome.toLowerCase()
    );

    if (usuarioExistente) {
      return alert("Este usuário ou nome já está cadastrado no sistema.");
    }

    try {
      await firestore.collection("users").add({
        id: uid(),
        name: nome,
        userLogin: userLogin,
        pass: pass,
        role: "professor",
        createdAt: nowFormatted()
      });

      alert("Conta criada com sucesso! Você já pode fazer o login.");
      
      if ($("loginUser")) $("loginUser").value = userLogin;
      if ($("loginPass")) $("loginPass").focus();

      m.remove();
    } catch (err) {
      alert("Erro ao criar cadastro: " + err.message);
    }
  };
}
window.modalPrimeiroAcesso = modalPrimeiroAcesso;

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const entered = $("loginUser").value.trim().toLowerCase();
  const pass = $("loginPass").value.trim();
  
  if (pass.length !== 4 || isNaN(pass)) {
    return $("loginError").textContent = "A senha deve ter exatamente 4 dígitos numéricos.";
  }

  let u = db.users.find(x => 
    (x.userLogin && x.userLogin.toLowerCase() === entered) || 
    x.name.toLowerCase() === entered || 
    (x.email && x.email.toLowerCase() === entered)
  );
  
  if (!u) {
    try {
      const snap = await firestore.collection("users").get();
      const allUsers = snap.docs.map(doc => ({ idDoc: doc.id, ...doc.data() }));
      u = allUsers.find(x => 
        (x.userLogin && x.userLogin.toLowerCase() === entered) || 
        x.name.toLowerCase() === entered || 
        (x.email && x.email.toLowerCase() === entered)
      );
    } catch (err) {}
  }
  
  if (!u || u.pass !== pass) return $("loginError").textContent = "Usuário ou senha incorretos.";
  iniciarSessao(u);
});

$("logout").onclick = () => {
  user = null;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_CACHE_KEY);
  $("app").classList.add("hidden");
  $("login").classList.remove("hidden");
  $("loginForm").reset();
  $("loginError").textContent = "";
};

const menus = [
  ["dashboard", "📊 Dashboard"],
  ["calendario", "🗓️ Calendário"],
  ["reservas", "📅 Reservas"],
  ["solicitacoes", "🔔 Solicitações"],
  ["avarias", "🛠️ Central Avarias"],
  ["bloqueios", "🚫 Bloqueios"],
  ["usuarios", "👥 Usuários"]
];

function nav(page) {
  currentPage = page;
  
  const pendentesCount = db.emprestimos.filter(x => x.status === "aguardando").length;
  const notifyBadge = pendentesCount > 0 ? `<span class="badge-notify">${pendentesCount}</span>` : '';

  $("nav").innerHTML = menus.filter(x => user.role === "admin" || !["bloqueios", "usuarios"].includes(x[0]))
    .map(x => {
      const isSol = x[0] === "solicitacoes";
      const icon = x[1].split(' ')[0];
      const title = x[1].substring(icon.length).trim();

      return `<button class="${x[0] === page ? "active" : ""}" data-p="${x[0]}">
        <span class="nav-icon">${icon}</span>
        <span class="nav-label">${title}</span>
        ${isSol ? notifyBadge : ''}
      </button>`;
    }).join("");

  document.querySelectorAll("#nav button").forEach(b => b.onclick = () => nav(b.dataset.p));
  if (typeof window[page] === 'function') {
    window[page]();
  }
}

function modalAgendamentoRapido() {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hoje = `${ano}-${mes}-${dia}`;
  modalReserva(hoje);
}
window.modalAgendamentoRapido = modalAgendamentoRapido;

function dashboard() {
  const hoje = new Date().toISOString().split("T")[0];
  const totalNotebooks = db.machines.filter(m => m.type === "notebook").length;
  const totalTablets = db.machines.filter(m => m.type === "tablet").length;
  
  const resHoje = db.reservas.filter(r => r.date === hoje && r.status === "confirmed");
  const noteResHojeUnique = new Set(resHoje.filter(r => r.type === "notebook").map(r => r.equipment)).size;
  const tabResHojeUnique = new Set(resHoje.filter(r => r.type === "tablet").map(r => r.equipment)).size;

  const notePct = Math.round((noteResHojeUnique / totalNotebooks) * 100) || 0;
  const tabPct = Math.round((tabResHojeUnique / totalTablets) * 100) || 0;

  const userRes = db.reservas.filter(r => r.userId === user.id && r.status === "confirmed");
  const userBatchesCount = new Set(userRes.map(r => r.batchId || r.id)).size;
  const empAtivos = new Set(db.emprestimos.filter(x => x.status === "retirado").map(x => x.equipment)).size;

  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Painel Principal</h2>
        <div class="muted">Escola Maria Olímpia de Souza Queiroz Maciel</div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="ok" onclick="modalAgendamentoRapido()">⚡ Agendamento Rápido</button>
        <button class="btn-primary" onclick="modalReserva()">+ Nova Reserva</button>
        <button class="secondary" onclick="modalReportDefeito()">🛠️ Reportar Defeito</button>
        ${user.role === "admin" ? `<button class="danger" onclick="encerrarEmprestimosApos1310()">⏰ Encerrar Empréstimos (13:10)</button>` : ''}
      </div>
    </div>

    <div class="grid">
      <div class="card stat">
        <span>💻 Notebooks Agendados Hoje</span>
        <b>${noteResHojeUnique} / ${totalNotebooks}</b>
        <div class="progress-bar"><div class="fill" style="width:${notePct}%"></div></div>
      </div>
      <div class="card stat">
        <span>📱 Tablets Agendados Hoje</span>
        <b>${tabResHojeUnique} / ${totalTablets}</b>
        <div class="progress-bar"><div class="fill alt" style="width:${tabPct}%"></div></div>
      </div>
      <div class="card stat">
        <span>📅 Seus Lotes de Reserva</span>
        <b>${userBatchesCount}</b>
      </div>
      <div class="card stat">
        <span>📦 Empréstimos Ativos</span>
        <b>${empAtivos} máq.</b>
      </div>
    </div>

    <div class="card section" style="margin-top:16px;">
      <h3>🔴 Retiradas do Dia (${hoje.split('-').reverse().join('/')}) — Transparência Pública</h3>
      ${usoTabela()}
    </div>`;
}

function avarias() {
  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>🛠️ Central de Avarias e Busca de Equipamentos</h2>
        <div class="muted">Pesquise qualquer máquina pelo ID/Nº de Série e consulte todo o histórico de reports.</div>
      </div>
      <button class="btn-primary" onclick="modalReportDefeito()">+ Reportar Novo Defeito</button>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <input id="searchMachine" placeholder="🔍 Digite o ID da máquina (ex: SA3, PV1, PN9, M16)..." style="flex:1;">
        <select id="filterStatus">
          <option value="todos">Todos os Status</option>
          <option value="pendente">Pendentes</option>
          <option value="resolvido">Resolvidos / Mantidos</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div id="avariasTableContainer">
        ${renderizarTabelaAvarias()}
      </div>
    </div>
  `;

  $("searchMachine").addEventListener("input", atualizarFiltroAvarias);
  $("filterStatus").addEventListener("change", atualizarFiltroAvarias);
}

function atualizarFiltroAvarias() {
  const query = $("searchMachine").value.trim().toLowerCase();
  const status = $("filterStatus").value;
  $("avariasTableContainer").innerHTML = renderizarTabelaAvarias(query, status);
}

function renderizarTabelaAvarias(query = "", filterStatus = "todos") {
  let lista = db.reports;

  if (filterStatus !== "todos") {
    lista = lista.filter(r => r.status === filterStatus);
  }

  if (query) {
    lista = lista.filter(r => 
      (r.number && r.number.toLowerCase().includes(query)) ||
      (r.model && r.model.toLowerCase().includes(query)) ||
      (r.description && r.description.toLowerCase().includes(query)) ||
      (r.reporterName && r.reporterName.toLowerCase().includes(query))
    );
  }

  return `
    <div class="table-container">
      <div class="table">
        <table>
          <tr>
            <th>Modelo / Máquina</th>
            <th>Pedido Vinculado</th>
            <th>Defeito Relatado</th>
            <th>Mídia</th>
            <th>Professor Reportante</th>
            <th>Data</th>
            <th>Parecer / Comentário Admin</th>
            <th>Status</th>
            ${user.role === "admin" ? `<th>Ações Admin</th>` : ''}
          </tr>
          ${lista.map(r => `
            <tr>
              <td><b>[${r.model}] Nº ${esc(r.number)}</b></td>
              <td>${r.batchId ? `<small class="pill reserved">${esc(r.batchId)}</small>` : `<span class="muted">Avulso</span>`}</td>
              <td>${esc(r.description)}</td>
              <td>${r.mediaUrl ? `<a href="${r.mediaUrl}" target="_blank" style="color:#4f46e5; font-weight:bold;">🖼️ Mídia</a>` : `<span class="muted">Sem mídia</span>`}</td>
              <td><b>👤 ${esc(r.reporterName)}</b></td>
              <td><small class="muted">${r.createdAt}</small></td>
              <td>
                ${r.adminComment ? `
                  <div style="background:#f1f5f9; border-left:3px solid #4f46e5; padding:6px 10px; border-radius:4px; font-size:12px;">
                    <b>💬 Admin:</b> ${esc(r.adminComment)}
                  </div>
                ` : `<span class="muted">Sem comentários</span>`}
              </td>
              <td>${r.status === "pendente" ? `<span class="pill maintenance">Avaria</span>` : `<span class="pill available">Resolvido</span>`}</td>
              ${user.role === "admin" ? `
                <td>
                  <button class="ok" onclick="modalResponderReport('${r.idDoc}')">💬 Responder</button>
                </td>
              ` : ''}
            </tr>
          `).join("") || "<tr><td colspan=9>Nenhum relato encontrado com esses filtros.</td></tr>"}
        </table>
      </div>
    </div>
  `;
}

function modalResponderReport(idDoc) {
  if (user.role !== "admin") return;

  const r = db.reports.find(x => x.idDoc === idDoc);
  if (!r) return;

  const m = modal(`
    <div class="modal-top">
      <h2>💬 Responder Chamado de Avaria</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fReplyReport">
      <div class="notice" style="margin-bottom:12px; font-size:13px;">
        Máquina: <b>[${esc(r.model)}] Nº ${esc(r.number)}</b><br>
        Relato do Prof. ${esc(r.reporterName)}: <i>"${esc(r.description)}"</i>
      </div>

      <label style="display:block; font-weight:600; font-size:12px; margin-bottom:4px;">Resposta / Parecer Técnico:</label>
      <textarea id="adminCommentText" rows="3" style="width:100%;" required>${esc(r.adminComment || '')}</textarea>

      <label style="margin-top:12px; display:block; font-weight:600; font-size:12px;">Status do Chamado:
        <select id="reportStatusSelect" style="width:100%; margin-top:4px;">
          <option value="pendente" ${r.status === "pendente" ? "selected" : ""}>⏳ Em Análise / Pendente</option>
          <option value="resolvido" ${r.status === "resolvido" ? "selected" : ""}>✅ Resolvido / Mantido</option>
        </select>
      </label>

      <button type="submit" class="btn-primary" style="margin-top:16px; width:100%">💾 Salvar e Atualizar</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fReplyReport").onsubmit = e => {
    e.preventDefault();
    const adminComment = $("adminCommentText").value.trim();
    const status = $("reportStatusSelect").value;

    firestore.collection("reports").doc(idDoc).update({
      adminComment,
      status,
      updatedAt: nowFormatted()
    });

    alert("Resposta salva com sucesso!");
    m.remove();
  };
}

function renderizarOpcoesHorario(segmentoKey) {
  const lista = TABELAS_HORARIOS[segmentoKey] || TABELAS_HORARIOS["6_7"];
  return lista.map((x, i) => `
    <label class="lesson-checkbox" style="display:flex; align-items:center; gap:8px; padding:10px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; cursor:pointer;">
      <input type="checkbox" name="lessonCheck" value="${i}">
      <span><b>${x.label}</b> <small style="color:#64748b;">${x.start}–${x.end}</small></span>
    </label>
  `).join("");
}

/* ÁREA DE SOLICITAÇÕES COM FILTRO DE PROFESSORES, DIAS, MAQUINAS E STATUS */
function solicitacoes() {
  const professoresUnicos = Array.from(new Set(db.emprestimos.map(e => e.userName))).sort();

  $("main").innerHTML = `
    <div class="head">
      <div><h2>Solicitações de Máquinas</h2><div class="muted">Pedidos e entregas rotativas</div></div>
      <button class="btn-primary" onclick="gerarPlanilhaMensalCSV()">📊 Relatório Mensal (.CSV)</button>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <input id="searchSolicitacao" placeholder="🔍 Buscar por professor, ID máquina ou Lote..." style="flex:2; min-width:180px;">
        
        <select id="filterProfSolicitacao" style="flex:1; min-width:150px;">
          <option value="todos">👤 Todos os Professores</option>
          ${professoresUnicos.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}
        </select>

        <input type="date" id="filterDateSolicitacao" style="flex:1; min-width:130px;" title="Filtrar por data de uso">

        <select id="filterStatusSolicitacao" style="flex:1; min-width:140px;">
          <option value="todos">Todos os Status</option>
          <option value="aguardando">🔔 Solicitado (Aguardando)</option>
          <option value="retirado">📦 Em Uso (Retirado)</option>
          <option value="devolvido">✅ Devolvido</option>
        </select>

        <button class="secondary" id="btnClearSolFilters" style="padding:8px 12px; font-size:12px;">🧹 Limpar</button>
      </div>
    </div>

    <div class="card">
      <div id="solicitacoesTableContainer">
        ${renderizarTabelaSolicitacoes()}
      </div>
    </div>`;

  $("searchSolicitacao").addEventListener("input", atualizarFiltroSolicitacoes);
  $("filterProfSolicitacao").addEventListener("change", atualizarFiltroSolicitacoes);
  $("filterDateSolicitacao").addEventListener("change", atualizarFiltroSolicitacoes);
  $("filterStatusSolicitacao").addEventListener("change", atualizarFiltroSolicitacoes);
  
  $("btnClearSolFilters").onclick = () => {
    $("searchSolicitacao").value = "";
    $("filterProfSolicitacao").value = "todos";
    $("filterDateSolicitacao").value = "";
    $("filterStatusSolicitacao").value = "todos";
    atualizarFiltroSolicitacoes();
  };
}

function atualizarFiltroSolicitacoes() {
  const query = $("searchSolicitacao").value.trim().toLowerCase();
  const prof = $("filterProfSolicitacao").value;
  const dateVal = $("filterDateSolicitacao").value;
  const status = $("filterStatusSolicitacao").value;
  $("solicitacoesTableContainer").innerHTML = renderizarTabelaSolicitacoes(query, status, prof, dateVal);
}

function renderizarTabelaSolicitacoes(query = "", filterStatus = "todos", filterProf = "todos", filterDate = "") {
  const raw = user.role === "admin" ? db.emprestimos : db.emprestimos.filter(x => x.userId === user.id);
  const groups = {};
  raw.forEach(x => {
    const bid = x.batchId || x.id;
    if (!groups[bid]) groups[bid] = { batchId: bid, userId: x.userId, userName: x.userName, date: x.date, lessons: new Set(), equipments: new Set(), statuses: new Set(), createdAt: x.createdAt || "Data não registrada" };
    groups[bid].lessons.add(x.lesson);
    groups[bid].equipments.add(x.equipment);
    groups[bid].statuses.add(x.status);
  });

  let groupArray = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));

  // Filtro de Professor
  if (filterProf !== "todos") {
    groupArray = groupArray.filter(g => g.userName === filterProf);
  }

  // Filtro de Data
  if (filterDate) {
    groupArray = groupArray.filter(g => g.date === filterDate);
  }

  // Filtro de Status
  if (filterStatus !== "todos") {
    groupArray = groupArray.filter(g => {
      const isRetirado = g.statuses.has("retirado");
      const isAguardando = g.statuses.has("aguardando");
      const isDevolvido = g.statuses.has("devolvido") && !isRetirado && !isAguardando;

      if (filterStatus === "aguardando") return isAguardando;
      if (filterStatus === "retirado") return isRetirado;
      if (filterStatus === "devolvido") return isDevolvido;
      return true;
    });
  }

  // Busca textual geral (Nome, ID da Máquina, Lote ou Data formatada)
  if (query) {
    groupArray = groupArray.filter(g => {
      const eqStr = Array.from(g.equipments).join(" ").toLowerCase();
      const dateFmt = g.date.split('-').reverse().join('/');
      return g.userName.toLowerCase().includes(query) ||
             g.batchId.toLowerCase().includes(query) ||
             eqStr.includes(query) ||
             g.date.includes(query) ||
             dateFmt.includes(query);
    });
  }

  return `
    <div class="table-container">
      <div class="table">
        <table>
          <tr><th>Professor Solicitante</th><th>Data de Uso</th><th>Horários</th><th>Qtd. Máquinas</th><th>IDs Vinculados</th><th>Data/Hora Pedido</th><th>Status</th><th>Ações</th></tr>
          ${groupArray.map(g => {
            const isRetirado = g.statuses.has("retirado");
            const isAguardando = g.statuses.has("aguardando");
            const isDevolvido = g.statuses.has("devolvido") && !isRetirado && !isAguardando;

            let statusPill = pill("available");
            if (isRetirado) statusPill = pill("use");
            else if (isDevolvido) statusPill = `<span class="pill available">Devolvido</span>`;
            else if (isAguardando) statusPill = `<span class="pill reserved">🔔 Solicitado</span>`;

            const listaIds = Array.from(g.equipments);
            const exibeIds = isRetirado || isDevolvido ? listaIds.join(", ") : "Pendente Entrega";
            const podeAtribuir = user.role === "admin" || user.id === g.userId;

            return `<tr>
              <td><b>👤 ${esc(g.userName)}</b></td>
              <td><b>${g.date.split('-').reverse().join('/')}</b></td>
              <td><span class="pill reserved">${Array.from(g.lessons).join(", ")}</span></td>
              <td><b>${g.equipments.size} máq.</b></td>
              <td><small><code>${exibeIds}</code></small></td>
              <td><small class="muted">🕒 ${g.createdAt}</small></td>
              <td>${statusPill}</td>
              <td>
                ${podeAtribuir && (isAguardando || isRetirado) ? `<button class="ok" onclick="modalAtribuirMaquinasPedido('${g.batchId}')">📌 Atribuir / Alterar Máquinas</button>` : ""}
                ${user.role === "admin" && isRetirado ? `<button class="secondary" onclick="devolverLoteRotativo('${g.batchId}')">↩️ Devolver Lote</button>` : ""}
                ${isRetirado && user.id === g.userId ? `<button class="secondary" onclick="modalTransferirLote('${g.batchId}')">🔄 Transferir</button>` : ""}
              </td>
            </tr>`;
          }).join("") || "<tr><td colspan=8>Nenhuma solicitação encontrada com esses filtros.</td></tr>"}
        </table>
      </div>
    </div>`;
}

function modalAtribuirMaquinasPedido(batchId) {
  const emprestimos = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);
  if (!emprestimos.length) return alert("Pedido não encontrado.");

  const isOwner = emprestimos.some(x => x.userId === user.id || x.userId === user.idDoc);
  if (user.role !== "admin" && !isOwner) {
    return alert("Você só pode atribuir ou alterar as máquinas do seu próprio pedido.");
  }

  const qtdNecessaria = new Set(emprestimos.map(x => x.equipment)).size;
  const professorNome = emprestimos[0].userName;

  let modeloAtual = "M";
  let maquinasSelecionadas = [];

  const m = modal(`
    <div class="modal-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <h2 style="margin:0; font-size:18px;">📌 Atribuir Máquinas no Pedido</h2>
      <button class="close">&times;</button>
    </div>

    <div style="background:#e0e7ff; border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
      <span style="font-size:13px; color:#3730a3;">Pedido de: <b>Prof. ${esc(professorNome)}</b></span>
      <span style="font-size:12px; font-weight:700; color:#4f46e5; background:#ffffff; padding:4px 10px; border-radius:12px;" id="lblCounter">
        0 / ${qtdNecessaria} selecionadas
      </span>
    </div>

    <div style="margin-bottom:14px;">
      <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">
        ⌨️ Adicionar Rápido por Número/ID:
      </label>
      <div style="display:flex; gap:6px;">
        <input type="text" id="inpQuickAddMachine" placeholder="Digite ex: 88, M88, PV9..." style="flex:1;">
        <button type="button" id="btnQuickAddSubmit" class="btn-primary">+ Add</button>
      </div>
    </div>

    <div style="margin-bottom:12px;">
      <label style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:block; margin-bottom:6px;">
        Filtrar Categoria:
      </label>
      <div style="display:flex; gap:6px; flex-wrap:wrap;" id="modelFilterButtons">
        <button type="button" class="btn-model-filter active" data-model="M">M (Multilaser)</button>
        <button type="button" class="btn-model-filter" data-model="SA">SA (Samsung)</button>
        <button type="button" class="btn-model-filter" data-model="PV">PV (Positivo V.)</button>
        <button type="button" class="btn-model-filter" data-model="PN">PN (Positivo N.)</button>
        <button type="button" class="btn-model-filter" data-model="TAB">TAB (Tablet)</button>
      </div>
    </div>

    <div style="margin-bottom:10px; display:flex; gap:8px; justify-content:space-between;">
      <button type="button" id="btnAutoSelectFirst" class="ok" style="font-size:11px; padding:6px 12px;">
        ⚡ Auto-selecionar ${qtdNecessaria} máq.
      </button>
      <button type="button" id="btnClearSelection" class="danger" style="font-size:11px; padding:6px 12px;">
        🧹 Limpar
      </button>
    </div>

    <div id="gridChipsContainer" class="assign-chips-grid"></div>

    <div style="margin-top:12px; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:12px;">
      <span style="color:#64748b; font-weight:600;">Máquinas selecionadas:</span>
      <div id="selectedSummary" style="margin-top:2px; font-weight:700; color:#4f46e5; word-break:break-all;">
        Nenhuma máquina selecionada
      </div>
    </div>

    <form id="fAssignOrder" style="margin-top:14px;">
      <button type="submit" class="btn-primary" style="width:100%; padding:12px; font-size:14px;">
        ✅ Confirmar e Salvar Máquinas
      </button>
    </form>
  `);

  const renderGrid = () => {
    const container = m.querySelector("#gridChipsContainer");
    const maquinasDoModelo = db.machines.filter(m => m.model === modeloAtual);

    container.innerHTML = maquinasDoModelo.map(maq => {
      const isSelected = maquinasSelecionadas.includes(maq.id);
      const isAvaria = AVARIAS_INICIAIS.includes(maq.id) || maq.status === "maintenance";

      return `
        <div class="chip-item ${isSelected ? 'selected' : ''} ${isAvaria ? 'has-avaria' : ''}" data-id="${maq.id}">
          ${maq.id} ${isAvaria ? '⚠️' : ''}
        </div>
      `;
    }).join("");

    container.querySelectorAll(".chip-item").forEach(chip => {
      chip.onclick = () => {
        const idMaq = chip.dataset.id;
        if (maquinasSelecionadas.includes(idMaq)) {
          maquinasSelecionadas = maquinasSelecionadas.filter(x => x !== idMaq);
        } else {
          if (maquinasSelecionadas.length >= qtdNecessaria) {
            return alert(`Você já selecionou a quantidade necessária de ${qtdNecessaria} máquina(s)!`);
          }
          maquinasSelecionadas.push(idMaq);
        }
        atualizarModalUI();
      };
    });
  };

  const atualizarModalUI = () => {
    m.querySelector("#lblCounter").textContent = `${maquinasSelecionadas.length} / ${qtdNecessaria} selecionadas`;
    
    const summary = m.querySelector("#selectedSummary");
    if (maquinasSelecionadas.length === 0) {
      summary.textContent = "Nenhuma máquina selecionada";
      summary.style.color = "#64748b";
    } else {
      summary.textContent = maquinasSelecionadas.join(", ");
      summary.style.color = "#4f46e5";
    }

    renderGrid();
  };

  const processarQuickAdd = () => {
    const inpQuick = m.querySelector("#inpQuickAddMachine");
    const rawVal = inpQuick.value.trim().toUpperCase();
    if (!rawVal) return;

    let targetMaq = db.machines.find(maq => maq.id.toUpperCase() === rawVal);
    if (!targetMaq) {
      targetMaq = db.machines.find(maq => maq.id.toUpperCase() === (modeloAtual + rawVal));
    }

    if (!targetMaq) {
      alert(`Máquina "${rawVal}" não foi encontrada!`);
      inpQuick.value = "";
      return;
    }

    const idMaq = targetMaq.id;
    if (maquinasSelecionadas.includes(idMaq)) {
      maquinasSelecionadas = maquinasSelecionadas.filter(x => x !== idMaq);
    } else {
      if (maquinasSelecionadas.length >= qtdNecessaria) {
        alert(`Você já selecionou a quantidade necessária de ${qtdNecessaria} máquina(s)!`);
        inpQuick.value = "";
        return;
      }
      maquinasSelecionadas.push(idMaq);
    }

    if (targetMaq.model !== modeloAtual) {
      modeloAtual = targetMaq.model;
      m.querySelectorAll(".btn-model-filter").forEach(b => {
        b.classList.toggle("active", b.dataset.model === modeloAtual);
      });
    }

    inpQuick.value = "";
    atualizarModalUI();
    inpQuick.focus();
  };

  const inpQuick = m.querySelector("#inpQuickAddMachine");
  if (inpQuick) {
    setTimeout(() => inpQuick.focus(), 150);
    inpQuick.onkeydown = e => {
      if (e.key === "Enter") {
        e.preventDefault();
        processarQuickAdd();
      }
    };
  }

  const btnQuickAdd = m.querySelector("#btnQuickAddSubmit");
  if (btnQuickAdd) {
    btnQuickAdd.onclick = (e) => {
      e.preventDefault();
      processarQuickAdd();
    };
  }

  m.querySelectorAll(".btn-model-filter").forEach(btn => {
    btn.onclick = () => {
      m.querySelectorAll(".btn-model-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      modeloAtual = btn.dataset.model;
      renderGrid();
    };
  });

  m.querySelector("#btnAutoSelectFirst").onclick = () => {
    const disponiveis = db.machines.filter(maq => 
      maq.model === modeloAtual && 
      !AVARIAS_INICIAIS.includes(maq.id) && 
      maq.status !== "maintenance"
    );

    maquinasSelecionadas = disponiveis.slice(0, qtdNecessaria).map(x => x.id);
    atualizarModalUI();
  };

  m.querySelector("#btnClearSelection").onclick = () => {
    maquinasSelecionadas = [];
    atualizarModalUI();
  };

  m.querySelector(".close").onclick = () => m.remove();

  m.querySelector("#fAssignOrder").onsubmit = async e => {
    e.preventDefault();

    if (maquinasSelecionadas.length !== qtdNecessaria) {
      return alert(`Por favor, selecione exatamente ${qtdNecessaria} máquina(s) antes de confirmar.`);
    }

    const itensBatch = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);
    itensBatch.forEach((item, idx) => {
      const idMaq = maquinasSelecionadas[idx % maquinasSelecionadas.length];
      firestore.collection("emprestimos").doc(item.idDoc).update({
        equipment: idMaq,
        status: "retirado"
      });
    });

    db.reservas.filter(x => (x.batchId || x.id) === batchId).forEach((item, idx) => {
      const idMaq = maquinasSelecionadas[idx % maquinasSelecionadas.length];
      firestore.collection("reservas").doc(item.idDoc).update({
        equipment: idMaq
      });
    });

    alert("Máquinas atribuídas com sucesso!");
    m.remove();
  };

  renderGrid();
}

function devolverLoteRotativo(batchId) {
  if (confirm("Confirmar a devolução deste lote de máquinas ao estoque?")) {
    db.emprestimos.filter(x => (x.batchId || x.id) === batchId).forEach(item => {
      firestore.collection("emprestimos").doc(item.idDoc).update({ status: "devolvido" });
    });
    alert("Lote devolvido com sucesso! As máquinas voltaram a ficar disponíveis no sistema.");
  }
}

function usoTabela() {
  const a = db.emprestimos.filter(x => x.status === "retirado");
  if (!a.length) return `<p class="muted">Nenhum equipamento em uso no momento.</p>`;

  const groups = {};
  a.forEach(x => {
    const bid = x.batchId || x.id;
    if (!groups[bid]) groups[bid] = { userName: x.userName, date: x.date, lessons: new Set(), equipments: new Set(), createdAt: x.createdAt || "Data não registrada" };
    groups[bid].lessons.add(x.lesson);
    groups[bid].equipments.add(x.equipment);
  });

  return `
    <div class="table-container">
      <div class="table">
        <table>
          <tr><th>Professor Responsável</th><th>Qtd. Máquinas</th><th>IDs Atribuídos</th><th>Data do Uso</th><th>Horários</th><th>Data/Hora do Pedido</th></tr>
          ${Object.values(groups).map(g => `<tr>
            <td><b>👤 ${esc(g.userName)}</b></td>
            <td><b>${g.equipments.size} máq.</b></td>
            <td><code>${Array.from(g.equipments).join(", ")}</code></td>
            <td>${g.date.split('-').reverse().join('/')}</td>
            <td><span class="pill use">${Array.from(g.lessons).join(", ")}</span></td>
            <td><small class="muted">🕒 ${g.createdAt}</small></td>
          </tr>`).join("")}
        </table>
      </div>
    </div>`;
}

function modalReportDefeito() {
  const emprestimosAtivos = db.emprestimos.filter(x => x.userId === user.id && x.status === "retirado");

  const m = modal(`
    <div class="modal-top">
      <h2>🛠️ Reportar Máquina com Defeito / Avaria</h2>
      <button class="close">&times;</button>
    </div>
    <form id="freport">
      ${emprestimosAtivos.length > 0 ? `
        <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Vincular ao Pedido Ativo:
          <select id="repBatch" style="width:100%;">
            <option value="">Nenhum / Chamado Avulso</option>
            ${Array.from(new Set(emprestimosAtivos.map(e => e.batchId || e.id))).map(b => {
              const item = emprestimosAtivos.find(e => (e.batchId || e.id) === b);
              return `<option value="${b}">Pedido ${b} (${item.date.split('-').reverse().join('/')})</option>`;
            }).join("")}
          </select>
        </label>
      ` : ''}
      <div class="form-grid" style="margin-top:10px;">
        <label>Modelo do Equipamento:
          <select id="repModel" style="width:100%;" required>
            ${MODELOS_EQUIPAMENTO.map(m => `<option value="${m.id}">${m.label}</option>`).join("")}
          </select>
        </label>
        <label>Número / Identificador:
          <input id="repNum" placeholder="Ex: SA3 ou 1" style="width:100%;" required>
        </label>
      </div>
      <label style="margin-top:12px; display:block; font-size:12px; font-weight:600;">Descrição do Defeito:
        <input id="repDesc" placeholder="Ex: Falta tecla 'Enter' / Tela quebrada" style="width:100%; margin-top:4px;" required>
      </label>
      <label style="margin-top:12px; display:block; font-size:12px; font-weight:600;">Anexar Mídia (Opcional):
        <input type="file" id="repMedia" accept="image/*,video/*" style="font-size:13px; margin-top:4px; display:block;">
      </label>
      <button class="btn-primary" style="margin-top:18px; width:100%">Enviar Report de Defeito</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#freport").onsubmit = async e => {
    e.preventDefault();
    const batchId = $("repBatch") ? $("repBatch").value : "";
    const model = $("repModel").value;
    const num = $("repNum").value.trim();
    const desc = $("repDesc").value.trim();
    const fileInput = $("repMedia");

    let mediaUrl = "";

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      if (file.size > 5 * 1024 * 1024) {
        return alert("O arquivo excede o limite de 5MB. Por favor, selecione uma mídia menor.");
      }
      mediaUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    }

    firestore.collection("reports").add({
      id: uid(),
      batchId: batchId || null,
      reporterId: user.id,
      reporterName: user.name,
      model,
      number: num,
      description: desc,
      mediaUrl,
      adminComment: "",
      status: "pendente",
      createdAt: nowFormatted()
    });

    alert("Defeito reportado com sucesso!");
    m.remove();
  };
}

function usuarios() {
  const isAdm = user.role === "admin";

  $("main").innerHTML = `
    <div class="head">
      <div><h2>Gestão de Usuários</h2><div class="muted">Gestão de professores e acessos.</div></div>
      ${isAdm ? `<button class="btn-primary" onclick="modalUser()">+ Novo Usuário</button>` : ''}
    </div>
    <div class="card">
      <div class="table-container">
        <div class="table">
          <table>
            <tr><th>Nome Completo</th><th>Usuário</th><th>Senha</th><th>Perfil</th>${isAdm ? `<th>Ações Admin</th>` : ''}</tr>
            ${db.users.map(u => `<tr>
              <td>${esc(u.name)}</td>
              <td><b>${esc(u.userLogin || u.name)}</b></td>
              <td><code>${esc(u.pass)}</code></td>
              <td>${u.role === "admin" ? "<b>👑 Administrador</b>" : "Professor"}</td>
              ${isAdm ? `
                <td>
                  <button class="secondary" onclick="modalEditarUsuario('${u.idDoc}')">✏️ Editar</button>
                  ${u.id === "adm" ? "" : `<button class="danger" onclick="delUser('${u.idDoc}')">Excluir</button>`}
                </td>
              ` : ''}
            </tr>`).join("")}
          </table>
        </div>
      </div>
    </div>`;
}

function modalUser() {
  const m = modal(`
    <div class="modal-top"><h2>Cadastrar Usuário</h2><button class="close">&times;</button></div>
    <form id="uf">
      <div class="form-grid">
        <label>Nome Completo<input id="un" required style="width:100%;"></label>
        <label>Usuário de Login<input id="ul" required style="width:100%;"></label>
        <label>Senha (Exatamente 4 números)
          <input id="up" type="password" maxlength="4" pattern="\\d{4}" placeholder="Ex: 1234" required style="width:100%;">
        </label>
        <label>Perfil / Função
          <select id="urole" style="width:100%;">
            <option value="professor">Professor</option>
            <option value="admin">👑 Administrador</option>
          </select>
        </label>
      </div>
      <button class="btn-primary" style="margin-top:18px; width:100%">Cadastrar Usuário</button>
    </form>`);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#uf").onsubmit = e => {
    e.preventDefault();
    let p = $("up").value.trim();
    if (p.length !== 4 || isNaN(p)) return alert("A senha deve conter exatamente 4 números.");
    
    const selectedRole = $("urole").value;

    firestore.collection("users").add({ 
      id: uid(), 
      name: $("un").value.trim(), 
      userLogin: $("ul").value.trim().toLowerCase(), 
      pass: p, 
      role: selectedRole 
    });
    
    m.remove();
  };
}

function modalEditarUsuario(idDoc) {
  const u = db.users.find(x => x.idDoc === idDoc);
  if (!u) return;

  const m = modal(`
    <div class="modal-top"><h2>Editar Usuário</h2><button class="close">&times;</button></div>
    <form id="euf">
      <div class="form-grid">
        <label>Nome Completo<input id="eun" value="${esc(u.name)}" required style="width:100%;"></label>
        <label>Usuário Login<input id="eul" value="${esc(u.userLogin || '')}" required style="width:100%;"></label>
        <label>Senha (Exatamente 4 números)
          <input id="eup" type="password" value="${esc(u.pass)}" maxlength="4" pattern="\\d{4}" required style="width:100%;">
        </label>
        <label>Perfil / Função
          <select id="eurole" style="width:100%;">
            <option value="professor" ${u.role === "professor" ? "selected" : ""}>Professor</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>👑 Administrador</option>
          </select>
        </label>
      </div>
      <button class="btn-primary" style="margin-top:18px; width:100%">Salvar Alterações</button>
    </form>`);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#euf").onsubmit = e => {
    e.preventDefault();
    let p = $("eup").value.trim();
    if (p.length !== 4 || isNaN(p)) return alert("A senha deve conter exatamente 4 números.");
    
    const newRole = $("eurole").value;

    firestore.collection("users").doc(idDoc).update({ 
      name: $("eun").value.trim(), 
      userLogin: $("eul").value.trim().toLowerCase(), 
      pass: p,
      role: newRole
    });

    alert("Usuário atualizado com sucesso!");
    m.remove();
  };
}

function delUser(idDoc) {
  if (confirm("Deseja excluir este usuário?")) firestore.collection("users").doc(idDoc).delete();
}

function modalTransferirLote(batchId) {
  const emprestimos = db.emprestimos.filter(x => (x.batchId || x.id) === batchId && x.status === "retirado");
  if (!emprestimos.length) return alert("Não há empréstimos ativos para transferir neste lote.");

  const professores = db.users.filter(u => u.idDoc !== user.idDoc && u.id !== user.id);
  if (!professores.length) return alert("Nenhum outro professor cadastrado no sistema.");

  const transferenciaExistente = db.transferencias.find(t => t.batchId === batchId && t.status === "pendente");

  const m = modal(`
    <div class="modal-top">
      <h2>🔄 Transferir Máquinas para outro Professor</h2>
      <button class="close">&times;</button>
    </div>
    <form id="ftransfer">
      <div class="notice" style="margin-bottom:12px; padding:10px; border-radius:6px; font-size:13px;">
        Selecione o professor que vai receber as <b>${new Set(emprestimos.map(e => e.equipment)).size} máquina(s)</b>. O destinatário precisará confirmar a troca no sistema.
      </div>
      ${transferenciaExistente ? `
        <div class="notice danger-notice" style="margin-bottom:12px; font-size:12px;">
          ⚠️ Existe uma solicitação pendente para <b>Prof. ${esc(transferenciaExistente.toUserName)}</b>. Selecionar outro professor irá atualizar o pedido.
        </div>
      ` : ''}
      <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Professor Destinatário:
        <select id="targetUser" style="width:100%; margin-top:4px;" required>
          <option value="">Selecione o professor...</option>
          ${professores.map(p => `<option value="${p.idDoc}" ${transferenciaExistente && transferenciaExistente.toUserDocId === p.idDoc ? 'selected' : ''}>${esc(p.name)}</option>`).join("")}
        </select>
      </label>
      <button class="btn-primary" style="margin-top:18px; width:100%">🚀 Solicitar Transferência</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#ftransfer").onsubmit = async e => {
    e.preventDefault();
    const targetDocId = $("targetUser").value;
    const targetUser = db.users.find(u => u.idDoc === targetDocId);
    if (!targetUser) return alert("Professor não encontrado.");

    try {
      if (transferenciaExistente) {
        await firestore.collection("transferencias").doc(transferenciaExistente.idDoc).update({ status: "cancelado" });
      }

      const qty = new Set(emprestimos.map(x => x.equipment)).size;
      await firestore.collection("transferencias").add({
        id: uid(),
        batchId,
        fromUserId: user.id || user.idDoc,
        fromUserDocId: user.idDoc,
        fromUserName: user.name,
        toUserId: targetUser.id || targetUser.idDoc,
        toUserDocId: targetUser.idDoc,
        toUserName: targetUser.name,
        qty: qty,
        status: "pendente",
        createdAt: nowFormatted()
      });

      m.remove();
      modalSucessoTransferencia(batchId, targetUser.name);
    } catch (err) {
      alert("Erro ao enviar a solicitação: " + err.message);
    }
  };
}

function modalSucessoTransferencia(batchId, targetUserName) {
  const m = modal(`
    <div class="modal-top">
      <h2>🎉 Troca Solicitada</h2>
      <button class="close">&times;</button>
    </div>
    <div style="text-align:center; padding:10px 0;">
      <div style="font-size:16px; font-weight:700; color:#10b981; margin-bottom:8px;">
        ✅ Solicitação de troca feita com sucesso!
      </div>
      <p style="font-size:13px; color:#475569; margin-bottom:16px;">
        Sua solicitação foi enviada para o <b>Prof. ${esc(targetUserName)}</b> e aguarda a confirmação dele.
      </p>

      <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
        <span style="font-size:13px; font-weight:600; color:#334155;">Deseja alterar o professor selecionado?</span>
        <div style="margin-top:8px;">
          <button id="btnAlterarProf" class="secondary" style="width:100%; font-size:13px;">
            ✏️ Alterar Professor Destinatário
          </button>
        </div>
      </div>

      <button id="btnFecharSucesso" class="btn-primary" style="width:100%;">
        👍 OK, Entendi
      </button>
    </div>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#btnFecharSucesso").onclick = () => m.remove();
  m.querySelector("#btnAlterarProf").onclick = () => {
    m.remove();
    modalTransferirLote(batchId);
  };
}

function verificarTransferenciasPendentes() {
  if (!user) return;

  const pendentes = db.transferencias.filter(t => 
    (t.toUserId === user.id || t.toUserDocId === user.idDoc || t.toUserId === user.idDoc) && 
    t.status === "pendente"
  );
  if (!pendentes.length) return;

  const t = pendentes[0];
  if (transferenciasExibidas.has(t.idDoc)) return;

  transferenciasExibidas.add(t.idDoc);

  const m = modal(`
    <div id="transf-modal-${t.id}" style="text-align:center; padding:4px;">
      <div style="font-size:28px; margin-bottom:4px;">🔄</div>
      <h3 style="margin:0 0 6px 0; font-size:16px; color:#0f172a;">Troca de Equipamentos</h3>
      <p style="font-size:13px; color:#334155; margin-bottom:14px; line-height:1.4;">
        O <b>Prof. ${esc(t.fromUserName)}</b> deseja transferir <b>${t.qty} máquina(s)</b> para você.
      </p>

      <div style="display:flex; gap:8px;">
        <button class="ok" style="flex:1;" id="btnAceitarTransf">
          ✅ Aceitar
        </button>
        <button class="danger" style="flex:1;" id="btnRecusarTransf">
          ❌ Recusar
        </button>
      </div>
    </div>
  `, true);

  m.querySelector("#btnAceitarTransf").onclick = () => {
    document.querySelectorAll(".modal").forEach(el => el.remove());
    const tr = db.transferencias.find(x => x.idDoc === t.idDoc);
    if (tr) tr.status = "aceito";
    aceitarTransferencia(t.idDoc, t.batchId);
  };

  m.querySelector("#btnRecusarTransf").onclick = () => {
    document.querySelectorAll(".modal").forEach(el => el.remove());
    const tr = db.transferencias.find(x => x.idDoc === t.idDoc);
    if (tr) tr.status = "recusado";
    recusarTransferencia(t.idDoc);
  };
}

async function aceitarTransferencia(idDocTransf, batchId) {
  try {
    firestore.collection("transferencias").doc(idDocTransf).update({ status: "aceito" });

    const empItems = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);
    const resItems = db.reservas.filter(x => (x.batchId || x.id) === batchId);

    empItems.forEach(item => {
      item.userId = user.id || user.idDoc;
      item.userName = user.name;
      firestore.collection("emprestimos").doc(item.idDoc).update({ 
        userId: user.id || user.idDoc, 
        userName: user.name 
      });
    });

    resItems.forEach(item => {
      item.userId = user.id || user.idDoc;
      item.userName = user.name;
      firestore.collection("reservas").doc(item.idDoc).update({ 
        userId: user.id || user.idDoc, 
        userName: user.name 
      });
    });
  } catch (err) {
    console.error("Erro ao transferir:", err);
  }
}

async function recusarTransferencia(idDocTransf) {
  try {
    firestore.collection("transferencias").doc(idDocTransf).update({ status: "recusado" });
  } catch (err) {
    console.error("Erro ao recusar:", err);
  }
}

function encerrarEmprestimosApos1310() {
  const agora = new Date();
  const tempoEmMinutos = agora.getHours() * 60 + agora.getMinutes();
  const limite1310 = 13 * 60 + 10;

  if (tempoEmMinutos < limite1310 && !confirm("Ainda não são 13:10. Deseja encerrar mesmo assim?")) return;

  const hoje = agora.toISOString().split("T")[0];
  const ativos = db.emprestimos.filter(x => x.date === hoje && x.status === "retirado");

  if (!ativos.length) return alert("Não há empréstimos ativos pendentes para encerrar hoje.");

  if (confirm(`Encerrar ${ativos.length} máquinas ativas do dia?`)) {
    ativos.forEach(item => firestore.collection("emprestimos").doc(item.idDoc).update({ status: "devolvido" }));
    alert("Todos os empréstimos foram encerrados com sucesso!");
  }
}

function calendario() {
  const dataAtual = new Date();
  if (calYear !== dataAtual.getFullYear() || calMonth !== dataAtual.getMonth()) {
    calYear = dataAtual.getFullYear();
    calMonth = dataAtual.getMonth();
  }

  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Calendário Interativo de Ocupação</h2>
        <div class="muted">Acompanhe a reserva de máquinas por horário.</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="secondary" onclick="mudarMes(-1)">&lt; Anterior</button>
        <strong id="calMonthTitle" style="font-size:15px; min-width:140px; text-align:center;"></strong>
        <button class="secondary" onclick="mudarMes(1)">Próximo &gt;</button>
      </div>
    </div>
    <div class="card mb-12" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div class="cal-legend">
        <span class="leg-item"><i class="leg-box free"></i> Livre</span>
        <span class="leg-item"><i class="leg-box has-res"></i> Com Reservas</span>
        <span class="leg-item"><i class="leg-box blocked"></i> Bloqueado / Feriado</span>
        <span class="leg-item"><i class="leg-box disabled"></i> Passado / Fim de Semana</span>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <label style="font-size:12px; font-weight:600; color:#475569;">🔍 Filtrar Status:</label>
        <select id="calStatusFilter" style="padding:6px 10px; font-size:12px; border-radius:6px; border:1px solid #cbd5e1;">
          <option value="todos">Todos os Dias</option>
          <option value="free">Apenas Livres</option>
          <option value="has-res">Apenas Com Reservas</option>
          <option value="blocked">Apenas Bloqueados / Feriados</option>
        </select>
      </div>
    </div>
    <div class="card">
      <div class="month-grid-header">
        <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
      </div>
      <div id="monthGrid" class="month-grid"></div>
    </div>`;

  $("calStatusFilter").addEventListener("change", renderMonthGrid);
  renderMonthGrid();
}

function mudarMes(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  else if (calMonth > 11) { calMonth = 0; calYear++; }
  renderMonthGrid();
}

function renderMonthGrid() {
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  if ($("calMonthTitle")) $("calMonthTitle").textContent = `${meses[calMonth]} de ${calYear}`;

  const filtroStatus = $("calStatusFilter") ? $("calStatusFilter").value : "todos";

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = "";
  for (let i = 0; i < firstDay; i++) html += `<div class="month-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const past = isPastDate(dateStr);
    const wknd = isWeekend(dateStr);
    const holi = isHoliday(dateStr);

    const bloqueiosDoDia = db.bloqueios.filter(b => b.date === dateStr);
    const isFullBlocked = bloqueiosDoDia.some(b => b.lesson === "all");
    const partialBlocks = bloqueiosDoDia.filter(b => b.lesson !== "all");

    const reservasDoDia = db.reservas.filter(r => r.date === dateStr && r.status === "confirmed");
    const qtdMaquinasUnicas = new Set(reservasDoDia.map(r => r.equipment)).size;
    const professoresQueReservaram = Array.from(new Set(reservasDoDia.map(r => r.userName)));

    let statusClass = "free";
    let labelFull = "Livre";
    let labelCompact = "Livre";
    let isClickable = true;

    if (past) {
      statusClass = "disabled-day";
      labelFull = "Passado";
      labelCompact = "—";
      isClickable = false;
    } else if (wknd) {
      statusClass = "disabled-day";
      labelFull = "Fim de Semana";
      labelCompact = "—";
      isClickable = false;
    } else if (holi) {
      statusClass = "blocked";
      labelFull = "🎉 Feriado";
      labelCompact = "Feriado";
      isClickable = false;
    } else if (isFullBlocked) {
      const mainBlock = bloqueiosDoDia.find(b => b.lesson === "all");
      const motivo = mainBlock ? mainBlock.reason : "Fechado";
      statusClass = "blocked";
      labelFull = `🚫 Fechado: ${motivo}`;
      labelCompact = `🚫 ${motivo}`;
      isClickable = false;
    } else {
      let txtPartial = "";
      if (partialBlocks.length > 0) {
        const motivos = Array.from(new Set(partialBlocks.map(b => b.reason))).join(", ");
        const aulas = partialBlocks.map(b => `${parseInt(b.lesson, 10) + 1}ª`).join(", ");
        txtPartial = ` [🚫 ${aulas} Aula: ${motivos}]`;
      }

      if (professoresQueReservaram.length > 0) {
        statusClass = "has-res";
        labelFull = `📦 ${qtdMaquinasUnicas} máq. · 👤 ${professoresQueReservaram.join(', ')}${txtPartial}`;
        labelCompact = `📦 ${qtdMaquinasUnicas}${partialBlocks.length ? ' ⚠️' : ''}`;
      } else if (partialBlocks.length > 0) {
        statusClass = "blocked";
        labelFull = `⚠️ Bloqueio Parcial${txtPartial}`;
        labelCompact = `⚠️ ${partialBlocks.length} aula(s)`;
        isClickable = true;
      }
    }

    let lessonsDotsHtml = '<div class="lessons-mini-grid">';
    for (let l = 0; l < 7; l++) {
      let dotClass = "free";
      let titleText = `${l + 1}ª Aula: Livre`;

      if (past || wknd) {
        dotClass = "off";
        titleText = `${l + 1}ª Aula: Indisponível`;
      } else if (holi || isFullBlocked) {
        dotClass = "block";
        titleText = `${l + 1}ª Aula: Bloqueada`;
      } else {
        const isLessonBlocked = bloqueiosDoDia.some(b => b.lesson === String(l));
        const isLessonReserved = reservasDoDia.some(r => parseInt(r.lesson, 10) === l);

        if (isLessonBlocked) {
          dotClass = "block";
          titleText = `${l + 1}ª Aula: Bloqueada`;
        } else if (isLessonReserved) {
          dotClass = "res";
          titleText = `${l + 1}ª Aula: Reservada`;
        }
      }

      lessonsDotsHtml += `<span class="lesson-dot ${dotClass}" title="${titleText}">${l + 1}</span>`;
    }
    lessonsDotsHtml += '</div>';

    let opacidadeStyle = "";
    if (filtroStatus !== "todos" && statusClass !== "disabled-day") {
      if (filtroStatus !== statusClass) {
        opacidadeStyle = 'style="opacity: 0.2; filter: grayscale(1); cursor: not-allowed;"';
      }
    }

    html += `
      <div class="month-day ${statusClass} ${!isClickable ? 'no-click' : ''}" ${opacidadeStyle} onclick="clickDay('${dateStr}', ${isClickable}, '${esc(labelFull)}')">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span class="day-num">${d}</span>
          <span class="day-status day-status-compact">${esc(labelCompact)}</span>
        </div>
        <span class="day-status day-status-full" title="${esc(labelFull)}">${esc(labelFull)}</span>
        ${lessonsDotsHtml}
      </div>`;
  }
  if ($("monthGrid")) $("monthGrid").innerHTML = html;
}

function clickDay(dateStr, isClickable, reason) {
  if (!isClickable) return alert(`Data indisponível. Motivo: ${reason}`);

  const temReservas = db.reservas.some(r => r.date === dateStr && r.status === "confirmed");
  if (temReservas) {
    modalDetalhesDia(dateStr);
  } else {
    modalReserva(dateStr);
  }
}

function modalDetalhesDia(dateStr) {
  const resData = db.reservas.filter(r => r.date === dateStr && r.status === "confirmed");
  const dateFmt = dateStr.split('-').reverse().join('/');

  const groups = {};
  resData.forEach(r => {
    const bid = r.batchId || r.id;
    if (!groups[bid]) {
      groups[bid] = {
        batchId: bid,
        userId: r.userId,
        userName: r.userName,
        type: r.type,
        segment: r.segment || "6_7",
        purpose: r.purpose || "outros",
        lessonsNames: new Set(),
        equipments: new Set(),
        createdAt: r.createdAt || "Data não registrada"
      };
    }
    const tabelaUsada = TABELAS_HORARIOS[r.segment || "6_7"] || TABELAS_HORARIOS["6_7"];
    const slot = tabelaUsada[r.lesson];
    groups[bid].lessonsNames.add(slot ? `${slot.label} (${slot.start}–${slot.end})` : r.lesson);
    groups[bid].equipments.add(r.equipment);
  });

  const list = Object.values(groups);
  const totalMaquinasDia = new Set(resData.map(r => r.equipment)).size;

  const m = modal(`
    <div class="modal-top">
      <h2>📅 Agendamentos do Dia ${dateFmt}</h2>
      <button class="close">&times;</button>
    </div>
    <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div style="font-size:13px;">Total de máquinas reservadas: <b style="color:#4f46e5;">${totalMaquinasDia} máquina(s)</b></div>
      <button class="btn-primary" id="btnNovaReservaDia">+ Agendar Nesta Data</button>
    </div>
    <div class="table-container">
      <div class="table" style="max-height:350px; overflow-y:auto;">
        <table>
          <tr>
            <th>Professor Solicitante</th>
            <th>Tipo</th>
            <th>Segmento</th>
            <th>Atividade / Matéria</th>
            <th>Horários Reservados</th>
            <th>Qtd. Máquinas</th>
            <th>Data/Hora do Pedido</th>
          </tr>
          ${list.map(g => {
            const finObj = FINALIDADES.find(f => f.id === g.purpose);
            const segLabel = g.segment === "8_9" ? "8º/9º Ano" : "6º/7º Ano";
            return `<tr>
              <td><b>👤 ${esc(g.userName)}</b></td>
              <td>${g.type === "tablet" ? "📱 Tablet" : "💻 Notebook"}</td>
              <td><small><b>${segLabel}</b></small></td>
              <td><small>${finObj ? finObj.label : '📌 Outros'}</small></td>
              <td><span class="pill reserved">${Array.from(g.lessonsNames).join(", ")}</span></td>
              <td><b>${g.equipments.size} máq.</b></td>
              <td><small class="muted">🕒 ${g.createdAt}</small></td>
            </tr>`;
          }).join("") || "<tr><td colspan=7>Nenhuma solicitação para esta data.</td></tr>"}
        </table>
      </div>
    </div>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#btnNovaReservaDia").onclick = () => {
    m.remove();
    modalReserva(dateStr);
  };
}

function reservas() {
  const raw = user.role === "admin" ? db.reservas : db.reservas.filter(x => x.userId === user.id);
  const groups = {};
  raw.forEach(r => {
    const bid = r.batchId || r.id;
    if (!groups[bid]) groups[bid] = { batchId: bid, userId: r.userId, userName: r.userName, date: r.date, type: r.type, segment: r.segment || "6_7", purpose: r.purpose, lessonsIndices: new Set(), lessonsNames: new Set(), equipments: new Set(), createdAt: r.createdAt || "Data não registrada" };
    groups[bid].lessonsIndices.add(r.lesson);
    const tabelaUsada = TABELAS_HORARIOS[r.segment || "6_7"] || TABELAS_HORARIOS["6_7"];
    const slot = tabelaUsada[r.lesson];
    groups[bid].lessonsNames.add(slot ? `${slot.label} (${slot.start}–${slot.end})` : r.lesson);
    groups[bid].equipments.add(r.equipment);
  });

  const groupArray = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));

  $("main").innerHTML = `
    <div class="head">
      <div><h2>Reservas por Lote</h2><div class="muted">Agendamentos registrados</div></div>
      <button class="btn-primary" onclick="modalReserva()">+ Nova Reserva</button>
    </div>
    <div class="card">
      <div class="table-container">
        <div class="table">
          <table>
            <tr><th>Professor</th><th>Data Uso</th><th>Tipo</th><th>Segmento</th><th>Atividade / Matéria</th><th>Horários</th><th>Qtd. Máquinas</th><th>Reservado em</th><th>Ações</th></tr>
            ${groupArray.map(g => {
              const finObj = FINALIDADES.find(f => f.id === g.purpose);
              const segLabel = g.segment === "8_9" ? "8º/9º Ano" : "6º/7º Ano";
              return `<tr>
                <td><b>👤 ${esc(g.userName)}</b></td>
                <td><b>${g.date.split('-').reverse().join('/')}</b></td>
                <td>${g.type === "tablet" ? "📱 Tablet" : "💻 Notebook"}</td>
                <td><small><b>${segLabel}</b></small></td>
                <td><small>${finObj ? finObj.label : '📌 Outros'}</small></td>
                <td><span class="pill reserved">${Array.from(g.lessonsNames).join(", ")}</span></td>
                <td><b>${g.equipments.size} máq.</b></td>
                <td><small class="muted">🕒 ${g.createdAt}</small></td>
                <td>
                  ${(user.role === "admin" || user.id === g.userId) ? `
                    <button class="ok" onclick="modalMaquinasExtras('${g.batchId}')">➕ Extra (Máx 5)</button>
                    <button class="danger" onclick="cancelarLote('${g.batchId}')">🗑️ Excluir</button>
                  ` : "—"}
                </td>
              </tr>`;
            }).join("") || "<tr><td colspan=9>Nenhuma reserva registrada.</td></tr>"}
          </table>
        </div>
      </div>
    </div>`;
}

function modalMaquinasExtras(batchId) {
  const loteReservas = db.reservas.filter(r => (r.batchId || r.id) === batchId);
  if (!loteReservas.length) return alert("Reserva não encontrada.");

  const data = loteReservas[0].date;
  const tipo = loteReservas[0].type;
  const seg = loteReservas[0].segment || "6_7";
  const aulas = Array.from(new Set(loteReservas.map(r => parseInt(r.lesson, 10))));
  const userId = loteReservas[0].userId;
  const userName = loteReservas[0].userName;

  const disponiveis = availInLessons(data, aulas, tipo, seg, batchId);
  const maxPermitidoExtra = Math.min(5, disponiveis.length);

  if (maxPermitidoExtra <= 0) {
    return alert("Não há máquinas livres adicionais para esse horário.");
  }

  const m = modal(`
    <div class="modal-top">
      <h2>➕ Solicitar Máquinas Extras (Máximo 5)</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fextra">
      <div class="form-grid">
        <label>Quantidade de Extras (Máx. ${maxPermitidoExtra}):
          <input id="numExtra" type="number" min="1" max="${maxPermitidoExtra}" value="1" required style="width:100%;">
        </label>
      </div>
      <label style="margin-top:12px; display:block; font-size:12px; font-weight:600;">Motivo da Solicitação Extra:
        <input id="motivoExtra" placeholder="Ex: Alunos novatos na turma / Dupla em projeto" required style="width:100%; margin-top:4px;">
      </label>
      <button class="btn-primary" style="margin-top:18px; width:100%">Confirmar Pedido Extra</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fextra").onsubmit = e => {
    e.preventDefault();
    const qtn = parseInt($("numExtra").value, 10);
    const motivo = $("motivoExtra").value.trim();

    if (qtn > 5) return alert("O limite máximo é de 5 máquinas extras por solicitação.");
    if (qtn > maxPermitidoExtra) return alert(`No momento só há saldo de ${maxPermitidoExtra} máquina(s) disponível(is).`);
    if (!motivo) return alert("Por favor, preencha o motivo do pedido extra.");

    const novas = disponiveis.slice(0, qtn);
    const horaCriacao = nowFormatted();
    const tabelaUsada = TABELAS_HORARIOS[seg] || TABELAS_HORARIOS["6_7"];

    aulas.forEach(l => {
      novas.forEach(eq => {
        const rId = uid();
        firestore.collection("reservas").add({ 
          id: rId, batchId, userId, userName, date: data, lesson: l, segment: seg, equipment: eq.id, type: tipo, status: "confirmed", createdAt: horaCriacao, motivoExtra: motivo 
        });
        firestore.collection("emprestimos").add({ 
          id: uid(), reservationId: rId, batchId, userId, userName, date: data, lesson: `${tabelaUsada[l].label} (${tabelaUsada[l].start}–${tabelaUsada[l].end})`, segment: seg, equipment: eq.id, status: "aguardando", createdAt: horaCriacao, motivoExtra: motivo 
        });
      });
    });

    alert(`${qtn} máquina(s) extra(s) adicionada(s) com sucesso!`);
    m.remove();
  };
}

function gerarPlanilhaMensalCSV() {
  const mesAtual = String(calMonth + 1).padStart(2, "0");
  const anoAtual = calYear;
  const transacoes = db.emprestimos.filter(x => x.date.startsWith(`${anoAtual}-${mesAtual}`));

  if (!transacoes.length) return alert(`Nenhuma transação encontrada no mês ${mesAtual}/${anoAtual}.`);

  let csvContent = "\uFEFFID Transação;Professor;Data de Uso;Horário;Máquina;Status;Data/Hora Solicitação;Motivo Extra\n";
  transacoes.forEach(t => csvContent += `"${t.id}";"${t.userName}";"${t.date}";"${t.lesson}";"${t.equipment}";"${t.status}";"${t.createdAt || 'N/A'}";"${t.motivoExtra || ''}"\n`);

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Relatorio_Maquinas_${mesAtual}_${anoAtual}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function cancelarLote(batchId) {
  if (confirm("Deseja cancelar todo este lote de reservas?")) {
    db.reservas.filter(x => (x.batchId || x.id) === batchId).forEach(d => firestore.collection("reservas").doc(d.idDoc).delete());
    db.emprestimos.filter(x => (x.batchId || x.id) === batchId).forEach(d => firestore.collection("emprestimos").doc(d.idDoc).delete());
  }
}

function modalReserva(defaultDate = "") {
  abrirFormularioReserva({ batchId: null, date: defaultDate, type: "notebook", qty: 1, selectedLessons: [], purpose: "redacao", segment: "6_7" });
}

function abrirFormularioReserva({ batchId, date, type, qty, selectedLessons, purpose, segment }) {
  const hoje = date || new Date().toISOString().split("T")[0];
  const isAdm = user.role === "admin";
  const isEdit = !!batchId;
  const segAtual = segment || "6_7";

  const m = modal(`
    <div class="modal-top">
      <h2>${isEdit ? "Editar Agendamento" : "Agendar Máquinas"}</h2>
      <button class="close">&times;</button>
    </div>
    <form id="rf">
      <div class="form-grid">
        <label>Data
          <input id="rd" type="date" value="${hoje}" min="${new Date().toISOString().split("T")[0]}" required style="width:100%;">
        </label>
        <label>Segmento / Turmas:
          <select id="rsegment" style="width:100%;">
            <option value="6_7" ${segAtual === "6_7" ? "selected" : ""}>6º e 7º Anos (Intervalo 09:30 | Almoço 12:20)</option>
            <option value="8_9" ${segAtual === "8_9" ? "selected" : ""}>8º e 9º Anos (Intervalo 08:40 | Almoço 11:30)</option>
          </select>
        </label>
        <label>Tipo de Equipamento
          <select id="rt" style="width:100%;">
            <option value="notebook" ${type === "notebook" ? "selected" : ""}>💻 Notebook</option>
            <option value="tablet" ${type === "tablet" ? "selected" : ""}>📱 Tablet</option>
          </select>
        </label>
        <label id="lblQty">Quantidade
          <input id="rq" type="number" min="1" value="${qty}" required style="width:100%;">
        </label>
        <label>Atividade / Matéria
          <select id="rpurpose" style="width:100%;">
            ${FINALIDADES.map(f => `<option value="${f.id}" ${f.id === purpose ? "selected" : ""}>${f.label}</option>`).join("")}
          </select>
        </label>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:600; font-size:12px; display:block; margin-bottom:4px;">
          Escolher Máquinas Específicas (Opcional):
        </label>
        <input id="rCustomMachines" placeholder="Ex: M88, PV9, SA3 (Separadas por vírgula)" style="width:100%;">
        <small class="muted" style="display:block; margin-top:2px; font-size:11px;">Se deixado em branco, o sistema atribuirá automaticamente.</small>
      </div>

      <div style="margin-top:16px">
        <label style="margin-bottom:8px; font-weight:600; font-size:12px; display:block;">Selecione os Horários (Escolha de 1 até 6 horários):</label>
        <div class="lessons-selector" id="lessonsContainer">
          ${renderizarOpcoesHorario(segAtual)}
        </div>
      </div>

      <div id="ri" class="notice" style="margin-top:14px"></div>
      <button class="btn-primary" style="margin-top:18px; width:100%">${isEdit ? "Salvar Alterações" : "Confirmar Agendamento"}</button>
    </form>
  `);

  const getSelectedLessons = () => Array.from(m.querySelectorAll('input[name="lessonCheck"]:checked')).map(cb => parseInt(cb.value, 10));

  const updateUI = () => {
    const selected = getSelectedLessons();
    const t = $("rt").value;
    const d = $("rd").value;
    const seg = $("rsegment").value;

    if (isPastDate(d) || isWeekend(d) || isHoliday(d)) {
      $("ri").textContent = "A data selecionada não aceita reservas.";
      $("ri").className = "notice danger-notice";
      return;
    }

    if (selected.length === 0) {
      $("ri").textContent = "Selecione pelo menos 1 horário para agendar.";
      $("ri").className = "notice danger-notice";
      return;
    }

    $("lblQty").querySelector("input").previousSibling.textContent = `Quantidade ${isAdm ? "(Sem limite)" : "(Máx. 30)"}`;

    const availMachines = availInLessons(d, selected, t, seg, batchId);
    const maxPermitido = isAdm ? availMachines.length : Math.min(30, availMachines.length);
    $("rq").max = Math.max(1, maxPermitido);

    if (availMachines.length === 0) {
      $("ri").textContent = `Sem equipamentos disponíveis nos horários selecionados para este segmento.`;
      $("ri").className = "notice danger-notice";
    } else {
      $("ri").textContent = `${selected.length} horário(s) selecionado(s). Máquinas livres: até ${maxPermitido}.`;
      $("ri").className = "notice";
    }
  };

  const bindCheckboxes = () => {
    m.querySelectorAll('input[name="lessonCheck"]').forEach(cb => {
      cb.addEventListener("change", e => {
        const selected = getSelectedLessons();
        if (selected.length > 6) {
          e.target.checked = false;
          alert("Você só pode agendar no máximo 6 horários por reserva.");
        }
        cb.closest('.lesson-checkbox').classList.toggle('checked', cb.checked);
        updateUI();
      });
    });
  };
  bindCheckboxes();

  m.querySelector("#rsegment").addEventListener("change", e => {
    $("lessonsContainer").innerHTML = renderizarOpcoesHorario(e.target.value);
    bindCheckboxes();
    updateUI();
  });

  ["rd", "rt"].forEach(id => $(id).addEventListener("change", updateUI));
  m.querySelector(".close").onclick = () => m.remove();

  m.querySelector("#rf").onsubmit = async e => {
    e.preventDefault();
    const selectedLessons = getSelectedLessons();
    const d = $("rd").value;
    const seg = $("rsegment").value;
    const t = $("rt").value;
    const newQty = parseInt($("rq").value, 10);
    const newPurpose = $("rpurpose").value;
    const rawCustomMachines = $("rCustomMachines").value.trim();

    if (isPastDate(d) || isWeekend(d) || isHoliday(d)) return alert("Data inválida ou bloqueada pelo calendário.");
    if (selectedLessons.length === 0) return alert("Selecione pelo menos 1 horário.");
    if (selectedLessons.length > 6) return alert("Você só pode escolher no máximo 6 horários.");

    const availMachines = availInLessons(d, selectedLessons, t, seg, batchId);

    let selecionadas = [];

    if (rawCustomMachines) {
      const customList = rawCustomMachines.split(/[,;\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
      
      for (let reqId of customList) {
        const match = availMachines.find(m => m.id.toUpperCase() === reqId);
        if (!match) {
          return alert(`A máquina "${reqId}" não existe, está em manutenção ou já está reservada nos horários selecionados.`);
        }
        if (!selecionadas.includes(match)) {
          selecionadas.push(match);
        }
      }

      if (selecionadas.length === 0) {
        return alert("Nenhuma máquina válida foi inserida no campo de máquinas específicas.");
      }
    } else {
      if (availMachines.length < newQty) {
        return alert(`Não há ${newQty} máquinas livres nos horários/segmento selecionados.`);
      }
      selecionadas = availMachines.slice(0, newQty);
    }

    if (isEdit) {
      const oldRes = db.reservas.filter(x => (x.batchId || x.id) === batchId);
      const oldEmp = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);
      await Promise.all(oldRes.map(x => firestore.collection("reservas").doc(x.idDoc).delete()));
      await Promise.all(oldEmp.map(x => firestore.collection("emprestimos").doc(x.idDoc).delete()));
    }

    const currentBatchId = batchId || uid();
    const horaCriacao = nowFormatted();
    const tabelaUsada = TABELAS_HORARIOS[seg] || TABELAS_HORARIOS["6_7"];

    selectedLessons.forEach(l => {
      selecionadas.forEach(eq => {
        const rId = uid();
        firestore.collection("reservas").add({ id: rId, batchId: currentBatchId, userId: user.id, userName: user.name, date: d, lesson: l, segment: seg, equipment: eq.id, type: t, status: "confirmed", purpose: newPurpose, createdAt: horaCriacao });
        firestore.collection("emprestimos").add({ id: uid(), reservationId: rId, batchId: currentBatchId, userId: user.id, userName: user.name, date: d, lesson: `${tabelaUsada[l].label} (${tabelaUsada[l].start}–${tabelaUsada[l].end})`, segment: seg, equipment: eq.id, status: "aguardando", purpose: newPurpose, createdAt: horaCriacao });
      });
    });

    m.remove();
    nav("solicitacoes");
  };

  updateUI();
}

function bloqueios() {
  $("main").innerHTML = `
    <div class="head">
      <div><h2>Bloqueios do Sistema</h2><div class="muted">Bloqueio de datas ou horários</div></div>
      <button class="btn-primary" onclick="modalBloqueio()">+ Novo Bloqueio</button>
    </div>
    <div class="card">
      <div class="table-container">
        <div class="table">
          <table>
            <tr><th>Data</th><th>Horário / Aula</th><th>Equipamento</th><th>Motivo</th><th>Ação</th></tr>
            ${db.bloqueios.map(b => `<tr>
              <td><b>${b.date.split('-').reverse().join('/')}</b></td>
              <td>${b.lesson === "all" ? "🚨 Dia Inteiro" : `📌 Aula ${parseInt(b.lesson)+1}`}</td>
              <td>${b.equipment === "all" ? "Todos" : b.equipment}</td>
              <td>${esc(b.reason)}</td>
              <td><button class="danger" onclick="delBlock('${b.idDoc}')">Excluir</button></td>
            </tr>`).join("") || "<tr><td colspan=5>Nenhum bloqueio.</td></tr>"}
          </table>
        </div>
      </div>
    </div>`;
}

function modalBloqueio() {
  const m = modal(`
    <div class="modal-top"><h2>Bloqueio Administrativo</h2><button class="close">&times;</button></div>
    <form id="bf">
      <div class="form-grid">
        <label>Data<input id="bd" type="date" required style="width:100%;"></label>
        <label>Horário / Aula Afetada
          <select id="bl" style="width:100%;">
            <option value="all">🚨 Dia Inteiro (Todas as Aulas)</option>
            ${TABELAS_HORARIOS["6_7"].map((a, i) => `<option value="${i}">📌 Apenas ${a.label} (${a.start}–${a.end})</option>`).join("")}
          </select>
        </label>
      </div>
      <label style="margin-top:12px; display:block; font-size:12px; font-weight:600;">Motivo do Bloqueio:
        <input id="br" placeholder="Ex: Prova Brasil / Reunião de Pais / Prova" required style="width:100%; margin-top:4px;">
      </label>
      <button class="btn-primary" style="margin-top:18px; width:100%">Confirmar Bloqueio</button>
    </form>`);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#bf").onsubmit = e => {
    e.preventDefault();
    firestore.collection("bloqueios").add({
      id: uid(),
      date: $("bd").value,
      lesson: $("bl").value,
      equipment: "all",
      reason: $("br").value
    });
    m.remove();
  };
}

function delBlock(idDoc) {
  firestore.collection("bloqueios").doc(idDoc).delete();
}

function modal(html, isSmall = false) {
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<div class="modal-box ${isSmall ? 'modal-box-sm' : ''}">${html}</div>`;
  document.body.appendChild(m);
  return m;
}