// CONFIGURAÇÃO DO FIREBASE
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

const SESSION_KEY = "controle_sessao_v2";

// CAPTURA DO BOTÃO DE INSTALAÇÃO AUTOMÁTICA (PWA)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (user && !localStorage.getItem("pwa_tutorial_v1")) {
    modalPWAInstalacao();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

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

const FINALIDADES = [
  { id: "speak", label: "🇬🇧 SPEAK (Inglês - Alta Prioridade)", priority: 1 },
  { id: "alura", label: "💻 ALURA (Programação - Alta Prioridade)", priority: 1 },
  { id: "redacao", label: "✍️ Redação (Alta Prioridade)", priority: 1 },
  { id: "diversas", label: "🎮 Atividades Diversas (Prioridade Baixa)", priority: 3 },
  { id: "outros", label: "📌 Outros", priority: 4 }
];

const MODELOS_EQUIPAMENTO = [
  { id: "M", label: "M (Multilaser)" },
  { id: "PV", label: "PV (Positivo Velho)" },
  { id: "PN", label: "PN (Positivo Novo)" },
  { id: "SA", label: "SA (Samsung)" },
  { id: "TAB", label: "TAB (Tablet)" }
];

const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

let db = { users: [], machines: [], reservas: [], bloqueios: [], emprestimos: [], transferencias: [], reports: [] };
let user = null;
let currentPage = "dashboard";

const hojeData = new Date();
let calYear = hojeData.getFullYear();
let calMonth = hojeData.getMonth();

const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pill = s => `<span class="pill ${s}">${({ available: "Disponível", reserved: "Reservado", use: "Em uso", maintenance: "Manutenção" }[s] || s)}</span>`;

