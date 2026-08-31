// CONFIGURAÇÃO DO SEU PROJETO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCaz1JCXX1RLOZviyG3Ggf47B0blheSa68",
  authDomain: "reserva-escolamariaolimpia.firebaseapp.com",
  projectId: "reserva-escolamariaolimpia",
  storageBucket: "reserva-escolamariaolimpia",
  messagingSenderId: "reserva-escolamariaolimpia",
  appId: "1:122324755743:web:9060239e2572733dd4fc2a"
};

// Inicialização do Firebase e Firestore
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const SESSION_KEY = "controle_sessao_v2";

const AULAS = [
  ["1ª aula", "07:00–07:50"],
  ["2ª aula", "07:50–08:40"],
  ["3ª aula", "08:40–09:30"],
  ["4ª aula", "09:50–10:40"],
  ["5ª aula", "10:40–11:30"],
  ["6ª aula", "11:30–12:20"],
  ["7ª aula", "12:20–13:10"]
];

const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

let db = { users: [], machines: [], reservas: [], bloqueios: [], emprestimos: [] };
let user = null;
let currentPage = "dashboard";
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pill = s => `<span class="pill ${s}">${({ available: "Disponível", reserved: "Reservado", use: "Em uso", maintenance: "Manutenção", assigned: "Atribuído" }[s] || s)}</span>`;

// Escuta em tempo real do Firestore
function escutarColecao(colecao, chaveDb) {
  firestore.collection(colecao).onSnapshot(snapshot => {
    db[chaveDb] = snapshot.docs.map(doc => ({ idDoc: doc.id, ...doc.data() }));
    if (user) window[currentPage]();
  });
}

function inicializarBancoEmNuvem() {
  escutarColecao("users", "users");
  escutarColecao("machines", "machines");
  escutarColecao("reservas", "reservas");
  escutarColecao("bloqueios", "bloqueios");
  escutarColecao("emprestimos", "emprestimos");

  // Cadastro de contas iniciais simplificadas
  firestore.collection("users").get().then(snap => {
    if (snap.empty) {
      firestore.collection("users").add({ id: "adm", name: "Administrador", userLogin: "adm", pass: "1703", role: "admin" });
      firestore.collection("users").add({ id: "demo", name: "Professor Exemplo", userLogin: "prof", pass: "0001", role: "professor" });
    }
  });

  firestore.collection("machines").get().then(snap => {
    if (snap.empty) {
      for (let i = 1; i <= 156; i++) firestore.collection("machines").add({ id: String(i).padStart(3, "0"), type: "notebook", status: "available", owner: "" });
      for (let i = 1; i <= 11; i++) firestore.collection("machines").add({ id: "TAB-" + String(i).padStart(2, "0"), type: "tablet", status: "available", owner: "" });
    }
  });
}

inicializarBancoEmNuvem();

// Regras de Validação de Datas
const isPastDate = d => d < new Date().toISOString().split("T")[0];
const isWeekend = d => [0, 6].includes(new Date(d + "T00:00:00").getDay());
const isHoliday = d => FERIADOS_FIXOS.includes(d.slice(5));
const isBlocked = (d, l, e) => db.bloqueios.some(b => b.date === d && (b.lesson === "all" || b.lesson === l) && (b.equipment === "all" || b.equipment === e));
const active = (d, l, ignoreBatchId = null) => db.reservas.filter(r => r.date === d && String(r.lesson) === String(l) && r.status === "confirmed" && (r.batchId || r.id) !== ignoreBatchId);

const availInLessons = (d, lessons, t, ignoreBatchId = null) => {
  return db.machines.filter(m => 
    m.type === t && 
    m.status !== "maintenance" && 
    m.status !== "assigned" && 
    lessons.every(l => !isBlocked(d, l, m.id) && !active(d, l, ignoreBatchId).some(r => r.equipment === m.id))
  );
};

// Autenticação Persistente
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
  if (u.idDoc) {
    localStorage.setItem(SESSION_KEY, u.idDoc);
  }
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("who").textContent = u.name + " · " + (u.role === "admin" ? "Admin" : "Prof.");
  nav("dashboard");
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const entered = $("loginUser").value.trim().toLowerCase(), pass = $("loginPass").value;
  
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
  ["equipamentos", "💻 Equipamentos"],
  ["emprestimos", "📦 Empréstimos"],
  ["bloqueios", "🚫 Bloqueios"],
  ["usuarios", "👥 Usuários"],
  ["rotatividade", "📈 Rotatividade"]
];

