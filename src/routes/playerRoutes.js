const express = require("express");
const router = express.Router();

const { nowMs, makeToken, makePairCode, isOnline } = require("../utils/helpers");
const { getSyncState } = require("../services/syncService");

const {
  createPlayer,
  updatePlayerLastSeen,
  getPlayerByToken,
  pairPlayerByCode,
  listPlayersWithScreens
} = require("../repositories/playerRepository");

const { getScreenByName } = require("../repositories/screenRepository");
const { getActivePlaylistByScreen } = require("../repositories/playlistRepository");
const { listMediaByIds } = require("../repositories/mediaRepository");

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "ANDROID-BOX").trim();
    const token = makeToken();
    const pairing_code = makePairCode();

    await createPlayer({
      name,
      token,
      pairing_code,
      last_seen: nowMs()
    });

    res.json({ ok: true, token, pairing_code });
  } catch (e) {
    console.error("register error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post("/heartbeat", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();

    if (!token) {
      return res.status(400).json({ ok: false, error: "missing token" });
    }

    const r = await updatePlayerLastSeen(token, nowMs());

    if (!r.changes) {
      return res.status(404).json({ ok: false, error: "unknown token" });
    }

    res.json({ ok: true, ts: nowMs() });
  } catch (e) {
    console.error("heartbeat error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post("/ping", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();

    if (!token) {
      return res.status(400).json({ ok: false, error: "missing token" });
    }

    const r = await updatePlayerLastSeen(token, nowMs());

    if (!r.changes) {
      return res.status(404).json({ ok: false, error: "unknown token" });
    }

    res.json({ ok: true, ts: nowMs() });
  } catch (e) {
    console.error("ping error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post("/pair", async (req, res) => {
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

    const screen = await getScreenByName(screen_name);

    if (!screen) {
      return res.status(404).json({
        ok: false,
        error: `screen not found: ${screen_name}`
      });
    }

    const r = await pairPlayerByCode({
      pairing_code,
      screen_id: screen.id,
      paired_at: nowMs(),
      last_seen: nowMs()
    });

    if (!r.changes) {
      return res.status(404).json({
        ok: false,
        error: "pairing_code not found"
      });
    }

    res.json({
      ok: true,
      pairing_code,
      screen: screen.name
    });
  } catch (e) {
    console.error("pair error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.get("/config", async (req, res) => {
  try {
    const token = String(req.query?.token || "").trim();

    if (!token) {
      return res.status(400).json({ ok: false, error: "missing token" });
    }

    const p = await getPlayerByToken(token);

    if (!p) {
      return res.status(404).json({ ok: false, error: "unknown token" });
    }

    await updatePlayerLastSeen(token, nowMs());

    if (!p.screen_id) {
      return res.json({
        ok: true,
        paired: false,
        pairing_code: p.pairing_code,
        sync: getSyncState()
      });
    }

    const screen = await require("../db/database").get(`SELECT * FROM screens WHERE id = ?`, [p.screen_id]);

    if (!screen) {
      return res.json({
        ok: true,
        paired: false,
        pairing_code: p.pairing_code,
        sync: getSyncState()
      });
    }

    const activePlaylist = await getActivePlaylistByScreen(screen.name);

    let items = [];
    let playlistName = null;
    let playlistVersion = 0;

    if (activePlaylist) {
      playlistName = activePlaylist.name;
      playlistVersion = activePlaylist.id;

      const mediaIds = JSON.parse(activePlaylist.media_ids || "[]");
      const mediaRows = await listMediaByIds(mediaIds);

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

    res.json({
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
      sync: getSyncState(),
      items
    });
  } catch (e) {
    console.error("player config error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.get("/../players", async (req, res) => {
  res.status(404).json([]);
});

module.exports = router;