import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const REQUESTS_KEY = "guia-taxi-requests";
const SUPERVISORS_KEY = "guia-taxi-supervisors";
const SETTINGS_KEY = "guia-taxi-settings";
const SESSION_KEY = "guia-taxi-session";
const TAXI_SESSION_KEY = "guia-taxi-taxi-session";
const INFO_SESSION_KEY = "guia-taxi-info-session";
const SUPERVISORS_AREA_SESSION_KEY = "guia-taxi-supervisors-area-session";
const COMPANY_SESSION_KEY = "guia-taxi-company-session";
const DEFAULT_SETTINGS = {
  taxiPassword: "taxi123",
  infoPassword: "info123",
  supervisorsPassword: "super123",
  companyPassword: "1234",
  kmRate: "1,50",
};
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAmM9Dc6nJB08T1Sz0OB6UWdouFriuZFPw",
  authDomain: "guia-taxi-levo.firebaseapp.com",
  projectId: "guia-taxi-levo",
  storageBucket: "guia-taxi-levo.firebasestorage.app",
  messagingSenderId: "909725658582",
  appId: "1:909725658582:web:089e5fb55d591112d00877"
};
const FIREBASE_STATE_PATH = ["apps", "guiaTaxi"];
const PDF_LIBRARY_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
let firebaseDb = null;
let firebaseAuth = null;
let firebaseInitPromise = null;
let isApplyingRemoteState = false;
let realtimeUnsubscribe = null;
let realtimeRetryTimer = null;
let pdfLibraryPromise = null;

const form = document.querySelector("#request-form");
const loginForm = document.querySelector("#login-form");
const taxiLoginForm = document.querySelector("#taxi-login-form");
const infoLoginForm = document.querySelector("#info-login-form");
const supervisorsLoginForm = document.querySelector("#supervisors-login-form");
const companyLoginForm = document.querySelector("#company-login-form");
const supervisorForm = document.querySelector("#supervisor-form");
const driverSupervisorForm = document.querySelector("#driver-supervisor-form");
const companySupervisorForm = document.querySelector("#company-supervisor-form");
const passwordSettingsForm = document.querySelector("#password-settings-form");
const supervisorPasswordForm = document.querySelector("#supervisor-password-form");
const companyPasswordSettingsForm = document.querySelector("#company-password-settings-form");
const companySupervisorPasswordForm = document.querySelector("#company-supervisor-password-form");
const supervisorsAreaPasswordForm = document.querySelector("#supervisors-area-password-form");
const supervisorsResetPasswordForm = document.querySelector("#supervisors-reset-password-form");
const loginSupervisorSelect = document.querySelector("#login-supervisor");
const supervisorSelect = document.querySelector("#supervisor-select");
const passwordSupervisorSelect = document.querySelector("#password-supervisor-select");
const companyPasswordSupervisorSelect = document.querySelector("#company-password-supervisor-select");
const supervisorsResetSelect = document.querySelector("#supervisors-reset-select");
const supervisorList = document.querySelector("#supervisor-list");
const historyBody = document.querySelector("#history-body");
const infoBody = document.querySelector("#info-body");
const companyBody = document.querySelector("#company-body");
const supervisorGrid = document.querySelector("#supervisor-grid");
const driverList = document.querySelector("#driver-list");
const authorizationPreview = document.querySelector("#authorization-preview");
const requesterCopyPreview = document.querySelector("#requester-copy-preview");
const requesterCopyBox = document.querySelector("#requester-copy-box");
const supervisorRequestsPanel = document.querySelector("#supervisor-requests");
const supervisorRequestList = document.querySelector("#supervisor-request-list");
const companyRequestList = document.querySelector("#company-request-list");
const loginStatus = document.querySelector("#login-status");
const taxiLoginStatus = document.querySelector("#taxi-login-status");
const infoLoginStatus = document.querySelector("#info-login-status");
const supervisorsLoginStatus = document.querySelector("#supervisors-login-status");
const companyLoginStatus = document.querySelector("#company-login-status");
const infoMonthInput = document.querySelector("#info-month");
const companyMonthInput = document.querySelector("#company-month");
const kmRateInput = document.querySelector("#km-rate");
const infoTotal = document.querySelector("#info-total");
const infoCount = document.querySelector("#info-count");
const companyTotal = document.querySelector("#company-total");
const companyCount = document.querySelector("#company-count");
const toast = document.querySelector("#toast");
const syncStatus = document.querySelector("#sync-status");
const appNotification = document.querySelector("#app-notification");
const notificationTitle = document.querySelector("#notification-title");
const notificationMessage = document.querySelector("#notification-message");
const notificationClose = document.querySelector("#notification-close");
const exportLastButton = document.querySelector("#export-last");
const printLastButton = document.querySelector("#print-last");
const clearHistoryButton = document.querySelector("#clear-history");
const installAppButton = document.querySelector("#install-app");
const saveRateButton = document.querySelector("#save-rate");
const exportInfoPdfButton = document.querySelector("#export-info-pdf");
const exportCompanyPdfButton = document.querySelector("#export-company-pdf");
const toggleInfoTotalButton = document.querySelector("#toggle-info-total");
let currentInfoRows = [];
let currentCompanyRows = [];
let isInfoTotalHidden = false;
let deferredInstallPrompt = null;
let knownRequestIds = new Set(readStorage(REQUESTS_KEY, []).map((request) => request.id));
let remoteStateLoaded = false;
let notificationAudio = null;

const AUTHORIZED_SUPERVISORS = [
  "Newton Medeiros",
  "Marcos Silva",
  "Flavio Portes",
  "Vinicius Bezerra",
  "Valdir Pozza",
  "Cleison Ribeiro",
  "Cleverson Gritti",
  "Gerson Scarpari",
  "Erasmo Aquino",
  "Marciel Balduino",
  "Valmir Ferreira",
  "Gustavo Silva",
  "Alexandro Silva",
  "Rodrigo Cruz",
  "Patrick Bonfim",
  "Jarbas Sousa",
  "Fernanda Kubiaki",
  "Graciel Silva",
  "Rubiana Lima",
  "Emanuele Sobral",
  "Nicole Violatti",
  "Angélica Silva",
  "Ricardo Barros",
  "Marilza Andrade",
  "Antonio Filho",
  "Maria Silva",
  "Mauro Pelinson",
  "Otoniel Scotti",
];

const today = new Date();
form.elements.date.value = today.toISOString().slice(0, 10);
form.elements.time.value = today.toTimeString().slice(0, 5);
if (infoMonthInput) {
  const oldestMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  infoMonthInput.value = today.toISOString().slice(0, 7);
  infoMonthInput.max = today.toISOString().slice(0, 7);
  infoMonthInput.min = oldestMonth.toISOString().slice(0, 7);
  if (companyMonthInput) {
    companyMonthInput.value = infoMonthInput.value;
    companyMonthInput.max = infoMonthInput.max;
    companyMonthInput.min = infoMonthInput.min;
  }
}

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function canUseServer() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function applyRemoteState(state) {
  if (!state || typeof state !== "object") return;
  isApplyingRemoteState = true;
  if (Array.isArray(state.requests)) {
    notifyNewRequests(state.requests);
    writeStorage(REQUESTS_KEY, state.requests);
  }
  if (Array.isArray(state.supervisors)) writeStorage(SUPERVISORS_KEY, state.supervisors);
  if (state.settings && typeof state.settings === "object") {
    writeStorage(SETTINGS_KEY, { ...DEFAULT_SETTINGS, ...state.settings });
  }
  isApplyingRemoteState = false;
  render();
}

async function getFirebaseDb() {
  if (firebaseDb) return firebaseDb;
  if (firebaseInitPromise) return firebaseInitPromise;

  firebaseInitPromise = (async () => {
    try {
      setSyncStatus("Firebase: conectando...", "pending");
      const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
      firebaseAuth = getAuth(app);
      if (!firebaseAuth.currentUser) await signInAnonymously(firebaseAuth);
      firebaseDb = getFirestore(app);
      setSyncStatus("Firebase conectado", "ok");
      return firebaseDb;
    } catch (error) {
      setSyncStatus(`Firebase erro: ${error.code || error.message || "conexao"}`, "error");
      console.error("Firebase connection error", error);
      firebaseInitPromise = null;
      return null;
    }
  })();

  return firebaseInitPromise;
}

async function saveRemoteState(partialState) {
  if (isApplyingRemoteState) return;
  const db = await getFirebaseDb();
  if (!db) {
    saveServerState(partialState);
    return;
  }

  try {
    await setDoc(doc(db, ...FIREBASE_STATE_PATH), partialState, { merge: true });
    setSyncStatus("Firebase salvo agora", "ok");
  } catch (error) {
    setSyncStatus(`Firebase erro ao salvar: ${error.code || error.message || "permissao"}`, "error");
    console.error("Firebase save error", error);
    saveServerState(partialState);
  }
}

async function loadRemoteState() {
  const db = await getFirebaseDb();
  if (!db) {
    loadServerState();
    return;
  }

  try {
    const stateRef = doc(db, ...FIREBASE_STATE_PATH);
    const snapshot = await getDoc(stateRef);
    if (snapshot.exists()) {
      applyRemoteState(snapshot.data());
      return;
    }

    await setDoc(stateRef, {
      requests: getRequests(),
      supervisors: getSupervisors(),
      settings: getSettings(),
    });
  } catch (error) {
    setSyncStatus(`Firebase erro ao carregar: ${error.code || error.message || "leitura"}`, "error");
    console.error("Firebase load error", error);
    loadServerState();
  }
}

async function saveServerState(partialState) {
  if (!canUseServer()) return;
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partialState),
    });
  } catch {
    // O app continua funcionando no armazenamento local quando o servidor nao estiver ativo.
  }
}