function nav(page) {
  currentPage = page;
  $("nav").innerHTML = menus.filter(x => user.role === "admin" || !["bloqueios", "usuarios", "rotatividade"].includes(x[0]))
    .map(x => `<button class="${x[0] === page ? "active" : ""}" data-p="${x[0]}"><span>${x[1].split(' ')[0]}</span> <label>${x[1].split(' ')[1]}</label></button>`).join("");
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
      <button class="btn-primary" onclick="modalReserva()">+ Nova Reserva</button>
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

    <div class="card section">
      <h3>🔴 Retiradas do Dia (${hoje.split('-').reverse().join('/')})</h3>
      ${usoTabela()}
    </div>`;
}

function calendario() {
  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Calendário Interativo de Ocupação</h2>
        <div class="muted">Clique sobre um dia útil disponível para abrir o formulário de agendamento.</div>
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
    const uniqueMachinesCount = new Set(db.reservas.filter(r => r.date === dateStr && r.status === "confirmed").map(r => r.equipment)).size;

    let statusClass = "free", label = "Livre", isClickable = true;

    if (past) { statusClass = "disabled-day"; label = "Passado"; isClickable = false; }
    else if (wknd) { statusClass = "disabled-day"; label = "Fim de Semana"; isClickable = false; }
    else if (holi) { statusClass = "blocked"; label = "🎉 Feriado"; isClickable = false; }
    else if (isFullBlocked) { statusClass = "blocked"; label = "🚫 Fechado"; isClickable = false; }
    else if (uniqueMachinesCount > 0) { statusClass = "has-res"; label = `📅 ${uniqueMachinesCount} máq.`; }

    html += `
      <div class="month-day ${statusClass} ${!isClickable ? 'no-click' : ''}" onclick="clickDay('${dateStr}', ${isClickable}, '${label}')">
        <span class="day-num">${d}</span>
        <span class="day-status">${label}</span>
      </div>`;
  }

  if ($("monthGrid")) $("monthGrid").innerHTML = html;
}

function clickDay(dateStr, isClickable, reason) {
  if (!isClickable) return alert(`Esta data não está disponível para agendamento. Motivo: ${reason}`);
  modalReserva(dateStr);
}

function usoTabela() {
  const a = db.emprestimos.filter(x => x.status === "retirado");
  if (!a.length) return `<p class="muted">Nenhum equipamento em uso no momento.</p>`;

  const groups = {};
  a.forEach(x => {
    const bid = x.batchId || x.id;
    if (!groups[bid]) {
      groups[bid] = { userName: x.userName, date: x.date, lessons: new Set(), equipments: new Set() };
    }
    groups[bid].lessons.add(x.lesson);
    groups[bid].equipments.add(x.equipment);
  });

  return `
    <div class="table">
      <table>
        <tr><th>Qtd. Máquinas</th><th>Professor</th><th>Data</th><th>Aulas</th></tr>
        ${Object.values(groups).map(g => `<tr>
          <td><b>${g.equipments.size} máq.</b> (${Array.from(g.equipments).slice(0, 3).join(", ")}${g.equipments.size > 3 ? '...' : ''})</td>
          <td>${esc(g.userName)}</td>
          <td>${g.date.split('-').reverse().join('/')}</td>
          <td><span class="pill use">${Array.from(g.lessons).join(", ")}</span></td>
        </tr>`).join("")}
      </table>
    </div>`;
}

function reservas() {
  const raw = user.role === "admin" ? db.reservas : db.reservas.filter(x => x.userId === user.id);
  
  const groups = {};
  raw.forEach(r => {
    const bid = r.batchId || r.id;
    if (!groups[bid]) {
      groups[bid] = {
        batchId: bid,
        userId: r.userId,
        userName: r.userName,
        date: r.date,
        type: r.type,
        lessonsIndices: new Set(),
        lessonsNames: new Set(),
        equipments: new Set()
      };
    }
    groups[bid].lessonsIndices.add(r.lesson);
    groups[bid].lessonsNames.add(AULAS[r.lesson] ? AULAS[r.lesson][0] : r.lesson);
    groups[bid].equipments.add(r.equipment);
  });

  const groupArray = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));

  $("main").innerHTML = `
    <div class="head">
      <div><h2>Reservas por Lote</h2><div class="muted">${user.role === "admin" ? "Todas as reservas do sistema" : "Suas reservas agendadas"}</div></div>
      <button class="btn-primary" onclick="modalReserva()">+ Nova Reserva</button>
    </div>
    <div class="card">
      <div class="table">
        <table>
          <tr>
            <th>Data</th>
            <th>Professor</th>
            <th>Tipo</th>
            <th>Aulas Reservadas</th>
            <th>Qtd. Máquinas</th>
            <th>Ações do Lote</th>
          </tr>
          ${groupArray.map(g => `<tr>
            <td><b>${g.date.split('-').reverse().join('/')}</b></td>
            <td>${esc(g.userName)}</td>
            <td>${g.type === "tablet" ? "📱 Tablet" : "💻 Notebook"}</td>
            <td><span class="pill reserved">${Array.from(g.lessonsNames).join(", ")}</span></td>
            <td><b>${g.equipments.size} máq.</b> (${Array.from(g.equipments).slice(0, 3).join(", ")}${g.equipments.size > 3 ? '...' : ''})</td>
            <td>
              ${(user.role === "admin" || user.id === g.userId) ? `
                <button class="secondary" onclick="modalTrocaMaquina('${g.batchId}')">🔄 Trocar Máq.</button>
                <button class="ok" onclick="modalMaquinasExtras('${g.batchId}')">➕ Extras (Máx 7)</button>
                <button class="secondary" onclick="modalEditarReserva('${g.batchId}')">✏️ Editar</button>
                <button class="danger" onclick="cancelarLote('${g.batchId}')">🗑️ Excluir</button>
              ` : "—"}
            </td>
          </tr>`).join("") || "<tr><td colspan=6>Nenhuma reserva registrada.</td></tr>"}
        </table>
      </div>
    </div>`;
}

function modalTrocaMaquina(batchId) {
  const loteReservas = db.reservas.filter(r => (r.batchId || r.id) === batchId);
  if (!loteReservas.length) return;

  const maquinasDoLote = Array.from(new Set(loteReservas.map(r => r.equipment)));
  const data = loteReservas[0].date;
  const tipo = loteReservas[0].type;
  const aulas = Array.from(new Set(loteReservas.map(r => parseInt(r.lesson, 10))));

  const m = modal(`
    <div class="modal-top">
      <h2>Substituição de Máquina com Defeito</h2>
      <button class="close">&times;</button>
    </div>
    <form id="ftroca">
      <label>Selecione a máquina com problema:
        <select id="maqDefeito" required>
          ${maquinasDoLote.map(id => `<option value="${id}">Máquina ${id}</option>`).join("")}
        </select>
      </label>
      <label style="margin-top:12px">Motivo do Defeito (opcional):
        <input id="motivoTroca" placeholder="Ex: Não liga / Tela piscando / Teclado quebrado">
      </label>
      <div class="notice" style="margin-top:14px">
        Ao confirmar, a máquina com defeito irá para manutenção e uma nova máquina livre será atribuída a este lote.
      </div>
      <button class="btn-primary" style="margin-top:18px; width:100%">Confirmar Troca de Máquina</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#ftroca").onsubmit = async e => {
    e.preventDefault();
    const maqAntiga = $("maqDefeito").value;
    const disponiveis = availInLessons(data, aulas, tipo, batchId);

    if (!disponiveis.length) return alert("Não há nenhuma outra máquina livre desse tipo para substituição no momento.");

    const maqNova = disponiveis[0].id;

    const docAntigo = db.machines.find(m => m.id === maqAntiga);
    if (docAntigo) {
      await firestore.collection("machines").doc(docAntigo.idDoc).update({ status: "maintenance" });
    }

    const resDocs = db.reservas.filter(r => (r.batchId || r.id) === batchId && r.equipment === maqAntiga);
    const empDocs = db.emprestimos.filter(e => (e.batchId || e.id) === batchId && e.equipment === maqAntiga);

    await Promise.all(resDocs.map(r => firestore.collection("reservas").doc(r.idDoc).update({ equipment: maqNova })));
    await Promise.all(empDocs.map(e => firestore.collection("emprestimos").doc(e.idDoc).update({ equipment: maqNova })));

    alert(`Sucesso! Máquina ${maqAntiga} enviada para manutenção.\nSubstituída pela Máquina ${maqNova}.`);
    m.remove();
  };
}

