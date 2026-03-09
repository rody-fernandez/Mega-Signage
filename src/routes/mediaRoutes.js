const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const { UPLOAD_DIR } = require("../config/paths");
const { nowMs } = require("../utils/helpers");
const { insertMedia, listMedia } = require("../repositories/mediaRepository");

const router = express.Router();

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

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "missing file" });
    }

    await insertMedia({
      filename: req.file.filename,
      original_name: req.file.originalname,
      mime: req.file.mimetype || "application/octet-stream",
      size: req.file.size || 0,
      created_at: nowMs()
    });

    res.json({ ok: true, filename: req.file.filename });
  } catch (e) {
    console.error("upload error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.get("/", async (req, res) => {
  try {
    const rows = await listMedia();
    const media = rows.map((m) => ({
      id: m.id,
      filename: m.filename,
      original_name: m.original_name,
      size: m.size || 0,
      url: `/uploads/${m.filename}`
    }));
    res.json(media);
  } catch (e) {
    console.error("media error:", e);
    res.status(500).json([]);
  }
});

module.exports = router;