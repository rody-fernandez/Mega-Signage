// server.js
// CMS + API + Player endpoints (MVP) - Local LAN
// Reqs: Node 18+
// Run: npm i && npm start

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use("/public", express.static(path.join(ROOT, "public")));
app.use("/media", express.static(UPLOAD_DIR));

// ---------- DB ----------
const db = new sqlite3.Database(path.join(ROOT, "signage.db"));
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      token TEXT UNIQUE,
      pairing_code TEXT,
      paired INTEGER DEFAULT 0,
      last_seen INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
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
      screen_id INTEGER,
      title TEXT,
      updated_at INTEGER,
      FOREIGN KEY(screen_id) REFERENCES screens(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER,
      media_id INTEGER,
      sort_order INTEGER,
      FOREIGN KEY(playlist_id) REFERENCES playlists(id),
      FOREIGN KEY(media_id) REFERENCES media(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS screen_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_token TEXT UNIQUE,
      screen_id INTEGER,
      FOREIGN KEY(screen_id) REFERENCES screens(id)
    )
  `);

  // Seed screens (C10/C11/C12) if not exist
  const seed = ["C10", "C11", "C12"];
  seed.forEach((s) => {
    db.run(`INSERT OR IGNORE INTO screens(name) VALUES (?)`, [s]);
  });
});

// ---------- Helpers ----------
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

// ---------- Upload ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Keep unique filename
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({ storage });

// ---------- Admin UI ----------
app.get("/", (req, res) => {
  res.redirect("/public/admin.html");
});

// ---------- API: Admin ----------
app.get("/api/screens", (req, res) => {
  db.all(`SELECT * FROM screens ORDER BY name`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/players", (req, res) => {
  db.all(
    `SELECT id, name, token, pairing_code, paired, last_seen FROM players ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/media/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  db.run(
    `INSERT INTO media(filename, original_name, size, created_at) VALUES (?, ?, ?, ?)`,
    [req.file.filename, req.file.originalname, req.file.size, now()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, media_id: this.lastID, filename: req.file.filename });
    }
  );
});

