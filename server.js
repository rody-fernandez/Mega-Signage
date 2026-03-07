const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3000;

// ==========================
// CONFIG
// ==========================
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DB_PATH = path.join(ROOT, "mega-signage.db");

// estado global de sincronización
let syncState = {
  startAt: 0,
  scope: "ALL",
  issuedAt: 0,
  seq: 0
};

// ==========================
// MIDDLEWARES
// ==========================
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use("/public", express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/", (req, res) => {
  res.redirect("/public/admin.html");
});

// ==========================
// DB
// ==========================
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function nowMs() {
  return Date.now();
}

function makeToken() {
  return "t_" + crypto.randomBytes(16).toString("hex");
}

function makePairCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isOnline(lastSeen) {
  if (!lastSeen) return false;
  return nowMs() - lastSeen <= 15000;
}

async function columnExists(table, column) {
  const rows = await all(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      pairing_code TEXT NOT NULL UNIQUE,
      screen_id INTEGER,
      paired_at INTEGER,
      last_seen INTEGER DEFAULT 0
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      floor TEXT DEFAULT '',
      width_px INTEGER DEFAULT 0,
      height_px INTEGER DEFAULT 0
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screen_name TEXT NOT NULL,
      name TEXT NOT NULL,
      media_ids TEXT NOT NULL,
      active INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  if (!(await columnExists("screens", "orientation"))) {
    await run(`ALTER TABLE screens ADD COLUMN orientation TEXT DEFAULT 'vertical'`);
  }

  if (!(await columnExists("screens", "fit"))) {
    await run(`ALTER TABLE screens ADD COLUMN fit TEXT DEFAULT 'contain'`);
  }

  if (!(await columnExists("screens", "x_offset"))) {
    await run(`ALTER TABLE screens ADD COLUMN x_offset INTEGER DEFAULT 0`);
  }

  if (!(await columnExists("screens", "y_offset"))) {
    await run(`ALTER TABLE screens ADD COLUMN y_offset INTEGER DEFAULT 0`);
  }

  const defaultScreens = [
    ["C1", "P1", 128, 512, "vertical", "contain", 0, 0],
    ["C2", "P1", 192, 512, "vertical", "contain", 128, 0],
    ["C3", "P1", 256, 512, "vertical", "contain", 320, 0],
    ["C4", "P1", 128, 512, "vertical", "contain", 576, 0],
    ["C5", "P1", 128, 512, "vertical", "contain", 704, 0],
    ["C6", "P1", 320, 480, "vertical", "contain", 0, 0],
    ["C10", "PB", 704, 512, "vertical", "contain", 0, 0],
    ["C11", "PB", 192, 512, "vertical", "contain", 0, 0],
    ["C12", "PB", 256, 512, "vertical", "contain", 0, 0]
  ];

  for (const [name, floor, width_px, height_px, orientation, fit, x_offset, y_offset] of defaultScreens) {
    await run(
      `
      INSERT OR IGNORE INTO screens
      (name, floor, width_px, height_px, orientation, fit, x_offset, y_offset)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [name, floor, width_px, height_px, orientation, fit, x_offset, y_offset]
    );
  }

  console.log(`DB OK: ${DB_PATH}`);
}

initDb().catch((e) => {
  console.error("DB init error:", e);
});

// ==========================
// UPLOADS
// ==========================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const fname = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, fname);
  }
});

const upload = multer({ storage });

// ==========================
// API - SCREENS
// ==========================
app.get("/api/screens", async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM screens ORDER BY name ASC`);
    return res.json(rows);
  } catch (e) {
    console.error("screens error:", e);
    return res.status(500).json([]);
  }
});

