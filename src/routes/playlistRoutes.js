const express = require("express");
const router = express.Router();

const { nowMs } = require("../utils/helpers");
const {
  createPlaylist,
  listPlaylistsByScreen,
  deactivatePlaylistsByScreen,
  activatePlaylistById
} = require("../repositories/playlistRepository");

router.post("/create", async (req, res) => {
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

    await createPlaylist({
      screen_name,
      name,
      media_ids,
      created_at: nowMs()
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("playlist create error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.get("/:screen", async (req, res) => {
  try {
    let screen = String(req.params.screen || "").trim();

    if (screen.includes("-")) {
      const parts = screen.split("-");
      screen = parts[parts.length - 1].trim();
    }

    const rows = await listPlaylistsByScreen(screen);
    const playlists = rows.map((p) => ({
      id: p.id,
      name: p.name,
      screen_name: p.screen_name,
      media_ids: JSON.parse(p.media_ids || "[]"),
      active: p.active
    }));

    res.json(playlists);
  } catch (e) {
    console.error("playlists list error:", e);
    res.status(500).json([]);
  }
});

router.post("/activate", async (req, res) => {
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

    await deactivatePlaylistsByScreen(screen_name);
    await activatePlaylistById(playlist_id);

    res.json({ ok: true });
  } catch (e) {
    console.error("playlist activate error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

module.exports = router;