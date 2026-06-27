const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = __dirname;
const DB_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DB_DIR, "db.json");
const defaultSettings = {
  taxiPassword: "taxi123",
  infoPassword: "info123",
  supervisorsPassword: "super123",
  kmRate: "1,50",
};

const defaultSupervisors = [
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
].map((name, index) => ({
  id: `authorized-${index + 1}`,
  name,
  department: "LEVO Alimentos",
  phone: "-",
  password: "1234",
}));

const clients = new Set();

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ requests: [], supervisors: defaultSupervisors, settings: defaultSettings }, null, 2));
  }
}

function readDb() {
  ensureDb();
  const state = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return {
    requests: Array.isArray(state.requests) ? state.requests : [],
    supervisors: Array.isArray(state.supervisors) ? state.supervisors : defaultSupervisors,
    settings: { ...defaultSettings, ...(state.settings || {}) },
  };
}

function writeDb(nextState) {
  ensureDb();
  const current = readDb();
  const state = {
    requests: Array.isArray(nextState.requests) ? nextState.requests : current.requests,
    supervisors: Array.isArray(nextState.supervisors) ? nextState.supervisors : current.supervisors,
    settings: nextState.settings && typeof nextState.settings === "object" ? { ...current.settings, ...nextState.settings } : current.settings,
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
  broadcast(state);
  return state;
}

function broadcast(state) {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  clients.forEach((client) => client.write(payload));
}

function sendJson(response, data) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(JSON.stringify(data));
}

function collectBody(request, callback) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => callback(body));
}

function serveFile(request, response) {
  const urlPath = decodeURIComponent(request.url.split("?")[0]);
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(ROOT, safePath));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Acesso negado");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Arquivo nao encontrado");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".txt": "text/plain; charset=utf-8",
    };
    response.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    response.end();
    return;
  }

  if (request.url === "/api/state" && request.method === "GET") {
    sendJson(response, readDb());
    return;
  }

  if (request.url === "/api/state" && request.method === "POST") {
    collectBody(request, (body) => {
      try {
        const data = JSON.parse(body || "{}");
        sendJson(response, writeDb(data));
      } catch {
        response.writeHead(400);
        response.end("JSON invalido");
      }
    });
    return;
  }

  if (request.url === "/api/events" && request.method === "GET") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    clients.add(response);
    response.write(`data: ${JSON.stringify(readDb())}\n\n`);
    request.on("close", () => clients.delete(response));
    return;
  }

  serveFile(request, response);
});

ensureDb();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Guia Taxi rodando em http://localhost:${PORT}`);
  console.log("No celular, use o IP deste computador na mesma rede Wi-Fi.");
});