function modalMaquinasExtras(batchId) {
  const loteReservas = db.reservas.filter(r => (r.batchId || r.id) === batchId);
  if (!loteReservas.length) return;

  const data = loteReservas[0].date;
  const tipo = loteReservas[0].type;
  const aulas = Array.from(new Set(loteReservas.map(r => parseInt(r.lesson, 10))));
  const userId = loteReservas[0].userId;
  const userName = loteReservas[0].userName;

  const disponiveis = availInLessons(data, aulas, tipo, batchId);
  const maxPermitidoExtra = Math.min(7, disponiveis.length);

  if (maxPermitidoExtra <= 0) return alert("Não há máquinas livres adicionais para este horário.");

  const m = modal(`
    <div class="modal-top">
      <h2>Adicionar Máquinas Extras (Solicitação de Aluno)</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fextra">
      <label>Quantidade de Máquinas Extras (Máximo 7):
        <input id="numExtra" type="number" min="1" max="${maxPermitidoExtra}" value="1" required>
      </label>
      <div class="notice" style="margin-top:14px">
        Disponíveis no momento para este horário: <b>${disponiveis.length} máquina(s)</b>.
      </div>
      <button class="btn-primary" style="margin-top:18px; width:100%">Adicionar ao Agendamento</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fextra").onsubmit = e => {
    e.preventDefault();
    const qtn = parseInt($("numExtra").value, 10);

    if (qtn > 7) return alert("O limite máximo permitido é de 7 máquinas extras.");
    if (qtn > disponiveis.length) return alert(`Apenas ${disponiveis.length} máquina(s) estão disponíveis.`);

    const novas = disponiveis.slice(0, qtn);

    aulas.forEach(l => {
      novas.forEach(eq => {
        const rId = uid();
        firestore.collection("reservas").add({
          id: rId,
          batchId: batchId,
          userId: userId,
          userName: userName,
          date: data,
          lesson: l,
          equipment: eq.id,
          type: tipo,
          status: "confirmed"
        });
        firestore.collection("emprestimos").add({
          id: uid(),
          reservationId: rId,
          batchId: batchId,
          userId: userId,
          userName: userName,
          date: data,
          lesson: AULAS[l][0],
          equipment: eq.id,
          status: "aguardando"
        });
      });
    });

    alert(`${qtn} máquina(s) extra(s) adicionada(s) ao lote com sucesso!`);
    m.remove();
  };
}

function cancelarLote(batchId) {
  if (confirm("Deseja cancelar todo este lote de reservas com apenas 1 clique?")) {
    const resDocs = db.reservas.filter(x => (x.batchId || x.id) === batchId);
    const empDocs = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);

    resDocs.forEach(d => firestore.collection("reservas").doc(d.idDoc).delete());
    empDocs.forEach(d => firestore.collection("emprestimos").doc(d.idDoc).delete());
  }
}

function modalReserva(defaultDate = "") {
  abrirFormularioReserva({ batchId: null, date: defaultDate, type: "notebook", qty: 1, selectedLessons: [] });
}

function modalEditarReserva(batchId) {
  const loteReservas = db.reservas.filter(r => (r.batchId || r.id) === batchId);
  if (!loteReservas.length) return;

  const dataAtual = loteReservas[0].date;
  const tipoAtual = loteReservas[0].type;
  const aulasAtuais = Array.from(new Set(loteReservas.map(r => parseInt(r.lesson, 10))));
  const qtdAtual = new Set(loteReservas.map(r => r.equipment)).size;

  abrirFormularioReserva({ batchId, date: dataAtual, type: tipoAtual, qty: qtdAtual, selectedLessons: aulasAtuais });
}

function abrirFormularioReserva({ batchId, date, type, qty, selectedLessons }) {
  const hoje = date || new Date().toISOString().split("T")[0];
  const isAdm = user.role === "admin";
  const isEdit = !!batchId;

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
        <label>Tipo de Equipamento
          <select id="rt">
            <option value="notebook" ${type === "notebook" ? "selected" : ""}>💻 Notebook</option>
            <option value="tablet" ${type === "tablet" ? "selected" : ""}>📱 Tablet</option>
          </select>
        </label>
        <label>Quantidade de Máquinas ${isAdm ? "(Sem limite)" : "(Máx. 30)"}
          <input id="rq" type="number" min="1" value="${qty}" required>
        </label>
      </div>

      <div style="margin-top:16px">
        <label style="margin-bottom:8px">Selecione as Aulas (Escolha de 1 até 6 aulas):</label>
        <div class="lessons-selector" id="lessonsContainer">
          ${AULAS.map((x, i) => `
            <label class="lesson-checkbox ${selectedLessons.includes(i) ? "checked" : ""}">
              <input type="checkbox" name="lessonCheck" value="${i}" ${selectedLessons.includes(i) ? "checked" : ""}>
              <span><b>${x[0]}</b> <small>${x[1]}</small></span>
            </label>
          `).join("")}
        </div>
      </div>

      <div id="ri" class="notice" style="margin-top:14px"></div>
      <button class="btn-primary" style="margin-top:18px; width:100%">${isEdit ? "Salvar Alterações do Lote" : "Confirmar Agendamento"}</button>
    </form>
  `);

  const getSelectedLessons = () => Array.from(m.querySelectorAll('input[name="lessonCheck"]:checked')).map(cb => parseInt(cb.value, 10));

  const updateUI = () => {
    const selected = getSelectedLessons();
    const t = $("rt").value;
    const d = $("rd").value;

    if (isPastDate(d) || isWeekend(d) || isHoliday(d)) {
      $("ri").textContent = "A data selecionada é um final de semana, feriado ou dia passado e não aceita reservas.";
      $("ri").className = "notice danger-notice";
      return;
    }

    if (selected.includes(6) && t === "notebook") {
      $("ri").textContent = "A 7ª aula é exclusiva para tablets. Altere para Tablet ou desmarque a 7ª aula.";
      $("ri").className = "notice danger-notice";
      return;
    }

    if (selected.length === 0) {
      $("ri").textContent = "Selecione pelo menos 1 aula para agendar.";
      $("ri").className = "notice danger-notice";
      return;
    }

    const availMachines = availInLessons(d, selected, t, batchId);
    const maxPermitido = isAdm ? availMachines.length : Math.min(30, availMachines.length);
    $("rq").max = Math.max(1, maxPermitido);

    if (availMachines.length === 0) {
      $("ri").textContent = `Sem equipamentos disponíveis em todas as aulas selecionadas simultaneamente.`;
      $("ri").className = "notice danger-notice";
    } else {
      $("ri").textContent = `${selected.length} aula(s) selecionada(s). Máquinas livres para esta solicitação: até ${maxPermitido}.`;
      $("ri").className = "notice";
    }
  };

  m.querySelectorAll('input[name="lessonCheck"]').forEach(cb => {
    cb.addEventListener("change", e => {
      const selected = getSelectedLessons();
      if (selected.length > 6) {
        e.target.checked = false;
        alert("Você só pode agendar no máximo 6 aulas por reserva.");
      }
      cb.closest('.lesson-checkbox').classList.toggle('checked', cb.checked);
      updateUI();
    });
  });

  ["rd", "rt"].forEach(id => $(id).addEventListener("change", updateUI));
  m.querySelector(".close").onclick = () => m.remove();

  m.querySelector("#rf").onsubmit = async e => {
    e.preventDefault();
    const selectedLessons = getSelectedLessons();
    const d = $("rd").value;
    const t = $("rt").value;
    const newQty = parseInt($("rq").value, 10);

    if (isPastDate(d) || isWeekend(d) || isHoliday(d)) return alert("Data inválida ou bloqueada pelo calendário.");
    if (selectedLessons.length === 0) return alert("Selecione pelo menos 1 aula.");
    if (selectedLessons.length > 6) return alert("Você só pode escolher no máximo 6 aulas.");
    if (selectedLessons.includes(6) && t === "notebook") return alert("A 7ª aula é exclusiva para tablets.");
    if (!isAdm && newQty > 30) return alert("Professores podem agendar no máximo 30 máquinas.");

    const availMachines = availInLessons(d, selectedLessons, t, batchId);
    if (availMachines.length < newQty) {
      return alert(`Não há ${newQty} máquinas simultaneamente livres em todas as aulas selecionadas.`);
    }

    if (isEdit) {
      const oldRes = db.reservas.filter(x => (x.batchId || x.id) === batchId);
      const oldEmp = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);
      await Promise.all(oldRes.map(x => firestore.collection("reservas").doc(x.idDoc).delete()));
      await Promise.all(oldEmp.map(x => firestore.collection("emprestimos").doc(x.idDoc).delete()));
    }

    const currentBatchId = batchId || uid();
    const selecionadas = availMachines.slice(0, newQty);

    selectedLessons.forEach(l => {
      selecionadas.forEach(eq => {
        const rId = uid();
        firestore.collection("reservas").add({
          id: rId,
          batchId: currentBatchId,
          userId: user.id,
          userName: user.name,
          date: d,
          lesson: l,
          equipment: eq.id,
          type: t,
          status: "confirmed"
        });
        firestore.collection("emprestimos").add({
          id: uid(),
          reservationId: rId,
          batchId: currentBatchId,
          userId: user.id,
          userName: user.name,
          date: d,
          lesson: AULAS[l][0],
          equipment: eq.id,
          status: "aguardando"
        });
      });
    });

    m.remove();
    nav("reservas");
  };

  updateUI();
}