function timeToMin(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function horariosConflitam(startA, endA, startB, endB) {
  return Math.max(timeToMin(startA), timeToMin(startB)) < Math.min(timeToMin(endA), timeToMin(endB));
}

document.addEventListener("input", e => {
  if (e.target && ["loginPass", "up", "eup"].includes(e.target.id)) {
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

function aplicarEstilosModernos() {
  if (document.getElementById("style-proati-modern")) return;
  const style = document.createElement("style");
  style.id = "style-proati-modern";
  style.innerHTML = `
    :root {
      --bg-main: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --border-color: #e2e8f0;
      --radius-sm: 6px;
      --radius-md: 10px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
    }
    body { background-color: var(--bg-main); color: var(--text-main); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 12px; }
    .card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); }
    .btn-primary { background: var(--primary); color: #fff; border: none; padding: 10px 16px; border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary:hover { background: var(--primary-hover); }
    .table table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .table th, .table td { padding: 10px 12px; border-bottom: 1px solid var(--border-color); text-align: left; }
    .pill { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .pill.available { background: #dcfce7; color: #166534; }
    .pill.reserved { background: #dbeafe; color: #1e40af; }
    .pill.use { background: #fef3c7; color: #92400e; }
    
    .machine-grid-selector {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 8px;
      max-height: 250px;
      overflow-y: auto;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
    }
    .machine-chip {
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      text-align: center;
      cursor: pointer;
      font-size: 12px;
      background: #f1f5f9;
    }
    .machine-chip.selected {
      background: #2563eb;
      color: #ffffff;
      border-color: #1d4ed8;
      font-weight: bold;
    }

    .admin-comment-box {
      background: #eff6ff;
      border-left: 3px solid #2563eb;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      margin-top: 4px;
    }

    @media (max-width: 768px) {
      body { padding: 8px 8px 75px 8px !important; font-size: 14px; }
      #nav { position: fixed; bottom: 0; left: 0; right: 0; background: #ffffff; display: flex; justify-content: space-around; padding: 6px 4px; border-top: 1px solid var(--border-color); z-index: 9999; box-shadow: var(--shadow-md); }
      #nav button { flex: 1; padding: 6px 2px; font-size: 11px; text-align: center; border: none; background: transparent; display: flex; flex-direction: column; align-items: center; }
      #nav button.active { font-weight: bold; color: var(--primary); }
      .grid { grid-template-columns: 1fr !important; gap: 10px; }
      .head { flex-direction: column; align-items: flex-start !important; gap: 10px; }
      .head button { width: 100%; }
      .table { overflow-x: auto; display: block; width: 100%; }
      .table table { min-width: 600px; }
      .modal-box { width: 95% !important; padding: 16px !important; max-height: 90vh; overflow-y: auto; border-radius: var(--radius-md); }
      .form-grid { grid-template-columns: 1fr !important; }
      .lessons-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .badge-notify { background: #ef4444; color: white; border-radius: 10px; padding: 2px 6px; font-size: 10px; font-weight: bold; }
    }
  `;
  document.head.appendChild(style);
}
aplicarEstilosModernos();

function escutarColecao(colecao, chaveDb) {
  firestore.collection(colecao).onSnapshot(snapshot => {
    db[chaveDb] = snapshot.docs.map(doc => ({ idDoc: doc.id, ...doc.data() }));
    if (user) {
      verificarTransferenciasPendentes();
      window[currentPage]();
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
    if (snap.empty) {
      for (let i = 1; i <= 156; i++) firestore.collection("machines").add({ id: String(i).padStart(3, "0"), type: "notebook", status: "available", serialNumber: "" });
      for (let i = 1; i <= 11; i++) firestore.collection("machines").add({ id: "TAB-" + String(i).padStart(2, "0"), type: "tablet", status: "available", serialNumber: "" });
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

    const blocked = db.bloqueios.some(b => b.date === d && (b.equipment === "all" || b.equipment === m.id));
    if (blocked) return false;

    const temConflito = db.reservas.some(r => {
      if (r.date !== d || r.equipment !== m.id || r.status !== "confirmed") return false;
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
  const savedDocId = localStorage.getItem(SESSION_KEY);
  if (savedDocId) {
    firestore.collection("users").doc(savedDocId).get().then(doc => {
      if (doc.exists) {
        iniciarSessao({ idDoc: doc.id, ...doc.data() });
      } else {
        localStorage.removeItem(SESSION_KEY);
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
  if (u.idDoc) localStorage.setItem(SESSION_KEY, u.idDoc);
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("who").textContent = u.name + " · " + (u.role === "admin" ? "Admin" : "Prof.");
  nav("dashboard");
  verificarTutorialPrimeiroAcesso();
}

function verificarTutorialPrimeiroAcesso() {
  if (!localStorage.getItem("pwa_tutorial_v1")) {
    modalPWAInstalacao();
  }
}

function modalPWAInstalacao() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  const m = modal(`
    <div class="modal-top">
      <h2>📲 Adicionar Atalho do Sistema</h2>
    </div>

    <div class="notice danger-notice" style="margin-bottom:12px; font-size:13px; border-left:4px solid #ef4444; background:#fef2f2; padding:10px; border-radius:6px; color:#991b1b;">
      ⚠️ <b>ATENÇÃO:</b> Utilize preferencialmente o navegador <b>GOOGLE CHROME</b>.<br>
      ❌ Caso você não esteja usando o Google Chrome ou encontre qualquer dificuldade, <b>consulte o PROATI!</b>
    </div>
    
    ${deferredPrompt ? `
      <div style="text-align:center; padding:10px 0;">
        <p style="font-size:14px; color:#334155; margin-bottom:16px;">
          Clique no botão abaixo para criar o atalho direto na sua tela inicial:
        </p>
        <button id="btnInstalarAuto" class="btn-primary" style="background:#16a34a; font-size:16px; padding:14px; width:100%;">
          ⚡ Criar Atalho na Tela Inicial
        </button>
      </div>
    ` : isIOS ? `
      <div style="font-size:13px; color:#334155; line-height:1.5;">
        <p><b>No iPhone / iPad (Safari):</b></p>
        <ol style="padding-left:20px; margin:10px 0;">
          <li>Toque no botão <b>Compartilhar</b> ⎘ (no rodapé do navegador).</li>
          <li>Role as opções e selecione <b>"Adicionar à Tela de Início"</b>.</li>
          <li>Toque em <b>Adicionar</b> no canto superior direito.</li>
        </ol>
        <button class="btn-primary" style="margin-top:12px; width:100%; background:#2563eb;" onclick="concluirTutorialPWA()">
          ✅ Já fiz isso / Acessar
        </button>
      </div>
    ` : `
      <div style="font-size:13px; color:#334155; line-height:1.5;">
        <p><b>Passo a passo no Notebook (GOOGLE CHROME):</b></p>
        <ol style="padding-left:20px; margin:10px 0; line-height:1.6;">
          <li>Certifique-se de estar usando o navegador <b>GOOGLE CHROME</b>.</li>
          <li>Clique nos <b>3 pontinhos (⋮)</b> no canto superior direito.</li>
          <li>Passe o mouse em <b>"Transmitir, guardar e partilhar"</b> (ou <i>Salvar e compartilhar</i>).</li>
          <li>Clique em <b>"Instalar página como app..."</b> ou <b>"Criar atalho..."</b>.</li>
        </ol>
        <button class="btn-primary" style="margin-top:12px; width:100%; background:#2563eb;" onclick="concluirTutorialPWA()">
          ✅ Entendi / Continuar
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
        if (outcome === 'accepted') {
          concluirTutorialPWA();
        }
        deferredPrompt = null;
      }
    };
  }
}

function concluirTutorialPWA() {
  localStorage.setItem("pwa_tutorial_v1", "true");
  const activeModals = document.querySelectorAll(".modal");
  activeModals.forEach(m => m.remove());
}

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
      return `<button class="${x[0] === page ? "active" : ""}" data-p="${x[0]}">
        <span>${x[1].split(' ')[0]}</span> 
        <label>${x[1].split(' ')[1]}${isSol ? notifyBadge : ''}</label>
      </button>`;
    }).join("");

  document.querySelectorAll("#nav button").forEach(b => b.onclick = () => nav(b.dataset.p));
  window[page]();
}

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
        <div class="muted">Pesquise qualquer máquina pelo ID/Nº de Série e consulte todo o histórico de reports e respostas da administração.</div>
      </div>
      <button class="btn-primary" onclick="modalReportDefeito()">+ Reportar Novo Defeito</button>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <input id="searchMachine" placeholder="🔍 Digite o ID da máquina (ex: SA3, PV1, 014)..." style="flex:1; padding:10px; border-radius:6px; border:1px solid #cbd5e1;">
        <select id="filterStatus" style="padding:10px; border-radius:6px; border:1px solid #cbd5e1;">
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
            <td>${r.mediaUrl ? `<a href="${r.mediaUrl}" target="_blank" style="color:#2563eb; font-weight:bold;">🖼️ Mídia</a>` : `<span class="muted">Sem mídia</span>`}</td>
            <td><b>👤 ${esc(r.reporterName)}</b></td>
            <td><small class="muted">${r.createdAt}</small></td>
            <td>
              ${r.adminComment ? `
                <div class="admin-comment-box">
                  <b>💬 Admin:</b> ${esc(r.adminComment)}
                </div>
              ` : `<span class="muted">Sem comentários</span>`}
            </td>
            <td>${r.status === "pendente" ? `<span class="pill reserved">Pendente</span>` : `<span class="pill available">Resolvido</span>`}</td>
            ${user.role === "admin" ? `
              <td>
                <button class="ok" onclick="modalResponderReport('${r.idDoc}')">💬 Comentar / Responder</button>
              </td>
            ` : ''}
          </tr>
        `).join("") || "<tr><td colspan=9>Nenhum relato encontrado com esses filtros.</td></tr>"}
      </table>
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

      <label>Sua Resposta / Parecer Técnico (Ficará visível para os professores):
        <textarea id="adminCommentText" rows="3" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" required>${esc(r.adminComment || '')}</textarea>
      </label>

      <label style="margin-top:12px; display:block;">Status do Chamado:
        <select id="reportStatusSelect" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
          <option value="pendente" ${r.status === "pendente" ? "selected" : ""}>⏳ Em Análise / Pendente</option>
          <option value="resolvido" ${r.status === "resolvido" ? "selected" : ""}>✅ Resolvido / Mantido</option>
        </select>
      </label>

      <button type="submit" class="btn-primary" style="margin-top:16px; width:100%">💾 Salvar Comentário e Atualizar</button>
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
    <label class="lesson-checkbox">
      <input type="checkbox" name="lessonCheck" value="${i}">
      <span><b>${x.label}</b> <small>${x.start}–${x.end}</small></span>
    </label>
  `).join("");
}

function solicitacoes() {
  const raw = user.role === "admin" ? db.emprestimos : db.emprestimos.filter(x => x.userId === user.id);
  const groups = {};
  raw.forEach(x => {
    const bid = x.batchId || x.id;
    if (!groups[bid]) groups[bid] = { batchId: bid, userId: x.userId, userName: x.userName, date: x.date, lessons: new Set(), equipments: new Set(), statuses: new Set(), createdAt: x.createdAt || "Data não registrada" };
    groups[bid].lessons.add(x.lesson);
    groups[bid].equipments.add(x.equipment);
    groups[bid].statuses.add(x.status);
  });

  const groupArray = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));

  $("main").innerHTML = `
    <div class="head">
      <div><h2>Solicitações de Máquinas</h2><div class="muted">Pedidos e entregas rotativas</div></div>
      <button class="btn-primary" onclick="gerarPlanilhaMensalCSV()">📊 Relatório Mensal (.CSV)</button>
    </div>
    <div class="card">
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

            return `<tr>
              <td><b>👤 ${esc(g.userName)}</b></td>
              <td><b>${g.date.split('-').reverse().join('/')}</b></td>
              <td><span class="pill reserved">${Array.from(g.lessons).join(", ")}</span></td>
              <td><b>${g.equipments.size} máq.</b></td>
              <td><small><code>${exibeIds}</code></small></td>
              <td><small class="muted">🕒 ${g.createdAt}</small></td>
              <td>${statusPill}</td>
              <td>
                ${user.role === "admin" && isAguardando ? `<button class="ok" onclick="modalAtribuirMaquinasPedido('${g.batchId}')">📌 Entregar & Atribuir Lote</button>` : ""}
                ${user.role === "admin" && isRetirado ? `<button class="secondary" onclick="devolverLoteRotativo('${g.batchId}')">↩️ Devolver Lote</button>` : ""}
                ${isRetirado && user.id === g.userId ? `<button class="secondary" onclick="modalTransferirLote('${g.batchId}')">🔄 Transferir</button>` : ""}
              </td>
            </tr>`;
          }).join("") || "<tr><td colspan=8>Nenhuma solicitação registrada.</td></tr>"}
        </table>
      </div>
    </div>`;
}

function modalAtribuirMaquinasPedido(batchId) {
  if (user.role !== "admin") return;

  const emprestimos = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);
  if (!emprestimos.length) return alert("Pedido não encontrado.");

  const qtdNecessaria = new Set(emprestimos.map(x => x.equipment)).size;
  const professorNome = emprestimos[0].userName;
  const tipoEquip = emprestimos[0].type || "notebook";

  const maquinasDisponiveis = db.machines.filter(m => m.type === tipoEquip && m.status === "available");

  const m = modal(`
    <div class="modal-top">
      <h2>📌 Atribuir Máquinas Rotativas no Pedido</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fAssignOrder">
      <div class="notice" style="margin-bottom:12px; font-size:13px;">
        Entregando para <b>Prof. ${esc(professorNome)}</b>.<br>
        Selecione exatamente <b>${qtdNecessaria} máquina(s)</b> para vincular a este lote:
      </div>

      <div class="machine-grid-selector" id="machineGrid">
        ${maquinasDisponiveis.map(m => `
          <div class="machine-chip" data-id="${m.id}">
            <b>${m.id}</b>
          </div>
        `).join("")}
      </div>

      <div style="margin-top:10px; font-size:13px;" id="lblCount">
        Selecionadas: <b><span id="selectedCount">0</span> / ${qtdNecessaria}</b>
      </div>

      <button type="submit" class="btn-primary" style="margin-top:16px; width:100%">✅ Confirmar Entrega e Liberar Lote</button>
    </form>
  `);

  const selecionadas = new Set();
  const chips = m.querySelectorAll(".machine-chip");

  chips.forEach(chip => {
    chip.onclick = () => {
      const id = chip.dataset.id;
      if (selecionadas.has(id)) {
        selecionadas.delete(id);
        chip.classList.remove("selected");
      } else {
        if (selecionadas.size >= qtdNecessaria) {
          return alert(`Você já selecionou a quantidade necessária (${qtdNecessaria} máquinas).`);
        }
        selecionadas.add(id);
        chip.classList.add("selected");
      }
      m.querySelector("#selectedCount").textContent = selecionadas.size;
    };
  });

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fAssignOrder").onsubmit = async e => {
    e.preventDefault();
    if (selecionadas.size !== qtdNecessaria) {
      return alert(`Selecione exatamente ${qtdNecessaria} máquinas antes de confirmar.`);
    }

    const listaMaquinasNovas = Array.from(selecionadas);

    const itensBatch = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);
    
    itensBatch.forEach((item, idx) => {
      const idMaqAtribuida = listaMaquinasNovas[idx % listaMaquinasNovas.length];
      
      firestore.collection("emprestimos").doc(item.idDoc).update({
        equipment: idMaqAtribuida,
        status: "retirado"
      });
    });

    db.reservas.filter(x => (x.batchId || x.id) === batchId).forEach((item, idx) => {
      const idMaqAtribuida = listaMaquinasNovas[idx % listaMaquinasNovas.length];
      firestore.collection("reservas").doc(item.idDoc).update({
        equipment: idMaqAtribuida
      });
    });

    alert("Lote entregue e máquinas atribuídas com sucesso!");
    m.remove();
  };
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
        <label>Vincular ao Pedido Ativo:
          <select id="repBatch">
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
          <select id="repModel" required>
            ${MODELOS_EQUIPAMENTO.map(m => `<option value="${m.id}">${m.label}</option>`).join("")}
          </select>
        </label>
        <label>Número / Identificador da Máquina:
          <input id="repNum" placeholder="Ex: SA3 ou 014" required>
        </label>
      </div>
      <label style="margin-top:12px">Descrição do Defeito ou Avaria:
        <input id="repDesc" placeholder="Ex: Falta tecla 'Enter' / Tela quebrada / Bateria não carrega" required>
      </label>
      <label style="margin-top:12px">Anexar Foto ou Vídeo (Opcional):
        <input type="file" id="repMedia" accept="image/*,video/*" style="font-size:13px; margin-top:4px;">
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
      <div class="table">
        <table>
          <tr><th>Nome Completo</th><th>Usuário</th><th>Senha</th><th>Perfil</th>${isAdm ? `<th>Ações Admin</th>` : ''}</tr>
          ${db.users.map(u => `<tr>
            <td>${esc(u.name)}</td>
            <td><b>${esc(u.userLogin || u.name)}</b></td>
            <td><code>${esc(u.pass)}</code></td>
            <td>${u.role === "admin" ? "Admin" : "Professor"}</td>
            ${isAdm ? `
              <td>
                <button class="secondary" onclick="modalEditarUsuario('${u.idDoc}')">✏️ Editar</button>
                ${u.id === "adm" ? "" : `<button class="danger" onclick="delUser('${u.idDoc}')">Excluir</button>`}
              </td>
            ` : ''}
          </tr>`).join("")}
        </table>
      </div>
    </div>`;
}

function modalUser() {
  const m = modal(`
    <div class="modal-top"><h2>Cadastrar Usuário</h2><button class="close">&times;</button></div>
    <form id="uf">
      <div class="form-grid">
        <label>Nome Completo<input id="un" required></label>
        <label>Usuário de Login<input id="ul" required></label>
        <label>Senha (Exatamente 4 números)
          <input id="up" type="password" maxlength="4" pattern="\\d{4}" placeholder="Ex: 1234" required>
        </label>
      </div>
      <button class="btn-primary" style="margin-top:18px; width:100%">Cadastrar</button>
    </form>`);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#uf").onsubmit = e => {
    e.preventDefault();
    let p = $("up").value.trim();
    if (p.length !== 4 || isNaN(p)) return alert("A senha deve conter exatamente 4 números.");
    firestore.collection("users").add({ id: uid(), name: $("un").value.trim(), userLogin: $("ul").value.trim().toLowerCase(), pass: p, role: "professor" });
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
        <label>Nome Completo<input id="eun" value="${esc(u.name)}" required></label>
        <label>Usuário Login<input id="eul" value="${esc(u.userLogin || '')}" required></label>
        <label>Senha (Exatamente 4 números)
          <input id="eup" type="password" value="${esc(u.pass)}" maxlength="4" pattern="\\d{4}" required>
        </label>
      </div>
      <button class="btn-primary" style="margin-top:18px; width:100%">Salvar</button>
    </form>`);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#euf").onsubmit = e => {
    e.preventDefault();
    let p = $("eup").value.trim();
    if (p.length !== 4 || isNaN(p)) return alert("A senha deve conter exatamente 4 números.");
    firestore.collection("users").doc(idDoc).update({ name: $("eun").value.trim(), userLogin: $("eul").value.trim().toLowerCase(), pass: p });
    m.remove();
  };
}

