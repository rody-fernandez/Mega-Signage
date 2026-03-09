const express = require("express");
const router = express.Router();

const { triggerSync } = require("../services/syncService");

router.post("/play", async (req, res) => {
  try {
    const scope = String(req.body?.scope || "ALL").trim();
    const result = await triggerSync(scope);
    console.log("SYNC TRIGGER", result);
    res.json(result);
  } catch (e) {
    console.error("sync play error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

module.exports = router;