function equipamentos() {
  $("main").innerHTML = `
    <div class="head">
      <div><h2>Equipamentos</h2><div class="muted">Catálogo de máquinas da escola.</div></div>
      ${user.role === "admin" ? `<button class="btn-primary" onclick="modalEquip()">+ Cadastrar</button>` : ""}
    </div>
    <div class="card">
      <div class="form-grid">
        <label>Buscar<input id="eqq" placeholder="Ex: 001 ou TAB-01"></label>
        <label>Status
          <select id="eqs">
            <option value="">Todos</option>
            <option value="available">Disponível</option>
            <option value="assigned">Atribuído</option>
            <option value="maintenance">Manutenção</option>
          </select>
        </label>
        <label>Tipo
          <select id="eqt">
            <option value="">Todos</option>
            <option value="notebook">Notebook</option>
            <option value="tablet">Tablet</option>
          </select>
        </label>
      </div>
      <div id="eqout" style="margin-top:16px"></div>
    </div>`;

  const refresh = () => {
    let q = $("eqq").value.toLowerCase(), s = $("eqs").value, t = $("eqt").value;
    let a = db.machines.filter(x => (!q || x.id.toLowerCase().includes(q)) && (!s || x.status === s) && (!t || x.type === t));
    $("eqout").innerHTML = `
      <div class="table">
        <table>
          <tr><th>Nº</th><th>Tipo</th><th>Responsável</th><th>Status</th><th>Ações</th></tr>
          ${a.map(x => `<tr>
            <td><b>${x.id}</b></td>
            <td>${x.type === "tablet" ? "📱 Tablet" : "💻 Notebook"}</td>
            <td>${esc((db.users.find(u => u.id === x.owner) || {}).name || "—")}</td>
            <td>${pill(x.status)}</td>
            <td>${user.role === "admin" ? `
              <button class="secondary" onclick="manut('${x.idDoc}', '${x.status}')">${x.status === "maintenance" ? "Ativar" : "Manutenção"}</button>
              <button class="secondary" onclick="atribuir('${x.idDoc}', '${x.id}')">Atribuir</button>` : "—"}
            </td>
          </tr>`).join("")}
        </table>
      </div>`;
  };
  refresh();
  ["eqq", "eqs", "eqt"].forEach(id => $(id).addEventListener("input", refresh));
}