app.post("/api/screens/update", async (req, res) => {
  try {
    let name = String(req.body?.name || "").trim();

    if (name.includes("-")) {
      const parts = name.split("-");
      name = parts[parts.length - 1].trim();
    }

    const floor = String(req.body?.floor || "").trim();
    const width_px = Number(req.body?.width_px || 0);
    const height_px = Number(req.body?.height_px || 0);
    const orientation = String(req.body?.orientation || "vertical").trim();
    const fit = String(req.body?.fit || "contain").trim();
    const x_offset = Number(req.body?.x_offset || 0);
    const y_offset = Number(req.body?.y_offset || 0);

    if (!name) {
      return res.status(400).json({ ok: false, error: "missing name" });
    }

    const r = await run(
      `
      UPDATE screens
      SET floor = ?, width_px = ?, height_px = ?, orientation = ?, fit = ?, x_offset = ?, y_offset = ?
      WHERE name = ?
      `,
      [floor, width_px, height_px, orientation, fit, x_offset, y_offset, name]
    );

    if (!r.changes) {
      return res.status(404).json({ ok: false, error: "screen not found" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("screens update error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// ==========================
// API - MEDIA
// ==========================
app.post("/api/media/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "missing file" });
    }

    await run(
      `
      INSERT INTO media (filename, original_name, mime, size, created_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        req.file.filename,
        req.file.originalname,
        req.file.mimetype || "application/octet-stream",
        req.file.size || 0,
        nowMs()
      ]
    );

    return res.json({ ok: true, filename: req.file.filename });
  } catch (e) {
    console.error("upload error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/api/media", async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM media ORDER BY id DESC`);
    const media = rows.map((m) => ({
      id: m.id,
      filename: m.filename,
      original_name: m.original_name,
      size: m.size || 0,
      url: `/uploads/${m.filename}`
    }));
    return res.json(media);
  } catch (e) {
    console.error("media error:", e);
    return res.status(500).json([]);
  }
});

// ==========================
// API - PLAYLISTS
// ==========================
app.post("/api/playlists/create", async (req, res) => {
  try {
    let screen_name = String(req.body?.screen_name || "").trim();

    if (screen_name.includes("-")) {
      const parts = screen_name.split("-");
      screen_name = parts[parts.length - 1].trim();
    }

    const name = String(req.body?.name || "").trim();
    const media_ids = Array.isArray(req.body?.media_ids) ? req.body.media_ids : [];

    if (!screen_name) {
      return res.status(400).json({ ok: false, error: "missing screen_name" });
    }

    if (!name) {
      return res.status(400).json({ ok: false, error: "missing name" });
    }

    await run(
      `
      INSERT INTO playlists (screen_name, name, media_ids, active, created_at)
      VALUES (?, ?, ?, 0, ?)
      `,
      [screen_name, name, JSON.stringify(media_ids), nowMs()]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("playlist create error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/api/playlists/:screen", async (req, res) => {
  try {
    let screen = String(req.params.screen || "").trim();

    if (screen.includes("-")) {
      const parts = screen.split("-");
      screen = parts[parts.length - 1].trim();
    }

    const rows = await all(
      `SELECT * FROM playlists WHERE screen_name = ? ORDER BY id DESC`,
      [screen]
    );

    const playlists = rows.map((p) => ({
      id: p.id,
      name: p.name,
      screen_name: p.screen_name,
      media_ids: JSON.parse(p.media_ids || "[]"),
      active: p.active
    }));

    return res.json(playlists);
  } catch (e) {
    console.error("playlists list error:", e);
    return res.status(500).json([]);
  }
});

app.post("/api/playlists/activate", async (req, res) => {
  try {
    let screen_name = String(req.body?.screen_name || "").trim();

    if (screen_name.includes("-")) {
      const parts = screen_name.split("-");
      screen_name = parts[parts.length - 1].trim();
    }

    const playlist_id = Number(req.body?.playlist_id || 0);

    if (!screen_name || !playlist_id) {
      return res.status(400).json({ ok: false, error: "missing data" });
    }

    await run(`UPDATE playlists SET active = 0 WHERE screen_name = ?`, [screen_name]);
    await run(`UPDATE playlists SET active = 1 WHERE id = ?`, [playlist_id]);

    return res.json({ ok: true });
  } catch (e) {
    console.error("playlist activate error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// ==========================
// API - PLAYER
// ==========================
app.post("/api/player/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "ANDROID-BOX").trim();
    const token = makeToken();
    const pairing_code = makePairCode();

    await run(
      `
      INSERT INTO players (name, token, pairing_code, last_seen)
      VALUES (?, ?, ?, ?)
      `,
      [name, token, pairing_code, nowMs()]
    );

    return res.json({
      ok: true,
      token,
      pairing_code
    });
  } catch (e) {
    console.error("register error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/api/player/heartbeat", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();

    if (!token) {
      return res.status(400).json({ ok: false, error: "missing token" });
    }

    const r = await run(
      `UPDATE players SET last_seen = ? WHERE token = ?`,
      [nowMs(), token]
    );

    if (!r.changes) {
      return res.status(404).json({ ok: false, error: "unknown token" });
    }

    return res.json({ ok: true, ts: nowMs() });
  } catch (e) {
    console.error("heartbeat error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/api/player/pair", async (req, res) => {
  try {
    const pairing_code = String(
      req.body?.pairing_code ||
      req.body?.code ||
      req.body?.pairCode ||
      ""
    ).trim();

    let screen_name = String(
      req.body?.screen ||
      req.body?.screen_name ||
      req.body?.screenName ||
      req.body?.pantalla ||
      ""
    ).trim();

    if (screen_name.includes("-")) {
      const parts = screen_name.split("-");
      screen_name = parts[parts.length - 1].trim();
    }

    if (!pairing_code) {
      return res.status(400).json({ ok: false, error: "missing pairing_code" });
    }

    if (!screen_name) {
      return res.status(400).json({ ok: false, error: "missing screen" });
    }

    const screen = await get(
      `SELECT id, name FROM screens WHERE name = ?`,
      [screen_name]
    );

    if (!screen) {
      return res.status(404).json({
        ok: false,
        error: `screen not found: ${screen_name}`
      });
    }

    const r = await run(
      `UPDATE players
       SET screen_id = ?, paired_at = ?, last_seen = ?
       WHERE pairing_code = ?`,
      [screen.id, nowMs(), nowMs(), pairing_code]
    );

    if (!r.changes) {
      return res.status(404).json({
        ok: false,
        error: "pairing_code not found"
      });
    }

    return res.json({
      ok: true,
      pairing_code,
      screen: screen.name
    });
  } catch (e) {
    console.error("pair error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/api/player/config", async (req, res) => {
  try {
    const token = String(req.query?.token || "").trim();

    if (!token) {
      return res.status(400).json({ ok: false, error: "missing token" });
    }

    const p = await get(`SELECT * FROM players WHERE token = ?`, [token]);

    if (!p) {
      return res.status(404).json({ ok: false, error: "unknown token" });
    }

    await run(
      `UPDATE players SET last_seen = ? WHERE token = ?`,
      [nowMs(), token]
    );

    if (!p.screen_id) {
      return res.json({
        ok: true,
        paired: false,
        pairing_code: p.pairing_code,
        sync: {
          startAt: syncState.startAt || 0,
          seq: syncState.seq || 0,
          scope: syncState.scope || "ALL"
        }
      });
    }

    const screen = await get(`SELECT * FROM screens WHERE id = ?`, [p.screen_id]);

    if (!screen) {
      return res.json({
        ok: true,
        paired: false,
        pairing_code: p.pairing_code,
        sync: {
          startAt: syncState.startAt || 0,
          seq: syncState.seq || 0,
          scope: syncState.scope || "ALL"
        }
      });
    }

    const activePlaylist = await get(
      `SELECT * FROM playlists
       WHERE screen_name = ? AND active = 1
       ORDER BY id DESC
       LIMIT 1`,
      [screen.name]
    );

    let items = [];
    let playlistName = null;
    let playlistVersion = 0;

    if (activePlaylist) {
      playlistName = activePlaylist.name;
      playlistVersion = activePlaylist.id;

      const mediaIds = JSON.parse(activePlaylist.media_ids || "[]");

      if (Array.isArray(mediaIds) && mediaIds.length > 0) {
        const placeholders = mediaIds.map(() => "?").join(",");
        const mediaRows = await all(
          `SELECT * FROM media WHERE id IN (${placeholders})`,
          mediaIds
        );

        const mediaMap = {};
        for (const m of mediaRows) {
          mediaMap[m.id] = m;
        }

        items = mediaIds
          .map((id) => mediaMap[id])
          .filter(Boolean)
          .map((m) => ({
            id: m.id,
            name: m.original_name,
            url: `/uploads/${m.filename}`
          }));
      }
    }

    return res.json({
      ok: true,
      paired: true,
      screen: screen.name,
      screen_cfg: {
        width_px: screen.width_px,
        height_px: screen.height_px,
        fit: screen.fit || "contain",
        orientation: screen.orientation || "vertical",
        x_offset: screen.x_offset || 0,
        y_offset: screen.y_offset || 0
      },
      playlist: playlistName ? { name: playlistName, version: playlistVersion } : null,
      playlist_version: playlistVersion,
      sync: {
        startAt: syncState.startAt || 0,
        seq: syncState.seq || 0,
        scope: syncState.scope || "ALL"
      },
      items
    });
  } catch (e) {
    console.error("player config error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// ==========================
// API - PLAYERS LIST
// ==========================
app.get("/api/players", async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT
        p.id,
        p.name,
        p.token,
        p.pairing_code,
        p.screen_id,
        p.paired_at,
        p.last_seen,
        s.name as screen_name
      FROM players p
      LEFT JOIN screens s ON s.id = p.screen_id
      ORDER BY p.id DESC
      `
    );

    const players = rows.map((p) => ({
      id: p.id,
      name: p.name || "Player",
      code: p.pairing_code,
      pairing_code: p.pairing_code,
      screen: p.screen_name || "-",
      screen_name: p.screen_name || "-",
      online: isOnline(p.last_seen),
      offline_seconds: p.last_seen
        ? Math.floor((nowMs() - p.last_seen) / 1000)
        : 99999
    }));

    return res.json(players);
  } catch (e) {
    console.error("players list error:", e);
    return res.status(500).json([]);
  }
});

// ==========================
// API - SYNC
// ==========================
app.post("/api/sync/play", async (req, res) => {
  try {
    const scope = String(req.body?.scope || "ALL").trim();

    let targets = 0;

    if (scope === "P1") {
      const rows = await all(
        `SELECT COUNT(*) as c
         FROM players p
         LEFT JOIN screens s ON s.id = p.screen_id
         WHERE s.floor = 'P1'`
      );
      targets = rows[0]?.c || 0;
    } else if (scope === "PB") {
      const rows = await all(
        `SELECT COUNT(*) as c
         FROM players p
         LEFT JOIN screens s ON s.id = p.screen_id
         WHERE s.floor = 'PB'`
      );
      targets = rows[0]?.c || 0;
    } else {
      const rows = await all(`SELECT COUNT(*) as c FROM players`);
      targets = rows[0]?.c || 0;
    }

    syncState = {
      startAt: nowMs() + 5000,
      scope,
      issuedAt: nowMs(),
      seq: (syncState.seq || 0) + 1
    };

    return res.json({
      ok: true,
      scope,
      targets,
      startAt: syncState.startAt,
      seq: syncState.seq
    });
  } catch (e) {
    console.error("sync play error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// ==========================
// START
// ==========================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mega Signage V2: http://0.0.0.0:${PORT}/public/admin.html`);
  console.log(`Player: http://<IP>:${PORT}/public/player.html`);
});