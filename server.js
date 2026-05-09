"use strict";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = "0.0.0.0";
const CLIENT_URL = process.env.CLIENT_URL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SECRET = process.env.SESSION_SECRET || "randstuff-secret-key-change-me";

app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin: CLIENT_URL ? [CLIENT_URL] : true,
  credentials: true,
}));

// --- In-memory state ---
// sequence: array of { id, value, used }
let sequence = [];
let sessions = {}; // token -> { createdAt }

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}
function requireAuth(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token || !sessions[token]) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// --- Health ---
app.get("/", (req, res) => res.type("text/plain").send("OK"));
app.get("/api/test", (req, res) => res.json({ ok: true, service: "randstuff-backend", time: new Date().toISOString() }));

// --- Auth ---
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

// --- User: get active number (last generated) ---
let lastGenerated = null;
app.get("/api/active", (req, res) => {
  res.json({ ok: true, value: lastGenerated });
});

// --- User: generate next number ---
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

// --- User: get sequence stats (without values) ---
app.get("/api/sequence/stats", (req, res) => {
  res.json({
    ok: true,
    total: sequence.length,
    used: sequence.filter(x => x.used).length,
    remaining: sequence.filter(x => !x.used).length,
  });
});

// --- Admin: get full sequence ---
app.get("/api/admin/sequence", requireAuth, (req, res) => {
  res.json({ ok: true, sequence });
});

// --- Admin: add numbers ---
app.post("/api/admin/sequence/add", requireAuth, (req, res) => {
  const { numbers } = req.body || {};
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ ok: false, error: "numbers[] required" });
  }
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

// --- Admin: delete one item ---
app.delete("/api/admin/sequence/:id", requireAuth, (req, res) => {
  const before = sequence.length;
  sequence = sequence.filter(x => String(x.id) !== req.params.id);
  if (sequence.length === before) return res.status(404).json({ ok: false, error: "not found" });
  res.json({ ok: true });
});

// --- Admin: reset (mark all unused) ---
app.post("/api/admin/sequence/reset", requireAuth, (req, res) => {
  sequence = sequence.map(x => ({ ...x, used: false }));
  lastGenerated = null;
  res.json({ ok: true });
});

// --- Admin: clear all ---
app.delete("/api/admin/sequence", requireAuth, (req, res) => {
  sequence = [];
  lastGenerated = null;
  res.json({ ok: true });
});

// --- 404 ---
app.use((req, res) => res.status(404).json({ ok: false, error: "Route not found" }));

app.listen(PORT, HOST, () => console.log(`Server started: http://${HOST}:${PORT}`));
