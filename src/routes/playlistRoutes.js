const express = require("express");
const router = express.Router();
const repo = require("../repositories/playlistRepository");
const { nowMs } = require("../utils/helpers");

function normalizePlaylistRow(p) {
  let mediaIds = [];

  try {
    if (Array.isArray(p.media_ids)) {
      mediaIds = p.media_ids;
    } else if (typeof p.media_ids === "string") {
      mediaIds = JSON.parse(p.media_ids || "[]");
    }
  } catch {
    mediaIds = [];
  }

  return {
    id: p.id ?? null,
    name: p.name ?? "",
    screen_name: p.screen_name ?? p.screen ?? "",
    media_ids: mediaIds,
    active: Number(p.active || 0),
    created_at: p.created_at ?? 0,
  };
}

router.get("/", async (req, res) => {
  try {
    const rows = await repo.getAllPlaylists();
    return res.json(rows.map(normalizePlaylistRow));
  } catch (e) {
    console.error("GET /api/playlists error:", e);
    return res.status(500).json([]);
  }
});

router.get("/:screen", async (req, res) => {
  try {
    const screen = String(req.params.screen || "").trim();
    const rows = await repo.getPlaylistsByScreen(screen);
    return res.json(rows.map(normalizePlaylistRow));
  } catch (e) {
    console.error("GET /api/playlists/:screen error:", e);
    return res.status(500).json([]);
  }
});

router.post("/create", async (req, res) => {
  try {
    const screen_name = String(req.body?.screen_name || "").trim();
    const name = String(req.body?.name || "").trim();
    const media_ids = Array.isArray(req.body?.media_ids) ? req.body.media_ids : [];

    if (!screen_name) {
      return res.status(400).json({ ok: false, error: "missing screen_name" });
    }

    if (!name) {
      return res.status(400).json({ ok: false, error: "missing name" });
    }

    await repo.createPlaylist({
      screen_name,
      name,
      media_ids,
      created_at: nowMs(),
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/playlists/create error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post("/activate", async (req, res) => {
  try {
    const screen_name = String(req.body?.screen_name || "").trim();
    const playlist_id = Number(req.body?.playlist_id || 0);

    if (!screen_name || !playlist_id) {
      return res.status(400).json({ ok: false, error: "missing data" });
    }

    await repo.activatePlaylist(screen_name, playlist_id);

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/playlists/activate error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

module.exports = router;