async function loadServerState() {
  if (!canUseServer()) return;
  try {
    const response = await fetch("/api/state");
    if (!response.ok) return;
    const state = await response.json();
    if (Array.isArray(state.requests)) writeStorage(REQUESTS_KEY, state.requests);
    if (Array.isArray(state.supervisors)) writeStorage(SUPERVISORS_KEY, state.supervisors);
    if (state.settings && typeof state.settings === "object") writeStorage(SETTINGS_KEY, { ...DEFAULT_SETTINGS, ...state.settings });
    render();
  } catch {
    // Mantem dados locais como fallback.
  }
}

function scheduleRealtimeReconnect(delay = 5000) {
  if (realtimeRetryTimer) clearTimeout(realtimeRetryTimer);
  realtimeRetryTimer = setTimeout(() => {
    realtimeRetryTimer = null;
    connectRealtime();
  }, delay);
}

function connectRealtime() {
  if (realtimeUnsubscribe) return;

  getFirebaseDb().then((db) => {
    if (!db) {
      connectServerRealtime();
      scheduleRealtimeReconnect();
      return;
    }

    realtimeUnsubscribe = onSnapshot(doc(db, ...FIREBASE_STATE_PATH), (snapshot) => {
      setSyncStatus("Firebase em tempo real ativo", "ok");
      if (snapshot.exists()) applyRemoteState(snapshot.data());
    }, (error) => {
      realtimeUnsubscribe = null;
      setSyncStatus(`Firebase tempo real erro: ${error.code || error.message || "conexao"}`, "error");
      console.error("Firebase realtime error", error);
      connectServerRealtime();
      scheduleRealtimeReconnect();
    });
  });
}

function connectServerRealtime() {
  if (!canUseServer() || !window.EventSource) return;
  const events = new EventSource("/api/events");

  events.onmessage = (event) => {
    try {
      const state = JSON.parse(event.data);
      if (Array.isArray(state.requests)) writeStorage(REQUESTS_KEY, state.requests);
      if (Array.isArray(state.supervisors)) writeStorage(SUPERVISORS_KEY, state.supervisors);
      if (state.settings && typeof state.settings === "object") writeStorage(SETTINGS_KEY, { ...DEFAULT_SETTINGS, ...state.settings });
      render();
    } catch {
      // Ignora eventos incompletos.
    }
  };

  events.onerror = () => {
    events.close();
    window.setTimeout(connectRealtime, 5000);
  };
}

function getRequests() {
  return readStorage(REQUESTS_KEY, []);
}

function saveRequests(requests) {
  writeStorage(REQUESTS_KEY, requests);
  knownRequestIds = new Set(requests.map((request) => request.id));
  saveRemoteState({ requests });
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readStorage(SETTINGS_KEY, {}) };
}

function saveSettings(settings) {
  const nextSettings = { ...getSettings(), ...settings };
  writeStorage(SETTINGS_KEY, nextSettings);
  saveRemoteState({ settings: nextSettings });
}

function getSession() {
  return readStorage(SESSION_KEY, null);
}

