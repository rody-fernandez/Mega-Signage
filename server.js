const express = require("express");
const multer = require("multer");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// folders
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/media", express.static(UPLOAD_DIR));

// DB
const db = new sqlite3.Database("signage.db");

function now() {
  return Math.floor(Date.now() / 1000);
}
function randCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10);
  return out;
}
function randToken() {
  return "t_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      floor TEXT,          -- "P1" o "PB"
      width_px INTEGER,
      height_px INTEGER,
      fit TEXT DEFAULT 'contain', -- contain/cover
      orientation TEXT DEFAULT 'vertical', -- vertical/horizontal
      active_playlist_id INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      token TEXT UNIQUE,
      pairing_code TEXT,
      paired INTEGER DEFAULT 0,
      screen_name TEXT,
      last_seen INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      original_name TEXT,
      size INTEGER,
      created_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      screen_name TEXT,     -- a qué pantalla pertenece
      media_ids TEXT,       -- JSON array
      updated_at INTEGER
    )
  `);

  // Seed screens: C1..C6 (P1) y C10..C12 (PB)
  const seeds = [
    { name: "C1", floor: "P1" },
    { name: "C2", floor: "P1" },
    { name: "C3", floor: "P1" },
    { name: "C4", floor: "P1" },
    { name: "C5", floor: "P1" },
    { name: "C6", floor: "P1" },
    { name: "C10", floor: "PB" },
    { name: "C11", floor: "PB" },
    { name: "C12", floor: "PB" }
  ];

  // defaults de resolución: dejalo 0/0 y lo editás en panel
  seeds.forEach(s => {
    db.run(
      `INSERT OR IGNORE INTO screens(name, floor, width_px, height_px) VALUES (?,?,0,0)`,
      [s.name, s.floor]
    );
  });
});

// Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({ storage });

// Home
app.get("/", (req, res) => res.redirect("/public/admin.html"));

// ---------- API: Screens ----------
app.get("/api/screens", (req, res) => {
  db.all(`SELECT * FROM screens ORDER BY floor, name`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/screens/update", (req, res) => {
  const { name, floor, width_px, height_px, fit, orientation } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  db.run(
    `UPDATE screens
     SET floor = COALESCE(?, floor),
         width_px = COALESCE(?, width_px),
         height_px = COALESCE(?, height_px),
         fit = COALESCE(?, fit),
         orientation = COALESCE(?, orientation)
     WHERE name = ?`,
    [floor ?? null, width_px ?? null, height_px ?? null, fit ?? null, orientation ?? null, name],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, changes: this.changes });
    }
  );
});

// ---------- API: Media ----------
app.post("/api/media/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  db.run(
    `INSERT INTO media(filename, original_name, size, created_at) VALUES (?,?,?,?)`,
    [req.file.filename, req.file.originalname, req.file.size, now()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id: this.lastID });
    }
  );
});

app.get("/api/media", (req, res) => {
  db.all(`SELECT * FROM media ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, url: `/media/${r.filename}` })));
  });
});

// ---------- API: Playlists ----------
app.post("/api/playlists/create", (req, res) => {
  const { name, screen_name, media_ids } = req.body;
  if (!name || !screen_name || !Array.isArray(media_ids) || media_ids.length === 0) {
    return res.status(400).json({ error: "name, screen_name, media_ids[] required" });
  }

  db.run(
    `INSERT INTO playlists(name, screen_name, media_ids, updated_at) VALUES (?,?,?,?)`,
    [name, screen_name, JSON.stringify(media_ids), now()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, playlist_id: this.lastID });
    }
  );
});

app.get("/api/playlists/:screen", (req, res) => {
  const screen = req.params.screen;
  db.all(
    `SELECT * FROM playlists WHERE screen_name=? ORDER BY updated_at DESC`,
    [screen],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => ({ ...r, media_ids: JSON.parse(r.media_ids || "[]") })));
    }
  );
});