function modalEquip() {
  const m = modal(`
    <div class="modal-top"><h2>Cadastrar Equipamento</h2><button class="close">&times;</button></div>
    <form id="ef">
      <div class="form-grid">
        <label>Número/ID<input id="eid" placeholder="Ex: 157 ou TAB-12" required></label>
        <label>Tipo<select id="et"><option value="notebook">Notebook</option><option value="tablet">Tablet</option></select></label>
        <label>Atribuir a Professor<select id="eo"><option value="">Nenhum (Uso Geral)</option>${db.users.filter(u => u.role === "professor").map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select></label>
      </div>
      <button class="btn-primary" style="margin-top:18px; width:100%">Cadastrar</button>
    </form>`);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#ef").onsubmit = e => {
    e.preventDefault();
    let id = $("eid").value.trim().toUpperCase();
    if (db.machines.some(x => x.id === id)) return alert("Número/ID já cadastrado.");
    let o = $("eo").value;
    firestore.collection("machines").add({ id, type: $("et").value, status: o ? "assigned" : "available", owner: o });
    m.remove();
  };
}

function manut(idDoc, statusAtual) {
  const novoStatus = statusAtual === "maintenance" ? "available" : "maintenance";
  firestore.collection("machines").doc(idDoc).update({ status: novoStatus });
}

