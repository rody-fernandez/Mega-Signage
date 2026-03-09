const express = require("express");
const router = express.Router();

const { isOnline, nowMs } = require("../utils/helpers");
const { listPlayersWithScreens } = require("../repositories/playerRepository");

router.get("/", async (req, res) => {
  try {
    const rows = await listPlayersWithScreens();

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

    res.json(players);
  } catch (e) {
    console.error("players list error:", e);
    res.status(500).json([]);
  }
});

module.exports = router;