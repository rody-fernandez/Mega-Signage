const express = require("express");
const router = express.Router();

const {
  listScreens,
  updateScreen
} = require("../repositories/screenRepository");

router.get("/", async (req, res) => {
  try {
    const rows = await listScreens();
    res.json(rows);
  } catch (e) {
    console.error("screens error:", e);
    res.status(500).json([]);
  }
});

router.post("/update", async (req, res) => {
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

    const r = await updateScreen({
      name,
      floor,
      width_px,
      height_px,
      orientation,
      fit,
      x_offset,
      y_offset
    });

    if (!r.changes) {
      return res.status(404).json({ ok: false, error: "screen not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("screens update error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

module.exports = router;