app.get("/api/media", (req, res) => {
  db.all(`SELECT * FROM media ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // build URL
    const out = rows.map((r) => ({
      ...r,
      url: `/media/${r.filename}`
    }));
    res.json(out);
  });
});

app.get("/api/playlist/:screenName", (req, res) => {
  const screenName = req.params.screenName;
  db.get(`SELECT id, name FROM screens WHERE name = ?`, [screenName], (err, screen) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!screen) return res.status(404).json({ error: "Screen not found" });

    db.get(
      `SELECT * FROM playlists WHERE screen_id = ? ORDER BY updated_at DESC LIMIT 1`,
      [screen.id],
      (err2, pl) => {
        if (err2) return res.status(500).json({ error: err2.message });
        if (!pl) return res.json({ screen: screenName, playlist: null, items: [] });

        db.all(
          `
          SELECT pi.sort_order, m.id as media_id, m.original_name, m.filename
          FROM playlist_items pi
          JOIN media m ON m.id = pi.media_id
          WHERE pi.playlist_id = ?
          ORDER BY pi.sort_order ASC
          `,
          [pl.id],
          (err3, items) => {
            if (err3) return res.status(500).json({ error: err3.message });
            const out = items.map((it) => ({
              sort_order: it.sort_order,
              media_id: it.media_id,
              name: it.original_name,
              url: `/media/${it.filename}`
            }));
            res.json({ screen: screenName, playlist: { id: pl.id, title: pl.title, updated_at: pl.updated_at }, items: out });
          }
        );
      }
    );
  });
});

app.post("/api/playlist/:screenName", (req, res) => {
  // body: { title: string, media_ids: number[] }
  const screenName = req.params.screenName;
  const { title, media_ids } = req.body;

  if (!Array.isArray(media_ids) || media_ids.length === 0) {
    return res.status(400).json({ error: "media_ids must be a non-empty array" });
  }

  db.get(`SELECT id FROM screens WHERE name = ?`, [screenName], (err, screen) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!screen) return res.status(404).json({ error: "Screen not found" });

    const updatedAt = now();
    db.run(
      `INSERT INTO playlists(screen_id, title, updated_at) VALUES (?, ?, ?)`,
      [screen.id, title || `Playlist ${screenName}`, updatedAt],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        const playlistId = this.lastID;

        const stmt = db.prepare(`INSERT INTO playlist_items(playlist_id, media_id, sort_order) VALUES (?, ?, ?)`);
        media_ids.forEach((mid, idx) => stmt.run([playlistId, mid, idx + 1]));
        stmt.finalize((err3) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ ok: true, playlist_id: playlistId, updated_at: updatedAt });
        });
      }
    );
  });
});

// ---------- API: Player registration & assignment ----------
app.post("/api/player/register", (req, res) => {
  // Called by player on first boot
  const pairing_code = randCode(6);
  const token = randToken();
  const name = req.body?.name || null;

  db.run(
    `INSERT INTO players(name, token, pairing_code, paired, last_seen) VALUES (?, ?, ?, 0, ?)`,
    [name, token, pairing_code, now()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, token, pairing_code });
    }
  );
});

app.post("/api/player/pair", (req, res) => {
  // Admin pairs player using pairing code -> assigns screen
  const { pairing_code, screen_name } = req.body;
  if (!pairing_code || !screen_name) return res.status(400).json({ error: "pairing_code and screen_name are required" });

  db.get(`SELECT id FROM screens WHERE name = ?`, [screen_name], (err, screen) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!screen) return res.status(404).json({ error: "Screen not found" });

    db.get(`SELECT token FROM players WHERE pairing_code = ?`, [pairing_code], (err2, player) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (!player) return res.status(404).json({ error: "Pairing code not found" });

      const token = player.token;
      db.run(`UPDATE players SET paired = 1 WHERE token = ?`, [token], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message });

        db.run(
          `INSERT INTO screen_assignments(player_token, screen_id) VALUES (?, ?)
           ON CONFLICT(player_token) DO UPDATE SET screen_id = excluded.screen_id`,
          [token, screen.id],
          (err4) => {
            if (err4) return res.status(500).json({ error: err4.message });
            res.json({ ok: true, token, screen_name });
          }
        );
      });
    });
  });
});

app.post("/api/player/heartbeat", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  db.run(`UPDATE players SET last_seen = ? WHERE token = ?`, [now(), token], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "token not found" });
    res.json({ ok: true });
  });
});

app.get("/api/player/config", (req, res) => {
  // Player polls to know assigned screen and playlist
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: "token required" });

  db.get(
    `
    SELECT p.paired, sa.screen_id, s.name as screen_name
    FROM players p
    LEFT JOIN screen_assignments sa ON sa.player_token = p.token
    LEFT JOIN screens s ON s.id = sa.screen_id
    WHERE p.token = ?
    `,
    [token],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "token not found" });

      if (!row.paired || !row.screen_id) {
        return res.json({ paired: false, screen: null, playlist: null, items: [] });
      }

      // Return latest playlist for that screen
      db.get(
        `SELECT * FROM playlists WHERE screen_id = ? ORDER BY updated_at DESC LIMIT 1`,
        [row.screen_id],
        (err2, pl) => {
          if (err2) return res.status(500).json({ error: err2.message });
          if (!pl) return res.json({ paired: true, screen: row.screen_name, playlist: null, items: [] });

          db.all(
            `
            SELECT pi.sort_order, m.id as media_id, m.original_name, m.filename
            FROM playlist_items pi
            JOIN media m ON m.id = pi.media_id
            WHERE pi.playlist_id = ?
            ORDER BY pi.sort_order ASC
            `,
            [pl.id],
            (err3, items) => {
              if (err3) return res.status(500).json({ error: err3.message });
              const out = items.map((it) => ({
                sort_order: it.sort_order,
                media_id: it.media_id,
                name: it.original_name,
                url: `/media/${it.filename}`
              }));
              res.json({
                paired: true,
                screen: row.screen_name,
                playlist: { id: pl.id, title: pl.title, updated_at: pl.updated_at },
                items: out
              });
            }
          );
        }
      );
    }
  );
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Mega Signage MVP running on http://0.0.0.0:${PORT}`);
  console.log(`Admin panel: http://<IP-DE-TU-PC>:${PORT}/public/admin.html`);
  console.log(`Player page: http://<IP-DE-TU-PC>:${PORT}/public/player.html`);
});