function atribuir(idDoc, idMáquina) {
  const m = modal(`
    <div class="modal-top"><h2>Atribuir Máquina ${idMáquina}</h2><button class="close">&times;</button></div>
    <form id="af">
      <label>Professor Responsável
        <select id="au"><option value="">Nenhum (Uso Geral)</option>${db.users.filter(u => u.role === "professor").map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select>
      </label>
      <button class="btn-primary" style="margin-top:18px; width:100%">Salvar Atribuição</button>
    </form>`);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#af").onsubmit = e => {
    e.preventDefault();
    let o = $("au").value;
    firestore.collection("machines").doc(idDoc).update({ owner: o, status: o ? "assigned" : "available" });
    m.remove();
  };
}

function emprestimos() {
  const raw = user.role === "admin" ? db.emprestimos : db.emprestimos.filter(x => x.userId === user.id);

  const groups = {};
  raw.forEach(x => {
    const bid = x.batchId || x.id;
    if (!groups[bid]) {
      groups[bid] = {
        batchId: bid,
        userName: x.userName,
        date: x.date,
        lessons: new Set(),
        equipments: new Set(),
        statuses: new Set()
      };
    }
    groups[bid].lessons.add(x.lesson);
    groups[bid].equipments.add(x.equipment);
    groups[bid].statuses.add(x.status);
  });

  const groupArray = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));

  $("main").innerHTML = `
    <div class="head">
      <div><h2>Empréstimos por Lote</h2><div class="muted">Entrega e devolução presencial em massa.</div></div>
    </div>
    <div class="card">
      <div class="table">
        <table>
          <tr>
            <th>Data</th>
            <th>Professor</th>
            <th>Aulas Reservadas</th>
            <th>Qtd. Máquinas</th>
            <th>Status do Lote</th>
            <th>Ação</th>
          </tr>
          ${groupArray.map(g => {
            const isRetirado = g.statuses.has("retirado");
            const isAguardando = g.statuses.has("aguardando");
            const isDevolvido = g.statuses.has("devolvido") && !isRetirado && !isAguardando;

            let statusPill = pill("available");
            if (isRetirado) statusPill = pill("use");
            else if (isDevolvido) statusPill = `<span class="pill available">Devolvido</span>`;
            else if (isAguardando) statusPill = `<span class="pill reserved">Aguardando</span>`;

            return `<tr>
              <td><b>${g.date.split('-').reverse().join('/')}</b></td>
              <td>${esc(g.userName)}</td>
              <td><span class="pill reserved">${Array.from(g.lessons).join(", ")}</span></td>
              <td><b>${g.equipments.size} máq.</b> (${Array.from(g.equipments).slice(0, 3).join(", ")}${g.equipments.size > 3 ? '...' : ''})</td>
              <td>${statusPill}</td>
              <td>
                ${user.role === "admin" && isAguardando ? `<button class="ok" onclick="emprestimoLote('${g.batchId}','retirado')">Entregar Lote</button>` : ""}
                ${user.role === "admin" && isRetirado ? `<button class="secondary" onclick="emprestimoLote('${g.batchId}','devolvido')">Devolver Lote</button>` : ""}
                <button class="secondary" onclick="modalTrocaMaquina('${g.batchId}')">🔄 Troca</button>
              </td>
            </tr>`;
          }).join("") || "<tr><td colspan=6>Nenhum empréstimo registrado.</td></tr>"}
        </table>
      </div>
    </div>`;
}