function saveSession(session) {
  writeStorage(SESSION_KEY, session);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getLoggedSupervisor() {
  const session = getSession();
  return getSupervisors().find((item) => item.id === session?.supervisorId) || null;
}

function isOwnedByLoggedSupervisor(request) {
  const supervisor = getLoggedSupervisor();
  if (!supervisor || !request) return false;
  return request.supervisorId === supervisor.id || (!request.supervisorId && request.supervisor === supervisor.name);
}

function isTaxiLoggedIn() {
  return readStorage(TAXI_SESSION_KEY, null)?.logged === true;
}

function saveTaxiSession() {
  writeStorage(TAXI_SESSION_KEY, { logged: true });
}

function clearTaxiSession() {
  localStorage.removeItem(TAXI_SESSION_KEY);
}

function isInfoLoggedIn() {
  return readStorage(INFO_SESSION_KEY, null)?.logged === true;
}

function saveInfoSession() {
  writeStorage(INFO_SESSION_KEY, { logged: true });
}

function clearInfoSession() {
  localStorage.removeItem(INFO_SESSION_KEY);
}

function isCompanyLoggedIn() {
  return readStorage(COMPANY_SESSION_KEY, null)?.logged === true;
}

function saveCompanySession() {
  writeStorage(COMPANY_SESSION_KEY, { logged: true });
}

function clearCompanySession() {
  localStorage.removeItem(COMPANY_SESSION_KEY);
}

function normalizeName(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getCompanyPasswords() {
  const settings = getSettings();
  const brenda = getSupervisors().find((supervisor) => normalizeName(supervisor.name).includes("brenda molina"));
  return [settings.companyPassword, brenda?.password, DEFAULT_SETTINGS.companyPassword].filter(Boolean).map(String);
}

function isSupervisorsAreaLoggedIn() {
  return readStorage(SUPERVISORS_AREA_SESSION_KEY, null)?.logged === true;
}

function saveSupervisorsAreaSession() {
  writeStorage(SUPERVISORS_AREA_SESSION_KEY, { logged: true });
}

function clearSupervisorsAreaSession() {
  localStorage.removeItem(SUPERVISORS_AREA_SESSION_KEY);
}

function updateProtectedNavigation() {
  const accessByArea = {
    taxista: isTaxiLoggedIn(),
    informacoes: isInfoLoggedIn(),
    historico: isInfoLoggedIn(),
    supervisores: isSupervisorsAreaLoggedIn(),
    empresa: isCompanyLoggedIn(),
  };

  document.querySelectorAll("[data-protected-nav]").forEach((link) => {
    link.hidden = !accessByArea[link.dataset.protectedNav];
  });
}

function getSupervisors() {
  const stored = readStorage(SUPERVISORS_KEY, []);
  const supervisors = stored.map((supervisor) => ({
    ...supervisor,
    password: supervisor.password || "1234",
  }));

  AUTHORIZED_SUPERVISORS.forEach((name, index) => {
    const exists = supervisors.some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      supervisors.push({
        id: `authorized-${index + 1}`,
        name,
        department: "LEVO Alimentos",
        phone: "-",
        password: "1234",
      });
    }
  });

  const changed = JSON.stringify(supervisors) !== JSON.stringify(stored);
  if (changed) {
    writeStorage(SUPERVISORS_KEY, supervisors);
  }

  return supervisors;
}

function saveSupervisors(supervisors) {
  writeStorage(SUPERVISORS_KEY, supervisors);
  saveRemoteState({ supervisors });
}

function makeId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}`;
}

function formatDate(dateValue) {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function getNotificationAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!notificationAudio) notificationAudio = new AudioContext();
  return notificationAudio;
}

function unlockNotificationSound() {
  const audio = getNotificationAudio();
  if (audio?.state === "suspended") audio.resume().catch(() => null);
}

function playAuthorizationSound() {
  const audio = getNotificationAudio();
  if (!audio) return;

  const start = audio.currentTime;
  const notes = [
    { frequency: 880, at: 0 },
    { frequency: 1175, at: 0.18 },
  ];

  notes.forEach((note) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, start + note.at);
    gain.gain.setValueAtTime(0.0001, start + note.at);
    gain.gain.exponentialRampToValueAtTime(0.18, start + note.at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + 0.14);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start + note.at);
    oscillator.stop(start + note.at + 0.16);
  });
}

function showAppNotification(title, message) {
  if (!appNotification) return;
  notificationTitle.textContent = title;
  notificationMessage.textContent = message;
  appNotification.classList.add("is-visible");
}

function hideAppNotification() {
  appNotification?.classList.remove("is-visible");
}

function notifyNewRequests(requests) {
  const nextIds = new Set(requests.map((request) => request.id));
  const newRequests = requests.filter((request) => request.id && !knownRequestIds.has(request.id));
  knownRequestIds = nextIds;

  if (!remoteStateLoaded) {
    remoteStateLoaded = true;
    return;
  }

  if (!newRequests.length) return;

  const [latest] = newRequests;
  const passenger = latest.passenger || "colaborador";
  const supervisor = latest.supervisor || "supervisor";
  const title = newRequests.length === 1 ? "Nova solicitação recebida" : `${newRequests.length} novas solicitações`;
  const message = `${passenger} - ${supervisor} - guia ${latest.guideNumber || "nova"}`;
  playAuthorizationSound();
  showAppNotification(title, message);
  showToast(title);
}

function setSyncStatus(message, state = "pending") {
  if (!syncStatus) return;
  syncStatus.textContent = message;
  syncStatus.dataset.state = state;
  window.GuiaTaxiFirebaseStatus = { message, state, at: new Date().toISOString() };
}

function clean(value) {
  return String(value || "").trim();
}

function html(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseBrazilNumber(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatBrazilMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatBrazilNumber(value) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function getTripDescription(request) {
  const route = [request.origin, request.destination].filter(Boolean).join(" para ");
  return [request.reason, route].filter(Boolean).join(" - ") || request.notes || "-";
}

function calculateTripValue(request, rateValue = getSettings().kmRate) {
  const kmStart = parseBrazilNumber(request.kmStart);
  const kmEnd = parseBrazilNumber(request.kmEnd);
  const rate = parseBrazilNumber(rateValue);
  const hasKm = kmStart > 0 && kmEnd > 0 && kmEnd >= kmStart;
  const kmDriven = hasKm ? kmEnd - kmStart : 0;
  return {
    kmDriven,
    rate,
    total: kmDriven * rate,
    hasKm,
  };
}

function statusClass(status) {
  const normalized = normalizeName(status || "");
  if (normalized.includes("cancelada")) return "badge--cancelled";
  if (normalized.includes("concluida")) return "badge--done";
  if (normalized.includes("atendimento")) return "badge--progress";
  return "badge--pending";
}

function getStatusBadge(status) {
  const safeStatus = status || "Pendente";
  return `<span class="badge ${statusClass(safeStatus)}">${html(safeStatus)}</span>`;
}

function isCancelled(request) {
  return normalizeName(request?.status || "") === "cancelada";
}

function isCompleted(request) {
  return normalizeName(request?.status || "") === "concluida";
}

function cancellationText(request) {
  if (!isCancelled(request)) return "";

  const details = [
    request.cancellationReason ? `Motivo: ${request.cancellationReason}` : "",
    request.cancelledBy ? `Cancelado por: ${request.cancelledBy}` : "",
  ].filter(Boolean);

  return details.length ? details.join(" | ") : "Autorização cancelada";
}

function cancelRequest(request, actorLabel) {
  if (!request || isCancelled(request)) {
    showToast("Esta autorização já está cancelada.");
    return;
  }

  const reason = clean(window.prompt(`Motivo do cancelamento da ${request.guideNumber}:`, ""));
  if (!reason) {
    showToast("Cancelamento não realizado. Informe o motivo.");
    return;
  }

  const cancelledAt = new Date().toISOString();
  const updated = getRequests().map((item) =>
    item.id === request.id
      ? {
          ...item,
          status: "Cancelada",
          cancellationReason: reason,
          cancelledBy: actorLabel,
          cancelledAt,
        }
      : item,
  );

  saveRequests(updated);
  render();
  showToast(`${request.guideNumber} cancelada.`);
}

function getGuideNumber(request) {
  return String(request.guideNumber || "1").trim();
}

function createdDate(request) {
  return formatDate(String(request.createdAt || "").slice(0, 10)) || formatDate(request.date);
}

function authorizationHeader(request) {
  return `
    <div class="levo-header">
      <div class="levo-logo">
        <strong>LEVO</strong>
        <span>ALIMENTOS</span>
      </div>
      <div class="levo-title">
        <strong>AUTORIZAÇÃO TAXI</strong>
        <span>LEVO Alimentos-Iporã/PR</span>
      </div>
      <div class="levo-number">
        <strong>Nº</strong>
        <span>${html(getGuideNumber(request))}</span>
      </div>
      <div class="levo-date">
        <strong>Data de<br />criação</strong>
        <span>${html(createdDate(request))}</span>
      </div>
    </div>
  `;
}

function requestLine(label, value, className = "") {
  return `
    <div class="model-row ${className}">
      <span>${label}:</span>
      <strong>${html(value || "")}</strong>
    </div>
  `;
}

function authorizationCopy(request, type) {
  const isDriver = type === "driver";
  return `
    <section class="levo-copy">
      ${authorizationHeader(request)}
      <div class="model-title">Autorização de Taxi</div>
      <div class="authorizer-line">
        <span>Autorizador:</span>
        <strong>${html(request.supervisor)}</strong>
      </div>
      <div class="model-body ${isDriver ? "model-body--driver" : ""}">
        <div class="model-pair">
          ${requestLine("Colaborador", request.passenger)}
          ${requestLine("Matrícula", request.employeeId, "model-row--short")}
        </div>
        ${
          isDriver
            ? `<div class="model-pair model-pair--three">
                ${requestLine("Valor", request.fare || "R$ 0,00", "model-row--money")}
                ${requestLine("Km Saída", request.kmStart, "model-row--km")}
                ${requestLine("Km Chegada", request.kmEnd, "model-row--km")}
              </div>`
            : requestLine("Motivo", request.reason || request.notes)
        }
        ${requestLine("Centro de Custo", request.costCenter)}
      </div>
      <div class="signature-model ${isDriver ? "signature-model--driver" : ""}">
        <div class="signature-space">
          <span>${isDriver ? "Assinatura Taxista" : "Assinatura Gestor"}</span>
        </div>
        <div class="city-date">
          <span>Iporã:</span>
          <strong>${html(formatDate(request.date))}</strong>
        </div>
      </div>
    </section>
  `;
}

function authorizationHtml(request, mode = "both") {
  if (!request) {
    return `<p class="empty-state">Nenhuma autorização gerada ainda.</p>`;
  }

  if (mode === "requester") {
    return `<article class="authorization-sheet levo-sheet levo-sheet--single">${authorizationCopy(request, "requester")}</article>`;
  }

  if (mode === "driver") {
    return `<article class="authorization-sheet levo-sheet levo-sheet--single">${authorizationCopy(request, "driver")}</article>`;
  }

  return `
    <article class="authorization-sheet levo-sheet">
      ${authorizationCopy(request, "requester")}
      <div class="cut-line"></div>
      ${authorizationCopy(request, "driver")}
    </article>
  `;
}

function renderSupervisors() {
  const supervisors = getSupervisors();
  supervisorSelect.innerHTML = `<option value="">Selecione o supervisor</option>`;
  loginSupervisorSelect.innerHTML = `<option value="">Selecione o supervisor</option>`;
  if (passwordSupervisorSelect) {
    passwordSupervisorSelect.innerHTML = `<option value="">Selecione o supervisor</option>`;
  }
  if (companyPasswordSupervisorSelect) {
    companyPasswordSupervisorSelect.innerHTML = `<option value="">Selecione o supervisor</option>`;
  }
  if (supervisorsResetSelect) {
    supervisorsResetSelect.innerHTML = `<option value="">Selecione o supervisor</option>`;
  }
  supervisors.forEach((supervisor) => {
    const option = document.createElement("option");
    option.value = supervisor.name;
    option.dataset.department = supervisor.department;
    option.textContent = `${supervisor.name} - ${supervisor.department}`;
    supervisorSelect.appendChild(option);

    const loginOption = document.createElement("option");
    loginOption.value = supervisor.id;
    loginOption.textContent = `${supervisor.name} - ${supervisor.department}`;
    loginSupervisorSelect.appendChild(loginOption);

    if (passwordSupervisorSelect) {
      const passwordOption = document.createElement("option");
      passwordOption.value = supervisor.id;
      passwordOption.textContent = `${supervisor.name} - ${supervisor.department}`;
      passwordSupervisorSelect.appendChild(passwordOption);
    }

    if (companyPasswordSupervisorSelect) {
      const companyPasswordOption = document.createElement("option");
      companyPasswordOption.value = supervisor.id;
      companyPasswordOption.textContent = `${supervisor.name} - ${supervisor.department}`;
      companyPasswordSupervisorSelect.appendChild(companyPasswordOption);
    }

    if (supervisorsResetSelect) {
      const resetOption = document.createElement("option");
      resetOption.value = supervisor.id;
      resetOption.textContent = `${supervisor.name} - ${supervisor.department}`;
      supervisorsResetSelect.appendChild(resetOption);
    }
  });

  supervisorList.innerHTML = supervisors
    .map(
      (supervisor) => `
        <div class="supervisor-item">
          <div>
            <strong>${html(supervisor.name)}</strong>
            <p>${html(supervisor.department)} | ${html(supervisor.phone || "-")} | senha cadastrada</p>
          </div>
          <button class="table-action" type="button" data-remove-supervisor="${supervisor.id}">Remover</button>
        </div>
      `,
    )
    .join("");
}

function applySupervisorSession() {
  const session = getSession();
  const supervisors = getSupervisors();
  const supervisor = supervisors.find((item) => item.id === session?.supervisorId);
  const isLogged = Boolean(supervisor);

  loginForm.hidden = isLogged;
  if (requesterCopyBox) requesterCopyBox.hidden = !isLogged;
  if (supervisorRequestsPanel) supervisorRequestsPanel.hidden = !isLogged;
  form.classList.toggle("is-locked", !isLogged);
  [...form.elements].forEach((element) => {
    element.disabled = !isLogged;
  });

  if (isLogged) {
    supervisorSelect.value = supervisor.name;
    supervisorSelect.disabled = true;
    form.elements.department.value = supervisor.department;
    loginStatus.innerHTML = `
      <div class="logged-card">
        <strong>${html(supervisor.name)}</strong>
        <span>Supervisor logado</span>
        <button class="table-action" type="button" id="logout-supervisor">Sair</button>
      </div>
    `;
  } else {
    loginStatus.innerHTML = `<p class="empty-state">Entre com supervisor e senha para liberar a solicitação.</p>`;
  }
}

function applyTaxiSession() {
  const isLogged = isTaxiLoggedIn();
  const driverArea = document.querySelector(".driver-area");
  const printLastButton = document.querySelector("#print-last");
  taxiLoginForm.hidden = isLogged;
  if (printLastButton) printLastButton.hidden = !isLogged;
  driverArea.classList.toggle("is-locked", !isLogged);
  [...driverArea.querySelectorAll("button, input, select, textarea")].forEach((element) => {
    element.disabled = !isLogged;
  });

  if (isLogged) {
    taxiLoginStatus.innerHTML = `
      <div class="logged-card">
        <strong>Taxista logado</strong>
        <span>Você pode editar valor/KM e imprimir sua via.</span>
        <button class="table-action" type="button" id="logout-taxi">Sair</button>
      </div>
    `;
  } else {
    taxiLoginStatus.innerHTML = `<p class="empty-state">Digite a senha do taxista para acessar as autorizações.</p>`;
  }
}

function applyInfoSession() {
  const isLogged = isInfoLoggedIn();
  const infoArea = document.querySelector(".info-area");
  if (!infoArea) return;

  infoLoginForm.hidden = isLogged;
  infoArea.classList.toggle("is-locked", !isLogged);
  [...infoArea.querySelectorAll("button, input, select, textarea")].forEach((element) => {
    element.disabled = !isLogged;
  });

  if (isLogged) {
    infoLoginStatus.innerHTML = `
      <div class="logged-card">
        <strong>Informações liberadas</strong>
        <span>Você pode filtrar, conferir valores e trocar senhas.</span>
        <button class="table-action" type="button" id="logout-info">Sair</button>
      </div>
    `;
  } else {
    infoLoginStatus.innerHTML = `<p class="empty-state">Digite a senha para acessar a planilha e as configurações.</p>`;
  }
}

function applyCompanySession() {
  const isLogged = isCompanyLoggedIn();
  const companyArea = document.querySelector(".company-area");
  if (!companyArea) return;

  companyLoginForm.hidden = isLogged;
  companyArea.classList.toggle("is-locked", !isLogged);
  [...companyArea.querySelectorAll("button, input, select, textarea")].forEach((element) => {
    element.disabled = !isLogged;
  });

  if (isLogged) {
    companyLoginStatus.innerHTML = `
      <div class="logged-card">
        <strong>Empresa liberada</strong>
        <span>Consulta, PDF, senhas e cadastro de supervisores.</span>
        <button class="table-action" type="button" id="logout-company">Sair</button>
      </div>
    `;
  } else {
    companyLoginStatus.innerHTML = `<p class="empty-state">Digite a senha da empresa para acessar a consulta.</p>`;
  }
}

function applySupervisorsAreaSession() {
  const isLogged = isSupervisorsAreaLoggedIn();
  const supervisorsArea = document.querySelector(".supervisors-area");
  const exportLastButton = document.querySelector("#export-last");
  if (!supervisorsArea) return;

  supervisorsLoginForm.hidden = isLogged;
  if (exportLastButton) exportLastButton.hidden = !isLogged;
  supervisorsArea.classList.toggle("is-locked", !isLogged);
  [...supervisorsArea.querySelectorAll("button, input, select, textarea")].forEach((element) => {
    element.disabled = !isLogged;
  });

  if (isLogged) {
    supervisorsLoginStatus.innerHTML = `
      <div class="logged-card">
        <strong>Aba Supervisores liberada</strong>
        <span>Você pode cadastrar, remover e redefinir senhas.</span>
        <button class="table-action" type="button" id="logout-supervisors-area">Sair</button>
      </div>
    `;
  } else {
    supervisorsLoginStatus.innerHTML = `<p class="empty-state">Digite a senha para acessar o cadastro e as senhas dos supervisores.</p>`;
  }
}

function getInfoFilters() {
  const filters = {};
  document.querySelectorAll("[data-info-filter]").forEach((input) => {
    filters[input.dataset.infoFilter] = clean(input.value).toLowerCase();
  });
  return filters;
}

function getFilteredInfoRows() {
  const settings = getSettings();
  const selectedMonth = infoMonthInput?.value || today.toISOString().slice(0, 7);
  const filters = getInfoFilters();
  const monthRows = getRequests().filter((request) => String(request.date || "").startsWith(selectedMonth));

  const rows = monthRows.map((request) => {
    const calculated = calculateTripValue(request, settings.kmRate);
    return {
      id: request.id,
      date: formatDate(request.date),
      time: request.time || "",
      guideNumber: request.guideNumber || "-",
      employeeId: request.employeeId || "-",
      passenger: request.passenger || "-",
      description: isCancelled(request) ? `${getTripDescription(request)} | ${cancellationText(request)}` : getTripDescription(request),
      driverDescription: request.driverDescription || "-",
      kmStart: request.kmStart || "",
      kmEnd: request.kmEnd || "",
      rate: formatBrazilMoney(calculated.rate),
      fare: calculated.hasKm ? formatBrazilMoney(calculated.total) : "-",
      totalNumber: calculated.total,
      supervisor: request.supervisor || "-",
      status: request.status || "-",
    };
  });

  return rows.filter((row) =>
    Object.entries(filters).every(([key, value]) => !value || String(row[key] || "").toLowerCase().includes(value)),
  );
}

function getCompanyFilters() {
  const filters = {};
  document.querySelectorAll("[data-company-filter]").forEach((input) => {
    filters[input.dataset.companyFilter] = clean(input.value).toLowerCase();
  });
  return filters;
}

function getFilteredCompanyRows() {
  const selectedMonth = companyMonthInput?.value || today.toISOString().slice(0, 7);
  const filters = getCompanyFilters();
  const monthRows = getRequests().filter(
    (request) => !request.companyRemovedAt && String(request.date || "").startsWith(selectedMonth),
  );

  const rows = monthRows.map((request) => {
    const manualFare = parseBrazilNumber(request.fare);
    const calculated = calculateTripValue(request, getSettings().kmRate);
    const value = manualFare > 0 ? manualFare : calculated.total;
    return {
      id: request.id,
      date: formatDate(request.date),
      time: request.time || "",
      guideNumber: request.guideNumber || "-",
      employeeId: request.employeeId || "-",
      passenger: request.passenger || "-",
      description: isCancelled(request) ? `${getTripDescription(request)} | ${cancellationText(request)}` : getTripDescription(request),
      origin: request.origin || "-",
      destination: request.destination || "-",
      fare: value > 0 ? formatBrazilMoney(value) : request.fare || "-",
      totalNumber: value,
      supervisor: request.supervisor || "-",
      status: request.status || "-",
    };
  });

  return rows.filter((row) =>
    Object.entries(filters).every(([key, value]) => !value || String(row[key] || "").toLowerCase().includes(value)),
  );
}

function renderInfoTable() {
  if (!infoBody) return;
  const settings = getSettings();
  if (kmRateInput) kmRateInput.value = settings.kmRate;

  const filtered = getFilteredInfoRows();
  currentInfoRows = filtered;

  const total = filtered.reduce((sum, row) => sum + row.totalNumber, 0);
  infoTotal.textContent = isInfoTotalHidden ? "Total do mês: oculto" : `Total do mês: ${formatBrazilMoney(total)}`;
  toggleInfoTotalButton.textContent = isInfoTotalHidden ? "Mostrar total" : "Ocultar total";
  infoCount.textContent = `${filtered.length} viagens encontradas nos últimos 12 meses de dados salvos`;

  infoBody.innerHTML = filtered.length
    ? filtered
        .map(
          (row) => `
            <tr>
              <td>${html(row.date)}</td>
              <td>${html(row.time)}</td>
              <td>${html(row.guideNumber)}</td>
              <td>${html(row.employeeId)}</td>
              <td>${html(row.passenger)}</td>
              <td>${html(row.description)}</td>
              <td>${html(row.driverDescription)}</td>
              <td>${html(row.kmStart)}</td>
              <td>${html(row.kmEnd)}</td>
              <td><strong>${html(row.fare)}</strong></td>
              <td>${html(row.supervisor)}</td>
              <td>${getStatusBadge(row.status)}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="12" class="empty-state">Nenhuma viagem encontrada para este mês ou filtro.</td></tr>`;
}

function renderCompanyTable() {
  if (!companyBody) return;

  const filtered = getFilteredCompanyRows();
  currentCompanyRows = filtered;
  const total = filtered.reduce((sum, row) => sum + row.totalNumber, 0);

  companyTotal.textContent = `Total do mês: ${formatBrazilMoney(total)}`;
  companyCount.textContent = `${filtered.length} viagens encontradas`;

  companyBody.innerHTML = filtered.length
    ? filtered
        .map(
          (row) => `
            <tr>
              <td>${html(row.date)}</td>
              <td>${html(row.time)}</td>
              <td>${html(row.guideNumber)}</td>
              <td>${html(row.passenger)}</td>
              <td>${html(row.employeeId)}</td>
              <td>${html(row.description)}</td>
              <td>${html(row.origin)}</td>
              <td>${html(row.destination)}</td>
              <td><strong>${html(row.fare)}</strong></td>
              <td>${html(row.supervisor)}</td>
              <td>${getStatusBadge(row.status)}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="11" class="empty-state">Nenhuma viagem encontrada para este mês ou filtro.</td></tr>`;
}

function renderCompanyRequests(requests) {
  if (!companyRequestList) return;

  const visibleRequests = requests.filter((item) => !item.companyRemovedAt);
  companyRequestList.innerHTML = visibleRequests.length
    ? visibleRequests
        .map(
          (item) => `
            <article class="supervisor-request-item">
              <div class="supervisor-request-item__summary">
                <div>
                  <strong>${html(item.guideNumber)} - ${html(item.passenger)}</strong>
                  <p>${html(formatDate(item.date))} às ${html(item.time)} | ${html(item.reason || "-")}</p>
                  <p>Supervisor: <strong>${html(item.supervisor || "-")}</strong> | Matrícula: ${html(item.employeeId || "-")}</p>
                  <p>Origem: ${html(item.origin || "-")} | Destino: ${html(item.destination || "-")}</p>
                  ${isCancelled(item) ? `<p class="status-note">${html(cancellationText(item))}</p>` : ""}
                </div>
                ${getStatusBadge(item.status)}
              </div>
              <div class="form-actions">
                <button class="button button--secondary" type="button" data-print="${item.id}" data-copy="requester">Imprimir via gestor</button>
                <button class="button button--secondary" type="button" data-pdf="${item.id}" data-copy="requester">PDF via gestor</button>
                <button class="button button--primary" type="button" data-company-share-request="${item.id}">Compartilhar PDF</button>
                <button class="button button--danger" type="button" data-remove-company-request="${item.id}">Remover da empresa</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p class="empty-state">Os pedidos feitos pelos supervisores aparecerão aqui em tempo real.</p>`;
}

function render() {
  const requests = getRequests();
  const todayKey = new Date().toISOString().slice(0, 10);

  renderSupervisors();
  applySupervisorSession();
  applySupervisorsAreaSession();
  renderInfoTable();
  applyInfoSession();
  renderCompanyTable();
  renderCompanyRequests(requests);
  applyCompanySession();
  updateProtectedNavigation();

  document.querySelector("#metric-total").textContent = requests.length;
  document.querySelector("#metric-today").textContent = requests.filter((item) => item.date === todayKey).length;
  document.querySelector("#metric-pending").textContent = requests.filter((item) => item.status === "Pendente").length;

  const recent = requests.slice(0, 4);
  supervisorGrid.innerHTML = recent.length
    ? recent
        .map(
          (item) => `
            <article class="request-card">
              <span class="badge">${item.status}</span>
              <strong>${html(item.passenger)}</strong>
              <p>${html(formatDate(item.date))} às ${html(item.time)}</p>
              <p>${html(item.origin)} para ${html(item.destination)}</p>
              <button class="button button--secondary" type="button" data-pdf="${item.id}" data-copy="requester">Via do gestor</button>
            </article>
          `,
        )
        .join("")
    : `<p class="empty-state">Nenhuma solicitação registrada ainda.</p>`;

  const session = getSession();
  const loggedSupervisor = getSupervisors().find((item) => item.id === session?.supervisorId);
  const requesterRequests = loggedSupervisor
    ? requests.filter(
        (item) =>
          !item.supervisorRemovedAt &&
          (item.supervisorId === loggedSupervisor.id || (!item.supervisorId && item.supervisor === loggedSupervisor.name)),
      )
    : [];
  const requesterRequest = requesterRequests[0];
  const driverRequests = requests.filter((item) => !item.driverRemovedAt);
  requesterCopyPreview.innerHTML = authorizationHtml(requesterRequest, "requester");
  supervisorRequestList.innerHTML = requesterRequests.length
    ? requesterRequests
        .map(
          (item) => `
            <article class="supervisor-request-item">
              <div class="supervisor-request-item__summary">
                <div>
                  <strong>${html(item.guideNumber)} - ${html(item.passenger)}</strong>
                  <p>${html(formatDate(item.date))} às ${html(item.time)} | ${html(item.reason || "-")}</p>
                  ${isCancelled(item) ? `<p class="status-note">${html(cancellationText(item))}</p>` : ""}
                </div>
                ${getStatusBadge(item.status)}
              </div>
              <div class="form-actions">
                <button class="button button--secondary" type="button" data-print="${item.id}" data-copy="requester">Imprimir</button>
                <button class="button button--secondary" type="button" data-pdf="${item.id}" data-copy="requester">PDF</button>
                <button class="button button--primary" type="button" data-share-request="${item.id}">Compartilhar PDF</button>
                <button class="button button--secondary" type="button" data-later-request="${item.id}">Deixar para depois</button>
                ${
                  isCancelled(item) || isCompleted(item)
                    ? ""
                    : `<button class="button button--danger" type="button" data-cancel-supervisor="${item.id}">Cancelar autorização</button>`
                }
                <button class="button button--danger" type="button" data-remove-requester="${item.id}">Excluir da lista</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p class="empty-state">Suas solicitações salvas aparecerão aqui.</p>`;
  authorizationPreview.innerHTML = authorizationHtml(driverRequests[0], "driver");
  driverList.innerHTML = driverRequests.length
    ? driverRequests
        .map(
          (item) => `
            <div class="driver-item">
              <div>
                <strong>${html(item.guideNumber)} - ${html(item.passenger)}</strong>
                <p>${html(formatDate(item.date))} às ${html(item.time)} | ${html(item.origin)} para ${html(item.destination)}</p>
                ${getStatusBadge(item.status)}
                ${isCancelled(item) ? `<p class="status-note">${html(cancellationText(item))}</p>` : ""}
              </div>
              <form class="fare-form" data-fare-form="${item.id}">
                <label>
                  Valor
                  <input name="fare" inputmode="decimal" value="${html(item.fare || "")}" placeholder="Ex.: 30,00" />
                </label>
                <label>
                  Km saída
                  <input name="kmStart" inputmode="numeric" value="${html(item.kmStart || "")}" placeholder="74759" />
                </label>
                <label>
                  Km chegada
                  <input name="kmEnd" inputmode="numeric" value="${html(item.kmEnd || "")}" placeholder="74779" />
                </label>
                <label class="span-2">
                  Descrição interna da viagem
                  <textarea name="driverDescription" rows="3" placeholder="Descrição usada somente na aba Informações">${html(item.driverDescription || "")}</textarea>
                </label>
                <button class="button button--primary" type="submit">Salvar valor/KM</button>
              </form>
              <div class="form-actions">
                <button class="button button--secondary" type="button" data-print="${item.id}" data-copy="driver">Imprimir minha via</button>
                <button class="button button--secondary" type="button" data-pdf="${item.id}" data-copy="driver">PDF taxista</button>
                <button class="button button--primary" type="button" data-share-driver-request="${item.id}">Compartilhar PDF</button>
                ${
                  isCancelled(item)
                    ? ""
                    : `<button class="button button--danger" type="button" data-cancel-driver="${item.id}">Cancelar autorização</button>`
                }
                <button class="button button--danger" type="button" data-remove-driver="${item.id}">Excluir autorização</button>
              </div>
            </div>
          `,
        )
        .join("")
    : `<p class="empty-state">As autorizações para impressão aparecerão aqui.</p>`;

  applyTaxiSession();

  const historyRequests = requests.filter((item) => !item.historyRemovedAt);
  historyBody.innerHTML = historyRequests.length
    ? historyRequests
        .map(
          (item) => `
            <tr>
              <td>${html(item.guideNumber)}</td>
              <td>${html(formatDate(item.date))} ${html(item.time)}</td>
              <td>${html(item.passenger)}</td>
              <td>${html(item.origin)}</td>
              <td>${html(item.destination)}</td>
              <td>${getStatusBadge(item.status)}</td>
              <td><button class="table-action" type="button" data-pdf="${item.id}">PDF</button></td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="7" class="empty-state">As guias geradas aparecerão aqui.</td></tr>`;
}

function collectFormData() {
  const data = new FormData(form);
  const createdAt = new Date();
  const session = getSession();
  const selectedSupervisor = getSupervisors().find((item) => item.id === session?.supervisorId);
  const supervisorName = selectedSupervisor?.name || clean(data.get("supervisor"));

  return {
    id: makeId("request"),
    guideNumber: `GT-${createdAt.getFullYear()}-${String(getRequests().length + 1).padStart(4, "0")}`,
    createdAt: createdAt.toISOString(),
    status: "Pendente",
    company: clean(data.get("company")),
    supervisorId: selectedSupervisor?.id || "",
    supervisor: supervisorName,
    department: clean(data.get("department")) || selectedSupervisor?.department || "-",
    passenger: clean(data.get("passenger")),
    employeeId: clean(data.get("employeeId")) || "-",
    date: data.get("date"),
    time: data.get("time"),
    origin: clean(data.get("origin")),
    destination: clean(data.get("destination")),
    reason: data.get("reason"),
    costCenter: clean(data.get("costCenter")) || "-",
    fare: "",
    kmStart: "",
    kmEnd: "",
    notes: clean(data.get("notes")) || "-",
  };
}

function getPrintStyles() {
  return `
    * { box-sizing: border-box; }
    @page { margin: 10mm; size: A4 portrait; }
    body { margin: 0; color: #000; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    .levo-sheet { width: 190mm; min-height: 270mm; margin: 0 auto; padding: 0; border: 0; background: #f7f8fd; }
    .levo-copy { min-height: 126mm; padding: 10mm 3mm 4mm; break-inside: avoid; page-break-inside: avoid; }
    .levo-header { display: grid; grid-template-columns: 30mm 82mm 28mm 27mm; width: 167mm; margin: 0 0 12mm 0; border: 1.5px solid #000; background: #f7f8fd; }
    .levo-header > div { min-height: 10.5mm; border-left: 1.5px solid #000; display: grid; place-items: center; text-align: center; font-size: 9px; font-weight: 700; }
    .levo-header > div:first-child { border-left: 0; }
    .levo-logo strong { color: #53237e; font-size: 20px; line-height: 1; letter-spacing: 1px; }
    .levo-logo span { color: #a42068; font-size: 5px; letter-spacing: 3px; }
    .levo-title strong { font-size: 12px; }
    .levo-title span { font-size: 7px; }
    .levo-number strong, .levo-date strong { font-size: 11px; }
    .levo-number span, .levo-date span { font-size: 11px; font-weight: 800; }
    .model-title { margin: 0 0 8mm 50mm; font-size: 16px; font-weight: 800; }
    .authorizer-line { display: flex; align-items: end; gap: 8mm; margin: -14mm 0 12mm 112mm; font-size: 10px; font-weight: 800; }
    .authorizer-line strong, .model-row strong, .city-date strong { min-width: 27mm; border-bottom: 1px solid #000; padding: 2mm 4mm 1mm; background: #fff; text-align: center; }
    .model-body { display: grid; gap: 4mm; width: 167mm; }
    .model-pair { display: grid; grid-template-columns: 112mm 55mm; align-items: end; }
    .model-pair--three { grid-template-columns: 55mm 56mm 56mm; }
    .model-row { display: flex; align-items: end; gap: 3mm; font-size: 12px; font-weight: 800; }
    .model-row strong { flex: 1; text-align: left; }
    .model-row--short strong, .model-row--money strong, .model-row--km strong { text-align: center; }
    .signature-model { display: flex; align-items: end; justify-content: space-between; width: 167mm; margin-top: 12mm; font-size: 12px; font-weight: 800; }
    .signature-space { width: 68mm; border-top: 1px solid #000; text-align: center; padding-top: 1mm; }
    .city-date { display: flex; align-items: end; gap: 5mm; }
    .cut-line { height: 0; border-top: 1.5px dashed #000; margin: 0; }
  `;
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadPdfLibrary() {
  if (window.html2pdf) return Promise.resolve();
  if (pdfLibraryPromise) return pdfLibraryPromise;

  pdfLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PDF_LIBRARY_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("pdf-library"));
    document.head.appendChild(script);
  });

  return pdfLibraryPromise;
}

async function createGuidePdfFile(request, mode = "both") {
  await loadPdfLibrary();

  const styleElement = document.createElement("style");
  styleElement.textContent = getPrintStyles();
  const wrapper = document.createElement("div");
  wrapper.className = "pdf-render-root";
  wrapper.style.position = "absolute";
  wrapper.style.left = "0";
  wrapper.style.top = "0";
  wrapper.style.width = "190mm";
  wrapper.style.background = "#ffffff";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-1";
  wrapper.innerHTML = authorizationHtml(request, mode);
  document.head.appendChild(styleElement);
  document.body.appendChild(wrapper);

  try {
    const sheet = wrapper.querySelector(".levo-sheet") || wrapper;
    const blob = await window
      .html2pdf()
      .set({
        margin: 0,
        filename: `${request.guideNumber}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(sheet)
      .outputPdf("blob");

    return new File([blob], `${request.guideNumber}.pdf`, { type: "application/pdf" });
  } finally {
    wrapper.remove();
    styleElement.remove();
  }
}

function downloadGuide(request, mode = "both") {
  printAuthorization(request, mode);
  showToast("Use a opção Salvar como PDF na tela de impressão.");
}

async function shareRequestPdf(request, mode = "requester") {
  if (!request) return;

  try {
    showToast("Gerando PDF para compartilhar...");
    const file = await createGuidePdfFile(request, mode);
    const shareData = {
      title: `Guia ${request.guideNumber}`,
      text: `Autorização de táxi ${request.guideNumber}`,
      files: [file],
    };

    if (navigator.canShare?.(shareData) && navigator.share) {
      await navigator.share(shareData);
      showToast("PDF pronto para compartilhamento.");
      return;
    }

    downloadBlob(file, file.name);
    showToast("PDF baixado. Agora envie pelo WhatsApp, e-mail ou outro aplicativo.");
  } catch (error) {
    if (error?.name === "AbortError") return;
    printAuthorization(request, mode);
    showToast("Não foi possível compartilhar direto. Use Salvar como PDF na tela de impressão.");
  }
}

function printAuthorization(request, mode = "both") {
  const printWindow = window.open("", "_blank", "width=900,height=900");
  if (!printWindow) {
    showToast("O navegador bloqueou a janela de impressão.");
    return;
  }

  const printStyles = getPrintStyles();

  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${request.guideNumber}</title>
        <style>${printStyles}</style>
      </head>
      <body class="print-page">
        ${authorizationHtml(request, mode)}
        <script>
          window.addEventListener("load", () => {
            window.print();
          });
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function printInfoReport() {
  if (!isInfoLoggedIn()) {
    showToast("Entre na Área de informações para gerar o PDF.");
    return;
  }

  const rows = getFilteredInfoRows();
  if (!rows.length) {
    showToast("Não há viagens para gerar PDF com o filtro atual.");
    return;
  }

  const selectedMonth = infoMonthInput?.value || today.toISOString().slice(0, 7);
  const [year, month] = selectedMonth.split("-");
  const reportMonth = `${month}/${year}`;
  const total = rows.reduce((sum, row) => sum + row.totalNumber, 0);
  const reportWindow = window.open("", "_blank", "width=1100,height=900");
  if (!reportWindow) {
    showToast("O navegador bloqueou a janela do PDF.");
    return;
  }

  const reportRows = rows
    .map(
      (row) => `
        <tr>
          <td>${html(row.date)}</td>
          <td>${html(row.time)}</td>
          <td>${html(row.guideNumber)}</td>
          <td>${html(row.employeeId)}</td>
          <td>${html(row.passenger)}</td>
          <td>${html(row.description)}</td>
          <td>${html(row.driverDescription)}</td>
          <td>${html(row.kmStart)}</td>
          <td>${html(row.kmEnd)}</td>
          <td>${html(row.fare)}</td>
          <td>${html(row.supervisor)}</td>
          <td>${html(row.status)}</td>
        </tr>
      `,
    )
    .join("");

  reportWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Viagens do mês ${reportMonth}</title>
        <style>
          * { box-sizing: border-box; }
          @page { margin: 10mm; size: A4 landscape; }
          body { margin: 0; color: #111827; background: #fff; font-family: Arial, Helvetica, sans-serif; }
          header { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          p { margin: 0; color: #4b5563; font-size: 12px; }
          .total { border: 1px solid #d1d5db; padding: 10px 12px; font-weight: 800; white-space: nowrap; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; text-transform: uppercase; }
          th:nth-child(4), td:nth-child(4) { width: 7%; }
          th:nth-child(5), td:nth-child(5) { width: 14%; }
          th:nth-child(6), td:nth-child(6) { width: 20%; }
          th:nth-child(7), td:nth-child(7) { width: 16%; }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Relatório de viagens do mês</h1>
            <p>Mês: ${html(reportMonth)} | Registros: ${rows.length} | Gerado em ${html(formatDate(new Date().toISOString().slice(0, 10)))}</p>
          </div>
          <div class="total">Total: ${html(formatBrazilMoney(total))}</div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Hora</th>
              <th>Guia</th>
              <th>Matrícula</th>
              <th>Colaborador</th>
              <th>Descrição da viagem</th>
              <th>Descrição do taxista</th>
              <th>Km saída</th>
              <th>Km chegada</th>
              <th>Valor da viagem</th>
              <th>Solicitante</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${reportRows}</tbody>
        </table>
        <script>
          window.addEventListener("load", () => window.print());
        <\/script>
      </body>
    </html>
  `);
  reportWindow.document.close();
}

function printCompanyReport() {
  if (!isCompanyLoggedIn()) {
    showToast("Entre na área da empresa para gerar o PDF.");
    return;
  }

  const rows = getFilteredCompanyRows();
  if (!rows.length) {
    showToast("Nao ha viagens para gerar PDF com o filtro atual.");
    return;
  }

  const selectedMonth = companyMonthInput?.value || today.toISOString().slice(0, 7);
  const [year, month] = selectedMonth.split("-");
  const reportMonth = `${month}/${year}`;
  const total = rows.reduce((sum, row) => sum + row.totalNumber, 0);
  const reportWindow = window.open("", "_blank", "width=1100,height=900");
  if (!reportWindow) {
    showToast("O navegador bloqueou a janela do PDF.");
    return;
  }

  const reportRows = rows
    .map(
      (row) => `
        <tr>
          <td>${html(row.date)}</td>
          <td>${html(row.time)}</td>
          <td>${html(row.guideNumber)}</td>
          <td>${html(row.passenger)}</td>
          <td>${html(row.employeeId)}</td>
          <td>${html(row.description)}</td>
          <td>${html(row.origin)}</td>
          <td>${html(row.destination)}</td>
          <td>${html(row.fare)}</td>
          <td>${html(row.supervisor)}</td>
          <td>${html(row.status)}</td>
        </tr>
      `,
    )
    .join("");

  reportWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Relatorio da empresa ${reportMonth}</title>
        <style>
          * { box-sizing: border-box; }
          @page { margin: 10mm; size: A4 landscape; }
          body { margin: 0; color: #111827; background: #fff; font-family: Arial, Helvetica, sans-serif; }
          header { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          p { margin: 0; color: #4b5563; font-size: 12px; }
          .total { border: 1px solid #d1d5db; padding: 10px 12px; font-weight: 800; white-space: nowrap; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th, td { border: 1px solid #d1d5db; padding: 5px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; text-transform: uppercase; }
          td:nth-child(6) { width: 24%; }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Relatorio da empresa</h1>
            <p>Mes: ${html(reportMonth)} | Registros: ${rows.length} | Gerado em ${html(formatDate(new Date().toISOString().slice(0, 10)))}</p>
          </div>
          <div class="total">Total: ${html(formatBrazilMoney(total))}</div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Hora</th>
              <th>Guia</th>
              <th>Colaborador</th>
              <th>Matrícula</th>
              <th>Descrição da viagem</th>
              <th>Origem</th>
              <th>Destino</th>
              <th>Valor</th>
              <th>Solicitante</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${reportRows}</tbody>
        </table>
        <script>
          window.addEventListener("load", () => window.print());
        <\/script>
      </body>
    </html>
  `);
  reportWindow.document.close();
}

supervisorSelect.addEventListener("change", () => {
  const selected = supervisorSelect.options[supervisorSelect.selectedIndex];
  if (selected?.dataset.department) {
    form.elements.department.value = selected.dataset.department;
  }
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  const supervisor = getSupervisors().find((item) => item.id === data.get("loginSupervisor"));
  const password = clean(data.get("password"));

  if (!supervisor || String(supervisor.password || "1234") !== password) {
    showToast("Supervisor ou senha incorretos.");
    return;
  }

  saveSession({ supervisorId: supervisor.id });
  loginForm.reset();
  render();
  showToast(`Bem-vindo, ${supervisor.name}.`);
});

taxiLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(taxiLoginForm);
  const password = clean(data.get("taxiPassword"));

  if (password !== getSettings().taxiPassword) {
    showToast("Senha do taxista incorreta.");
    return;
  }

  saveTaxiSession();
  taxiLoginForm.reset();
  render();
  location.hash = "taxista";
  showToast("Área do taxista liberada.");
});

infoLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(infoLoginForm);
  const password = clean(data.get("infoPassword"));

  if (password !== getSettings().infoPassword) {
    showToast("Senha das informações incorreta.");
    return;
  }

  saveInfoSession();
  infoLoginForm.reset();
  render();
  location.hash = "informacoes";
  showToast("Área de informações liberada.");
});

companyLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(companyLoginForm);
  const password = clean(data.get("companyPassword"));

  if (!getCompanyPasswords().includes(password)) {
    showToast("Senha da empresa incorreta.");
    return;
  }

  saveCompanySession();
  companyLoginForm.reset();
  render();
  location.hash = "empresa";
  showToast("Área da empresa liberada.");
});

supervisorsLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(supervisorsLoginForm);
  const password = clean(data.get("supervisorsPassword"));

  if (password !== getSettings().supervisorsPassword) {
    showToast("Senha da aba Supervisores incorreta.");
    return;
  }

  saveSupervisorsAreaSession();
  supervisorsLoginForm.reset();
  render();
  location.hash = "supervisores";
  showToast("Aba Supervisores liberada.");
});

supervisorsAreaPasswordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isSupervisorsAreaLoggedIn()) {
    showToast("Entre na aba Supervisores para trocar esta senha.");
    return;
  }

  const data = new FormData(supervisorsAreaPasswordForm);
  const supervisorsPassword = clean(data.get("supervisorsPassword"));
  saveSettings({ supervisorsPassword });
  supervisorsAreaPasswordForm.reset();
  render();
  showToast("Senha da aba Supervisores atualizada.");
});

supervisorsResetPasswordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isSupervisorsAreaLoggedIn()) {
    showToast("Entre na aba Supervisores para redefinir senhas.");
    return;
  }

  const data = new FormData(supervisorsResetPasswordForm);
  const supervisorId = data.get("supervisorId");
  const password = clean(data.get("password"));
  const supervisors = getSupervisors().map((supervisor) =>
    supervisor.id === supervisorId ? { ...supervisor, password } : supervisor,
  );
  saveSupervisors(supervisors);
  supervisorsResetPasswordForm.reset();
  render();
  showToast("Senha do supervisor redefinida.");
});

passwordSettingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isInfoLoggedIn()) {
    showToast("Entre na Área de informações para trocar senhas.");
    return;
  }

  const data = new FormData(passwordSettingsForm);
  const taxiPassword = clean(data.get("taxiPassword"));
  const infoPassword = clean(data.get("infoPassword"));
  const changes = {};
  if (taxiPassword) changes.taxiPassword = taxiPassword;
  if (infoPassword) changes.infoPassword = infoPassword;

  if (!Object.keys(changes).length) {
    showToast("Digite pelo menos uma nova senha.");
    return;
  }

  saveSettings(changes);
  passwordSettingsForm.reset();
  render();
  showToast("Senhas atualizadas.");
});

supervisorPasswordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isInfoLoggedIn()) {
    showToast("Entre na Área de informações para trocar senhas.");
    return;
  }

  const data = new FormData(supervisorPasswordForm);
  const supervisorId = data.get("supervisorId");
  const password = clean(data.get("password"));
  const supervisors = getSupervisors().map((supervisor) =>
    supervisor.id === supervisorId ? { ...supervisor, password } : supervisor,
  );
  saveSupervisors(supervisors);
  supervisorPasswordForm.reset();
  render();
  showToast("Senha do supervisor atualizada.");
});

companyPasswordSettingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isCompanyLoggedIn()) {
    showToast("Entre na área da empresa para trocar senhas.");
    return;
  }

  const data = new FormData(companyPasswordSettingsForm);
  const companyPassword = clean(data.get("companyPassword"));
  const supervisorsPassword = clean(data.get("supervisorsPassword"));
  const changes = {};
  if (companyPassword) changes.companyPassword = companyPassword;
  if (supervisorsPassword) changes.supervisorsPassword = supervisorsPassword;

  if (!Object.keys(changes).length) {
    showToast("Digite pelo menos uma nova senha.");
    return;
  }

  saveSettings(changes);
  companyPasswordSettingsForm.reset();
  render();
  showToast("Senhas atualizadas pela área da empresa.");
});

companySupervisorPasswordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isCompanyLoggedIn()) {
    showToast("Entre na área da empresa para trocar senha de supervisor.");
    return;
  }

  const data = new FormData(companySupervisorPasswordForm);
  const supervisorId = data.get("supervisorId");
  const password = clean(data.get("password"));
  const supervisors = getSupervisors().map((supervisor) =>
    supervisor.id === supervisorId ? { ...supervisor, password } : supervisor,
  );
  saveSupervisors(supervisors);
  companySupervisorPasswordForm.reset();
  render();
  showToast("Senha do supervisor atualizada pela empresa.");
});

supervisorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isSupervisorsAreaLoggedIn()) {
    showToast("Entre na aba Supervisores para cadastrar.");
    return;
  }

  const data = new FormData(supervisorForm);
  const supervisor = {
    id: makeId("supervisor"),
    name: clean(data.get("name")),
    department: clean(data.get("department")),
    phone: clean(data.get("phone")) || "-",
    password: clean(data.get("password")) || "1234",
  };
  saveSupervisors([...getSupervisors(), supervisor]);
  supervisorForm.reset();
  render();
  showToast("Supervisor adicionado.");
});

companySupervisorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isCompanyLoggedIn()) {
    showToast("Entre na área da empresa para cadastrar supervisor.");
    return;
  }

  const data = new FormData(companySupervisorForm);
  const supervisor = {
    id: makeId("supervisor"),
    name: clean(data.get("name")),
    department: clean(data.get("department")),
    phone: clean(data.get("phone")) || "-",
    password: clean(data.get("password")) || "1234",
  };
  saveSupervisors([...getSupervisors(), supervisor]);
  companySupervisorForm.reset();
  render();
  showToast("Supervisor adicionado pela empresa.");
});

driverSupervisorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(driverSupervisorForm);
  const supervisor = {
    id: makeId("supervisor"),
    name: clean(data.get("name")),
    department: clean(data.get("department")),
    phone: clean(data.get("phone")) || "-",
    password: clean(data.get("password")) || "1234",
  };
  saveSupervisors([...getSupervisors(), supervisor]);
  driverSupervisorForm.reset();
  render();
  showToast("Supervisor adicionado na Área do taxista.");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const request = collectFormData();
  const requests = [request, ...getRequests()];
  saveRequests(requests);
  render();
  form.reset();
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  form.elements.time.value = new Date().toTimeString().slice(0, 5);
  applySupervisorSession();
  showToast("Solicitação salva. Use Minhas solicitações para imprimir, gerar PDF ou compartilhar.");
});

document.addEventListener("click", (event) => {
  const pdfButton = event.target.closest("[data-pdf]");
  const printButton = event.target.closest("[data-print]");
  const removeSupervisorButton = event.target.closest("[data-remove-supervisor]");
  const removeDriverButton = event.target.closest("[data-remove-driver]");
  const shareRequestButton = event.target.closest("[data-share-request]");
  const companyShareRequestButton = event.target.closest("[data-company-share-request]");
  const removeCompanyRequestButton = event.target.closest("[data-remove-company-request]");
  const driverShareRequestButton = event.target.closest("[data-share-driver-request]");
  const laterRequestButton = event.target.closest("[data-later-request]");
  const removeRequesterButton = event.target.closest("[data-remove-requester]");
  const cancelSupervisorButton = event.target.closest("[data-cancel-supervisor]");
  const cancelDriverButton = event.target.closest("[data-cancel-driver]");

  const logoutButton = event.target.closest("#logout-supervisor");
  const logoutTaxiButton = event.target.closest("#logout-taxi");
  const logoutInfoButton = event.target.closest("#logout-info");
  const logoutCompanyButton = event.target.closest("#logout-company");
  const logoutSupervisorsAreaButton = event.target.closest("#logout-supervisors-area");

  if (event.target.closest("#notification-close")) {
    hideAppNotification();
    return;
  }

  if (event.target.closest("#app-notification")) {
    hideAppNotification();
    location.hash = "taxista";
    return;
  }

  if (logoutButton) {
    clearSession();
    render();
    showToast("Supervisor saiu do sistema.");
    return;
  }

  if (logoutInfoButton) {
    clearInfoSession();
    location.hash = "acesso";
    render();
    showToast("Área de informações bloqueada.");
    return;
  }

  if (logoutSupervisorsAreaButton) {
    clearSupervisorsAreaSession();
    location.hash = "acesso";
    render();
    showToast("Aba Supervisores bloqueada.");
    return;
  }

  if (logoutCompanyButton) {
    clearCompanySession();
    location.hash = "acesso";
    render();
    showToast("Área da empresa bloqueada.");
    return;
  }

  if (logoutTaxiButton) {
    clearTaxiSession();
    location.hash = "acesso";
    render();
    showToast("Área do taxista bloqueada.");
    return;
  }

  if (pdfButton) {
    const request = getRequests().find((item) => item.id === pdfButton.dataset.pdf);
    if (pdfButton.dataset.copy === "requester" && !isOwnedByLoggedSupervisor(request) && !isCompanyLoggedIn()) {
      showToast("Esta solicitação não pertence ao supervisor conectado.");
      return;
    }
    if (request) {
      downloadGuide(request, pdfButton.dataset.copy || "both");
      showToast(`Autorização ${request.guideNumber} gerada novamente.`);
    }
    return;
  }

  if (printButton) {
    const request = getRequests().find((item) => item.id === printButton.dataset.print);
    if (printButton.dataset.copy === "requester" && !isOwnedByLoggedSupervisor(request) && !isCompanyLoggedIn()) {
      showToast("Esta solicitação não pertence ao supervisor conectado.");
      return;
    }
    if (request) printAuthorization(request, printButton.dataset.copy || "both");
    return;
  }

  if (companyShareRequestButton) {
    if (!isCompanyLoggedIn()) {
      showToast("Entre na área da empresa para compartilhar.");
      return;
    }

    const request = getRequests().find((item) => item.id === companyShareRequestButton.dataset.companyShareRequest);
    if (request) shareRequestPdf(request, "requester");
    return;
  }

  if (removeCompanyRequestButton) {
    if (!isCompanyLoggedIn()) {
      showToast("Entre na área da empresa para remover.");
      return;
    }

    const requests = getRequests();
    const request = requests.find((item) => item.id === removeCompanyRequestButton.dataset.removeCompanyRequest);
    if (!request) return;

    const confirmed = window.confirm(
      `Remover ${request.guideNumber} somente da área Empresa? Os dados continuarão guardados em Informações.`,
    );
    if (!confirmed) return;

    const removedAt = new Date().toISOString();
    saveRequests(requests.map((item) => (item.id === request.id ? { ...item, companyRemovedAt: removedAt } : item)));
    render();
    showToast(`${request.guideNumber} removida da área Empresa. Informações preservadas.`);
    return;
  }

  if (driverShareRequestButton) {
    if (!isTaxiLoggedIn()) {
      showToast("Entre na área do taxista para compartilhar o PDF.");
      return;
    }

    const request = getRequests().find((item) => item.id === driverShareRequestButton.dataset.shareDriverRequest);
    if (request) shareRequestPdf(request, "driver");
    return;
  }

  if (cancelSupervisorButton) {
    const request = getRequests().find((item) => item.id === cancelSupervisorButton.dataset.cancelSupervisor);
    if (!isOwnedByLoggedSupervisor(request)) {
      showToast("Esta solicitação não pertence ao supervisor conectado.");
      return;
    }

    if (isCompleted(request)) {
      showToast("Autorização concluída não pode ser cancelada pelo supervisor.");
      return;
    }

    cancelRequest(request, getLoggedSupervisor()?.name || "Supervisor");
    return;
  }

  if (cancelDriverButton) {
    if (!isTaxiLoggedIn()) {
      showToast("Entre na área do taxista para cancelar uma autorização.");
      return;
    }

    const request = getRequests().find((item) => item.id === cancelDriverButton.dataset.cancelDriver);
    if (request) cancelRequest(request, "Taxista");
    return;
  }

  if (shareRequestButton || laterRequestButton || removeRequesterButton) {
    const requestId =
      shareRequestButton?.dataset.shareRequest ||
      laterRequestButton?.dataset.laterRequest ||
      removeRequesterButton?.dataset.removeRequester;
    const requests = getRequests();
    const request = requests.find((item) => item.id === requestId);

    if (!isOwnedByLoggedSupervisor(request)) {
      showToast("Esta solicitação não pertence ao supervisor conectado.");
      return;
    }

    if (shareRequestButton) {
      shareRequestPdf(request, "requester");
      return;
    }

    if (laterRequestButton) {
      showToast(`${request.guideNumber} continua salva em Minhas solicitações.`);
      return;
    }

    const confirmed = window.confirm(
      `Excluir ${request.guideNumber} somente da sua lista? Os dados continuarão guardados em Informações.`,
    );
    if (!confirmed) return;

    const removedAt = new Date().toISOString();
    saveRequests(requests.map((item) => (item.id === request.id ? { ...item, supervisorRemovedAt: removedAt } : item)));
    render();
    showToast(`${request.guideNumber} removida da sua lista. Informações preservadas.`);
    return;
  }

  if (removeDriverButton) {
    if (!isTaxiLoggedIn()) {
      showToast("Entre na área do taxista para excluir uma autorização.");
      return;
    }

    const requests = getRequests();
    const request = requests.find((item) => item.id === removeDriverButton.dataset.removeDriver);
    if (!request) return;

    const confirmed = window.confirm(
      `Excluir ${request.guideNumber} da aba Taxista? Os dados continuarão guardados em Informações.`,
    );
    if (!confirmed) return;

    const removedAt = new Date().toISOString();
    saveRequests(requests.map((item) => (item.id === request.id ? { ...item, driverRemovedAt: removedAt } : item)));
    render();
    showToast(`${request.guideNumber} removida da aba Taxista. Informações preservadas.`);
    return;
  }

  if (removeSupervisorButton) {
    if (!isSupervisorsAreaLoggedIn()) {
      showToast("Entre na aba Supervisores para remover.");
      return;
    }

    const supervisors = getSupervisors().filter((item) => item.id !== removeSupervisorButton.dataset.removeSupervisor);
    saveSupervisors(supervisors);
    render();
    showToast("Supervisor removido.");
  }
});

