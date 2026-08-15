"use strict";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(express.json({ limit: "1mb" }));
app.use(cors()); // разрешаем все origins

let sequence = [];
let sessions = {};
let lastGenerated = null;

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}
function requireAuth(req, res, next) {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  if (!token || !sessions[token]) return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
}

app.get("/", (req, res) => res.type("text/plain").send("OK"));
app.get("/api/test", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === "admin" && password === ADMIN_PASSWORD) {
    const token = makeToken();
    sessions[token] = { createdAt: Date.now() };
    return res.json({ ok: true, token });
  }
  return res.status(401).json({ ok: false, error: "Неверный логин или пароль" });
});

app.post("/api/admin/logout", requireAuth, (req, res) => {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  delete sessions[token];
  res.json({ ok: true });
});

app.get("/api/active", (req, res) => {
  res.json({ ok: true, value: lastGenerated });
});

app.post("/api/generate", (req, res) => {
  const pending = sequence.filter(x => !x.used);
  if (pending.length === 0) {
    return res.status(400).json({ ok: false, error: sequence.length === 0 ? "Серия не задана" : "Все числа использованы" });
  }
  const pick = pending[Math.floor(Math.random() * pending.length)];
  sequence = sequence.map(x => x.id === pick.id ? { ...x, used: true } : x);
  lastGenerated = pick.value;
  res.json({ ok: true, value: pick.value });
});

app.get("/api/sequence/stats", (req, res) => {
  res.json({
    ok: true,
    total: sequence.length,
    used: sequence.filter(x => x.used).length,
    remaining: sequence.filter(x => !x.used).length,
  });
});

app.get("/api/admin/sequence", requireAuth, (req, res) => {
  res.json({ ok: true, sequence });
});

app.post("/api/admin/sequence/add", requireAuth, (req, res) => {
  const { numbers } = req.body || {};
  if (!Array.isArray(numbers) || numbers.length === 0)
    return res.status(400).json({ ok: false, error: "numbers[] required" });
  let added = 0;
  for (const v of numbers) {
    const num = Number(v);
    if (isNaN(num)) continue;
    if (sequence.some(x => Number(x.value) === num && !x.used)) continue;
    sequence.push({ id: Date.now() + Math.random(), value: num, used: false });
    added++;
  }
  res.json({ ok: true, added });
});

app.delete("/api/admin/sequence/:id", requireAuth, (req, res) => {
  const before = sequence.length;
  sequence = sequence.filter(x => String(x.id) !== req.params.id);
  if (sequence.length === before) return res.status(404).json({ ok: false, error: "not found" });
  res.json({ ok: true });
});

app.post("/api/admin/sequence/reset", requireAuth, (req, res) => {
  sequence = sequence.map(x => ({ ...x, used: false }));
  lastGenerated = null;
  res.json({ ok: true });
});

app.delete("/api/admin/sequence", requireAuth, (req, res) => {
  sequence = [];
  lastGenerated = null;
  res.json({ ok: true });
});

app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));

app.listen(PORT, HOST, () => console.log(`Server started: http://${HOST}:${PORT}`));