function emprestimoLote(batchId, status) {
  const items = db.emprestimos.filter(x => (x.batchId || x.id) === batchId);
  items.forEach(item => firestore.collection("emprestimos").doc(item.idDoc).update({ status }));
}

function bloqueios() {
  $("main").innerHTML = `
    <div class="head">
      <div><h2>Bloqueios do Sistema</h2><div class="muted">Bloqueie datas completas ou aulas específicas.</div></div>
      <button class="btn-primary" onclick="modalBloqueio()">+ Novo Bloqueio</button>
    </div>
    <div class="card">
      <div class="table">
        <table>
          <tr><th>Data</th><th>Horário / Aulas</th><th>Equipamentos</th><th>Motivo</th><th>Ações</th></tr>
          ${db.bloqueios.map(b => `<tr>
            <td><b>${b.date.split('-').reverse().join('/')}</b></td>
            <td>${b.lesson === "all" ? "<span class='pill maintenance'>Dia Inteiro (Todas)</span>" : AULAS[b.lesson][0]}</td>
            <td>${b.equipment === "all" ? "Todos os equipamentos" : b.equipment}</td>
            <td>${esc(b.reason)}</td>
            <td><button class="danger" onclick="delBlock('${b.idDoc}')">Excluir</button></td>
          </tr>`).join("") || "<tr><td colspan=5>Nenhum bloqueio cadastrado.</td></tr>"}
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
        <label>Período / Aula
          <select id="bl">
            <option value="all">🚫 Dia Inteiro (Todas as aulas)</option>
            ${AULAS.map((a, i) => `<option value="${i}">${a[0]} (${a[1]})</option>`).join("")}
          </select>
        </label>
        <label>Equipamento
          <select id="be">
            <option value="all">Todos os Equipamentos</option>
            ${db.machines.map(x => `<option value="${x.id}">${x.id}</option>`).join("")}
          </select>
        </label>
      </div>
      <label style="margin-top:14px">Motivo do Bloqueio
        <input id="br" placeholder="Ex: Prova Brasil / SAEB / Conselho de Classe / Feriado" required>
      </label>
      <button class="btn-primary" style="margin-top:18px; width:100%">Confirmar Bloqueio</button>
    </form>`);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#bf").onsubmit = e => {
    e.preventDefault();
    firestore.collection("bloqueios").add({ id: uid(), date: $("bd").value, lesson: $("bl").value, equipment: $("be").value, reason: $("br").value });
    m.remove();
  };
}