document.addEventListener("submit", (event) => {
  const fareForm = event.target.closest("[data-fare-form]");
  if (!fareForm) return;

  event.preventDefault();
  if (!isTaxiLoggedIn()) {
    showToast("Entre com a senha do taxista para editar valor e KM.");
    return;
  }

  const data = new FormData(fareForm);
  const requests = getRequests();
  const currentRequest = requests.find((request) => request.id === fareForm.dataset.fareForm);
  if (isCancelled(currentRequest)) {
    showToast("Autorização cancelada não pode ser alterada.");
    return;
  }

  const updated = requests.map((request) => {
    if (request.id !== fareForm.dataset.fareForm) return request;
    return {
      ...request,
      fare: clean(data.get("fare")) || "R$ 0,00",
      kmStart: clean(data.get("kmStart")) || "-",
      kmEnd: clean(data.get("kmEnd")) || "-",
      driverDescription: clean(data.get("driverDescription")) || "-",
      status: "Concluída",
      completedAt: request.completedAt || new Date().toISOString(),
    };
  });

  saveRequests(updated);
  render();
  showToast("Valor e KM salvos. Status atualizado para Concluída.");
});

exportLastButton.addEventListener("click", () => {
  const [latest] = getRequests();
  if (!latest) {
    showToast("Nenhuma solicitação para gerar guia.");
    return;
  }
  downloadGuide(latest, "requester");
  showToast(`Autorização ${latest.guideNumber} gerada.`);
});

printLastButton.addEventListener("click", () => {
  const latest = getRequests().find((item) => !item.driverRemovedAt);
  if (!latest) {
    showToast("Nenhuma autorização para imprimir.");
    return;
  }
  printAuthorization(latest, "driver");
});

clearHistoryButton.addEventListener("click", () => {
  const requests = getRequests();
  const visibleHistory = requests.filter((item) => !item.historyRemovedAt);
  if (!visibleHistory.length) {
    showToast("O histórico já está vazio. As informações continuam guardadas.");
    return;
  }

  const confirmed = window.confirm(
    "Deseja limpar a aba Histórico? As viagens continuarão guardadas na aba Informações para pesquisas futuras.",
  );
  if (!confirmed) return;

  const removedAt = new Date().toISOString();
  saveRequests(requests.map((item) => (item.historyRemovedAt ? item : { ...item, historyRemovedAt: removedAt })));
  render();
  showToast("Histórico limpo. As informações das viagens foram preservadas.");
});

saveRateButton.addEventListener("click", () => {
  if (!isInfoLoggedIn()) {
    showToast("Entre na Área de informações para alterar o valor por KM.");
    return;
  }

  const rate = clean(kmRateInput.value) || DEFAULT_SETTINGS.kmRate;
  saveSettings({ kmRate: rate });
  render();
  showToast(`Valor por KM salvo: R$ ${rate}.`);
});

exportInfoPdfButton.addEventListener("click", printInfoReport);
exportCompanyPdfButton.addEventListener("click", printCompanyReport);

toggleInfoTotalButton.addEventListener("click", () => {
  isInfoTotalHidden = !isInfoTotalHidden;
  renderInfoTable();
});

infoMonthInput.addEventListener("change", renderInfoTable);
companyMonthInput.addEventListener("change", renderCompanyTable);

document.querySelectorAll("[data-info-filter]").forEach((input) => {
  input.addEventListener("input", renderInfoTable);
});

document.querySelectorAll("[data-company-filter]").forEach((input) => {
  input.addEventListener("input", renderCompanyTable);
});

function showScreenFromHash() {
  const availableScreens = [...document.querySelectorAll(".screen")];
  let targetId = (window.location.hash || "#solicitacao").replace("#", "");

  if (targetId === "historico" && !isInfoLoggedIn()) {
    targetId = "acesso";
    history.replaceState(null, "", "#acesso");
    showToast("Entre em Informações para acessar o histórico.");
  }

  const target = availableScreens.find((screen) => screen.id === targetId) || availableScreens[0];

  availableScreens.forEach((screen) => {
    screen.classList.toggle("is-active", screen === target);
  });

  document.querySelectorAll(".sidebar a, .mobile-nav a").forEach((link) => {
    const isCurrent = link.getAttribute("href") === `#${target.id}`;
    link.classList.toggle("is-active", isCurrent);
  });
}

window.addEventListener("hashchange", showScreenFromHash);
window.addEventListener("pointerdown", unlockNotificationSound, { once: true });
window.addEventListener("keydown", unlockNotificationSound, { once: true });
window.addEventListener("online", () => {
  firebaseInitPromise = null;
  connectRealtime();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installAppButton) installAppButton.hidden = false;
});

installAppButton?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installAppButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installAppButton) installAppButton.hidden = true;
});

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("/sw.js").catch((error) => {
    console.warn("Falha ao preparar a instalação do aplicativo", error);
  });
}

showScreenFromHash();
render();
loadRemoteState();
connectRealtime();