function delUser(idDoc) {
  if (confirm("Deseja excluir este usuário?")) firestore.collection("users").doc(idDoc).delete();
}

function modalTransferirLote(batchId) {
  const emprestimos = db.emprestimos.filter(x => (x.batchId || x.id) === batchId && x.status === "retirado");
  if (!emprestimos.length) return alert("Não há empréstimos ativos para transferir neste lote.");

  const professores = db.users.filter(u => u.id !== user.id);
  if (!professores.length) return alert("Nenhum outro professor cadastrado no sistema.");

  const m = modal(`
    <div class="modal-top">
      <h2>🔄 Transferir Máquinas para outro Professor</h2>
      <button class="close">&times;</button>
    </div>
    <form id="ftransfer">
      <div class="notice" style="margin-bottom:12px; padding:8px 12px; border-radius:6px; font-size:13px;">
        Selecione o professor que vai receber as <b>${new Set(emprestimos.map(e => e.equipment)).size} máquina(s)</b>. O destinatário precisará confirmar a troca no sistema.
      </div>
      <label>Professor Destinatário:
        <select id="targetUser" required>
          <option value="">Selecione o professor...</option>
          ${professores.map(p => `<option value="${p.idDoc}">${esc(p.name)}</option>`).join("")}
        </select>
      </label>
      <button class="btn-primary" style="margin-top:18px; width:100%">🚀 Solicitar Transferência</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#ftransfer").onsubmit = e => {
    e.preventDefault();
    const targetDocId = $("targetUser").value;
    const targetUser = db.users.find(u => u.idDoc === targetDocId);
    if (!targetUser) return alert("Professor não encontrado.");

    firestore.collection("transferencias").add({
      id: uid(),
      batchId,
      fromUserId: user.id,
      fromUserName: user.name,
      toUserId: targetUser.id,
      toUserName: targetUser.name,
      toUserDocId: targetUser.idDoc,
      qty: new Set(emprestimos.map(x => x.equipment)).size,
      status: "pendente",
      createdAt: nowFormatted()
    });

    alert(`Solicitação enviada! O Prof. ${targetUser.name} deve confirmar o aceite no perfil dele.`);
    m.remove();
  };
}

function verificarTransferenciasPendentes() {
  if (!user) return;
  const pendentes = db.transferencias.filter(t => t.toUserId === user.id && t.status === "pendente");
  if (!pendentes.length) return;

  const t = pendentes[0];
  if (document.getElementById(`transf-modal-${t.id}`)) return;

  const m = modal(`
    <div id="transf-modal-${t.id}">
      <div class="modal-top">
        <h2>📥 Confirmação de Transferência de Máquinas</h2>
      </div>
      <p style="margin:12px 0;">O <b>Prof. ${esc(t.fromUserName)}</b> deseja transferir <b>${t.qty} máquina(s)</b> para você agora.</p>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="ok" style="flex:1" onclick="aceitarTransferencia('${t.idDoc}', '${t.batchId}')">✅ Aceitar e Ficar com as Máquinas</button>
        <button class="danger" style="flex:1" onclick="recusarTransferencia('${t.idDoc}')">❌ Recusar</button>
      </div>
    </div>
  `);
}

function aceitarTransferencia(idDocTransf, batchId) {
  firestore.collection("transferencias").doc(idDocTransf).update({ status: "aceito" });

  db.emprestimos.filter(x => (x.batchId || x.id) === batchId).forEach(item => {
    firestore.collection("emprestimos").doc(item.idDoc).update({ userId: user.id, userName: user.name });
  });

  db.reservas.filter(x => (x.batchId || x.id) === batchId).forEach(item => {
    firestore.collection("reservas").doc(item.idDoc).update({ userId: user.id, userName: user.name });
  });

  alert("Transferência concluída com sucesso! As máquinas agora estão sob sua responsabilidade.");
  location.reload();
}

function recusarTransferencia(idDocTransf) {
  firestore.collection("transferencias").doc(idDocTransf).update({ status: "recusado" });
  alert("Transferência recusada.");
  location.reload();
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
        <strong id="calMonthTitle" style="font-size:16px; min-width:160px; text-align:center;"></strong>
        <button class="secondary" onclick="mudarMes(1)">Próximo &gt;</button>
      </div>
    </div>
    <div class="card mb-12">
      <div class="cal-legend">
        <span class="leg-item"><i class="leg-box free"></i> Livre</span>
        <span class="leg-item"><i class="leg-box has-res"></i> Com Reservas</span>
        <span class="leg-item"><i class="leg-box blocked"></i> Bloqueado / Feriado</span>
        <span class="leg-item"><i class="leg-box disabled"></i> Passado / Fim de Semana</span>
      </div>
    </div>
    <div class="card">
      <div class="month-grid-header">
        <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
      </div>
      <div id="monthGrid" class="month-grid"></div>
    </div>`;

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

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = "";
  for (let i = 0; i < firstDay; i++) html += `<div class="month-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const past = isPastDate(dateStr);
    const wknd = isWeekend(dateStr);
    const holi = isHoliday(dateStr);
    const isFullBlocked = db.bloqueios.some(b => b.date === dateStr && b.lesson === "all");
    
    const reservasDoDia = db.reservas.filter(r => r.date === dateStr && r.status === "confirmed");
    const qtdMaquinasUnicas = new Set(reservasDoDia.map(r => r.equipment)).size;
    const professoresQueReservaram = Array.from(new Set(reservasDoDia.map(r => r.userName)));

    let statusClass = "free", label = "Livre", isClickable = true;

    if (past) { statusClass = "disabled-day"; label = "Passado"; isClickable = false; }
    else if (wknd) { statusClass = "disabled-day"; label = "Fim de Semana"; isClickable = false; }
    else if (holi) { statusClass = "blocked"; label = "🎉 Feriado"; isClickable = false; }
    else if (isFullBlocked) { statusClass = "blocked"; label = "🚫 Fechado"; isClickable = false; }
    else if (professoresQueReservaram.length > 0) { 
      statusClass = "has-res"; 
      label = `📦 ${qtdMaquinasUnicas} máq. · 👤 ${professoresQueReservaram.join(', ')}`; 
    }

    html += `
      <div class="month-day ${statusClass} ${!isClickable ? 'no-click' : ''}" onclick="clickDay('${dateStr}', ${isClickable}, '${label}')">
        <span class="day-num">${d}</span>
        <span class="day-status" title="${label}">${label}</span>
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
      <div style="font-size:14px;">Total de máquinas reservadas: <b style="color:#2563eb;">${totalMaquinasDia} máquina(s)</b></div>
      <button class="btn-primary" id="btnNovaReservaDia">+ Agendar Nesta Data</button>
    </div>
    <div class="table" style="max-height: 350px; overflow-y: auto;">
      <table>
        <tr>
          <th>Professor Solicitante</th>
          <th>Tipo</th>
          <th>Segmento</th>
          <th>Atividade</th>
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
      <div class="table">
        <table>
          <tr><th>Professor</th><th>Data Uso</th><th>Tipo</th><th>Segmento</th><th>Atividade</th><th>Horários</th><th>Qtd. Máquinas</th><th>Reservado em</th><th>Ações</th></tr>
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
                  <button class="ok" onclick="modalMaquinasExtras('${g.batchId}')">➕ Extra (Máx 4)</button>
                  <button class="danger" onclick="cancelarLote('${g.batchId}')">🗑️ Excluir</button>
                ` : "—"}
              </td>
            </tr>`;
          }).join("") || "<tr><td colspan=9>Nenhuma reserva registrada.</td></tr>"}
        </table>
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
  const maxPermitidoExtra = Math.min(4, disponiveis.length);

  if (maxPermitidoExtra <= 0) return alert("Não há máquinas livres adicionais para esse horário.");

  const m = modal(`
    <div class="modal-top">
      <h2>➕ Solicitar Máquinas Extras (Máximo 4)</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fextra">
      <div class="form-grid">
        <label>Quantidade de Extras (Máx. ${maxPermitidoExtra}):
          <input id="numExtra" type="number" min="1" max="${maxPermitidoExtra}" value="1" required>
        </label>
      </div>
      <label style="margin-top:12px">Motivo da Solicitação Extra:
        <input id="motivoExtra" placeholder="Ex: Alunos novatos na turma / Dupla em projeto" required>
      </label>
      <button class="btn-primary" style="margin-top:18px; width:100%">Confirmar Pedido Extra</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fextra").onsubmit = e => {
    e.preventDefault();
    const qtn = parseInt($("numExtra").value, 10);
    const motivo = $("motivoExtra").value.trim();

    if (qtn > 4) return alert("O limite máximo é de 4 máquinas extras por solicitação.");
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
  abrirFormularioReserva({ batchId: null, date: defaultDate, type: "notebook", qty: 1, selectedLessons: [], purpose: "speak", segment: "6_7" });
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
          <input id="rd" type="date" value="${hoje}" min="${new Date().toISOString().split("T")[0]}" required>
        </label>
        <label>Segmento / Turmas:
          <select id="rsegment">
            <option value="6_7" ${segAtual === "6_7" ? "selected" : ""}>6º e 7º Anos (Intervalo 09:30 | Almoço 12:20)</option>
            <option value="8_9" ${segAtual === "8_9" ? "selected" : ""}>8º e 9º Anos (Intervalo 08:40 | Almoço 11:30)</option>
          </select>
        </label>
        <label>Tipo de Equipamento
          <select id="rt">
            <option value="notebook" ${type === "notebook" ? "selected" : ""}>💻 Notebook</option>
            <option value="tablet" ${type === "tablet" ? "selected" : ""}>📱 Tablet</option>
          </select>
        </label>
        <label id="lblQty">Quantidade
          <input id="rq" type="number" min="1" value="${qty}" required>
        </label>
        <label>Atividade / Finalidade
          <select id="rpurpose">
            ${FINALIDADES.map(f => `<option value="${f.id}" ${f.id === purpose ? "selected" : ""}>${f.label}</option>`).join("")}
          </select>
        </label>
      </div>

      <div style="margin-top:16px">
        <label style="margin-bottom:8px">Selecione os Horários (Escolha de 1 até 6 horários):</label>
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

    if (selected.includes(6) && t === "notebook") {
      $("ri").textContent = "O 7º horário é exclusivo para tablets.";
      $("ri").className = "notice danger-notice";
      return;
    }

    if (selected.length === 0) {
      $("ri").textContent = "Selecione pelo menos 1 horário para agendar.";
      $("ri").className = "notice danger-notice";
      return;
    }

    const tem7Aula = selected.includes(6);
    const tetoRegra = tem7Aula ? 25 : 30;
    
    $("lblQty").querySelector("input").previousSibling.textContent = `Quantidade ${isAdm ? "(Sem limite)" : `(Máx. ${tetoRegra})`}`;

    const availMachines = availInLessons(d, selected, t, seg, batchId);
    const maxPermitido = isAdm ? availMachines.length : Math.min(tetoRegra, availMachines.length);
    $("rq").max = Math.max(1, maxPermitido);

    if (availMachines.length === 0) {
      $("ri").textContent = `Sem equipamentos disponíveis nos horários selecionados para este segmento.`;
      $("ri").className = "notice danger-notice";
    } else {
      $("ri").textContent = `${selected.length} horário(s) selecionado(s). Máquinas livres: até ${maxPermitido}${tem7Aula ? " (Limite da 7ª Aula: 25)" : ""}.`;
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

    if (isPastDate(d) || isWeekend(d) || isHoliday(d)) return alert("Data inválida ou bloqueada pelo calendário.");
    if (selectedLessons.length === 0) return alert("Selecione pelo menos 1 horário.");
    if (selectedLessons.length > 6) return alert("Você só pode escolher no máximo 6 horários.");

    const limiteMaximo = selectedLessons.includes(6) ? 25 : 30;
    if (!isAdm && newQty > limiteMaximo) {
      return alert(`Para a 7ª aula, o limite máximo permitido é de ${limiteMaximo} máquinas.`);
    }

    const availMachines = availInLessons(d, selectedLessons, t, seg, batchId);
    if (availMachines.length < newQty) {
      return alert(`Não há ${newQty} máquinas livres nos horários/segmento selecionados.`);
    }

    if (isEdit) {
      const oldRes = db.reservas.filter(x => (x.batchId || x.id) === batchId);
      const oldEmp = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);
      await Promise.all(oldRes.map(x => firestore.collection("reservas").doc(x.idDoc).delete()));
      await Promise.all(oldEmp.map(x => firestore.collection("emprestimos").doc(x.idDoc).delete()));
    }

    const currentBatchId = batchId || uid();
    const selecionadas = availMachines.slice(0, newQty);
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
      <div class="table">
        <table>
          <tr><th>Data</th><th>Horário</th><th>Equipamento</th><th>Motivo</th><th>Ação</th></tr>
          ${db.bloqueios.map(b => `<tr>
            <td><b>${b.date.split('-').reverse().join('/')}</b></td>
            <td>${b.lesson === "all" ? "Dia Inteiro" : `Aula ${parseInt(b.lesson)+1}`}</td>
            <td>${b.equipment === "all" ? "Todos" : b.equipment}</td>
            <td>${esc(b.reason)}</td>
            <td><button class="danger" onclick="delBlock('${b.idDoc}')">Excluir</button></td>
          </tr>`).join("") || "<tr><td colspan=5>Nenhum bloqueio.</td></tr>"}
        </table>
      </div>
    </div>`;
}

function modalBloqueio() {
  const m = modal(`
    <div class="modal-top"><h2>Bloqueio Administrativo</h2><button class="close">&times;</button></div>
    <form id="bf">
      <div class="form-grid">
        <label>Data<input id="bd" type="date" required></label>
        <label>Horário
          <select id="bl">
            <option value="all">Dia Inteiro (Todos)</option>
            ${TABELAS_HORARIOS["6_7"].map((a, i) => `<option value="${i}">${a.label}</option>`)}
          </select>
        </label>
      </div>
      <label style="margin-top:12px">Motivo
        <input id="br" placeholder="Ex: Feriado / Prova Brasil" required>
      </label>
      <button class="btn-primary" style="margin-top:18px; width:100%">Confirmar Bloqueio</button>
    </form>`);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#bf").onsubmit = e => {
    e.preventDefault();
    firestore.collection("bloqueios").add({ id: uid(), date: $("bd").value, lesson: $("bl").value, equipment: "all", reason: $("br").value });
    m.remove();
  };
}

function delBlock(idDoc) {
  firestore.collection("bloqueios").doc(idDoc).delete();
}

function modal(html) {
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<div class="modal-box">${html}</div>`;
  document.body.appendChild(m);
  return m;
}