function delBlock(idDoc) {
  firestore.collection("bloqueios").doc(idDoc).delete();
}

function usuarios() {
  $("main").innerHTML = `
    <div class="head">
      <div><h2>Gestão de Usuários</h2><div class="muted">Gerencie professores, logins simplificados e senhas.</div></div>
      <button class="btn-primary" onclick="modalUser()">+ Novo Usuário</button>
    </div>
    <div class="card">
      <div class="table">
        <table>
          <tr><th>Nome Completo</th><th>Usuário de Login</th><th>Senha</th><th>Perfil</th><th>Ação</th></tr>
          ${db.users.map(u => `<tr>
            <td>${esc(u.name)}</td>
            <td><b>${esc(u.userLogin || u.email || u.name)}</b></td>
            <td><code>${esc(u.pass)}</code></td>
            <td>${u.role === "admin" ? "Administrador" : "Professor"}</td>
            <td>
              ${user.role === "admin" ? `
                <button class="secondary" onclick="modalEditarUsuario('${u.idDoc}')">✏️ Editar</button>
                ${u.id === "adm" ? "" : `<button class="danger" onclick="delUser('${u.idDoc}')">Excluir</button>`}
              ` : "—"}
            </td>
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
        <label>Nome Completo<input id="un" required placeholder="Ex: Maria Souza"></label>
        <label>Usuário de Login<input id="ul" required placeholder="Ex: maria"></label>
        <label>Senha (Máx. 4 caracteres)
          <input id="up" maxlength="4" placeholder="Ex: 1234" required>
        </label>
      </div>
      <div class="form-grid" style="margin-top:12px">
        <label>Perfil
          <select id="ur">
            <option value="professor">Professor</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
      </div>
      <button class="btn-primary" style="margin-top:18px; width:100%">Cadastrar Usuário</button>
    </form>`);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#uf").onsubmit = e => {
    e.preventDefault();
    let n = $("un").value.trim();
    let l = $("ul").value.trim().toLowerCase();
    let p = $("up").value.trim();

    if (p.length > 4) return alert("A senha não pode ter mais de 4 caracteres.");
    if (db.users.some(u => (u.userLogin && u.userLogin.toLowerCase() === l))) return alert("Este nome de usuário já está em uso.");

    firestore.collection("users").add({ id: uid(), name: n, userLogin: l, pass: p, role: $("ur").value });
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
        <label>Usuário de Login<input id="eul" value="${esc(u.userLogin || '')}" required></label>
        <label>Senha (Máx. 4 caracteres)
          <input id="eup" value="${esc(u.pass)}" maxlength="4" required>
        </label>
      </div>
      <div class="form-grid" style="margin-top:12px">
        <label>Perfil
          <select id="eur">
            <option value="professor" ${u.role === "professor" ? "selected" : ""}>Professor</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>Administrador</option>
          </select>
        </label>
      </div>
      <button class="btn-primary" style="margin-top:18px; width:100%">Salvar Dados</button>
    </form>`);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#euf").onsubmit = e => {
    e.preventDefault();
    let n = $("eun").value.trim();
    let l = $("eul").value.trim().toLowerCase();
    let p = $("eup").value.trim();

    if (p.length > 4) return alert("A senha não pode ter mais de 4 caracteres.");

    firestore.collection("users").doc(idDoc).update({
      name: n,
      userLogin: l,
      pass: p,
      role: $("eur").value
    });

    m.remove();
  };
}

function delUser(idDoc) {
  if (confirm("Deseja excluir este usuário do sistema?")) {
    firestore.collection("users").doc(idDoc).delete();
  }
}

function rotatividade() {
  let c = {};
  db.reservas.forEach(r => c[r.equipment] = (c[r.equipment] || 0) + 1);
  let a = Object.entries(c).sort((x, y) => y[1] - x[1]);
  $("main").innerHTML = `
    <div class="head"><div><h2>Rotatividade</h2><div class="muted">Relatório de uso acumulado por máquina.</div></div></div>
    <div class="card">
      <div class="table">
        <table>
          <tr><th>Posição</th><th>Equipamento</th><th>Total de Reservas</th></tr>
          ${a.map((x, i) => `<tr><td>${i + 1}º</td><td><b>${x[0]}</b></td><td>${x[1]}</td></tr>`).join("") || "<tr><td colspan=3>Sem reservas registradas.</td></tr>"}
        </table>
      </div>
    </div>`;
}

function modal(html) {
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<div class="modal-box">${html}</div>`;
  document.body.appendChild(m);
  return m;
}