app.post("/api/playlists/activate", (req, res) => {
  const { screen_name, playlist_id } = req.body;
  if (!screen_name || !playlist_id) return res.status(400).json({ error: "screen_name and playlist_id required" });

  db.run(
    `UPDATE screens SET active_playlist_id=? WHERE name=?`,
    [playlist_id, screen_name],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

// ---------- API: Players ----------
app.get("/api/players", (req, res) => {
  db.all(
    `SELECT id, name, token, pairing_code, paired, screen_name, last_seen FROM players ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/player/register", (req, res) => {
  const pairing_code = randCode(6);
  const token = randToken();
  const name = req.body?.name || "Player";

  db.run(
    `INSERT INTO players(name, token, pairing_code, paired, last_seen) VALUES (?,?,?,?,?)`,
    [name, token, pairing_code, 0, now()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, token, pairing_code });
    }
  );
});

app.post("/api/player/pair", (req, res) => {
  const { pairing_code, screen_name } = req.body;
  if (!pairing_code || !screen_name) return res.status(400).json({ error: "pairing_code and screen_name required" });

  db.run(
    `UPDATE players SET paired=1, screen_name=? WHERE pairing_code=?`,
    [screen_name, pairing_code],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "pairing_code not found" });
      res.json({ ok: true });
    }
  );
});

app.post("/api/player/heartbeat", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  db.run(`UPDATE players SET last_seen=? WHERE token=?`, [now(), token], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

app.get("/api/player/config", (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: "token required" });

  db.get(
    `SELECT paired, screen_name FROM players WHERE token=?`,
    [token],
    (err, p) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!p) return res.status(404).json({ error: "token not found" });
      if (!p.paired || !p.screen_name) return res.json({ paired: false });

      db.get(`SELECT * FROM screens WHERE name=?`, [p.screen_name], (err2, s) => {
        if (err2) return res.status(500).json({ error: err2.message });
        if (!s) return res.json({ paired: false });

        if (!s.active_playlist_id) {
          return res.json({
            paired: true,
            screen: s.name,
            screen_cfg: {
              width_px: s.width_px, height_px: s.height_px,
              fit: s.fit, orientation: s.orientation
            },
            playlist: null,
            items: []
          });
        }

        db.get(`SELECT * FROM playlists WHERE id=?`, [s.active_playlist_id], (err3, pl) => {
          if (err3) return res.status(500).json({ error: err3.message });
          if (!pl) return res.json({ paired: true, screen: s.name, playlist: null, items: [] });

          const mids = JSON.parse(pl.media_ids || "[]");
          if (!mids.length) return res.json({ paired: true, screen: s.name, playlist: null, items: [] });

          const placeholders = mids.map(() => "?").join(",");
          db.all(
            `SELECT id, filename, original_name FROM media WHERE id IN (${placeholders})`,
            mids,
            (err4, rows) => {
              if (err4) return res.status(500).json({ error: err4.message });
              // mantener orden según mids
              const map = new Map(rows.map(r => [r.id, r]));
              const items = mids.map(id => map.get(id)).filter(Boolean).map(r => ({
                id: r.id,
                name: r.original_name,
                url: `/media/${r.filename}`
              }));

              res.json({
                paired: true,
                screen: s.name,
                screen_cfg: {
                  width_px: s.width_px, height_px: s.height_px,
                  fit: s.fit, orientation: s.orientation
                },
                playlist: { id: pl.id, name: pl.name, updated_at: pl.updated_at },
                items
              });
            }
          );
        });
      });
    }
  );
});

// ---------- Sync Play ----------
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// token -> ws
const wsClients = new Map();

wss.on("connection", (ws) => {
  ws.on("message", (buf) => {
    try {
      const msg = JSON.parse(buf.toString());
      if (msg.type === "HELLO" && msg.token) {
        wsClients.set(msg.token, ws);
        ws.send(JSON.stringify({ type: "HELLO_OK" }));
      }
    } catch {}
  });

  ws.on("close", () => {
    for (const [k, v] of wsClients.entries()) {
      if (v === ws) wsClients.delete(k);
    }
  });
});

function broadcastToTokens(tokens, payload) {
  for (const t of tokens) {
    const ws = wsClients.get(t);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }
}

app.post("/api/sync/play", (req, res) => {
  // body: { scope: "ALL" | "P1" | "PB" }
  const scope = (req.body?.scope || "ALL").toUpperCase();
  const startAtMs = Date.now() + 1500; // 1.5s para que todos preparen

  // seleccionar players del scope
  const sql = `
    SELECT p.token
    FROM players p
    JOIN screens s ON s.name = p.screen_name
    WHERE p.paired=1
      AND (? = 'ALL' OR s.floor = ?)
  `;

  db.all(sql, [scope, scope], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const tokens = rows.map(r => r.token);
    broadcastToTokens(tokens, { type: "SYNC_PLAY", startAtMs });

    res.json({ ok: true, scope, startAtMs, targets: tokens.length });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Mega Signage V2: http://0.0.0.0:${PORT}/public/admin.html`);
  console.log(`Player: http://<IP>:${PORT}/public/player.html`);
});