const fs = require("fs");
const crypto = require("crypto");
const { UPLOAD_DIR } = require("../config/paths");

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

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

module.exports = {
  nowMs,
  makeToken,
  makePairCode,
  isOnline,
  ensureUploadsDir
};