const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DB_PATH = path.join(ROOT, "mega-signage.db");

module.exports = {
  ROOT,
  PUBLIC_DIR,
  UPLOAD_DIR,
  DB_PATH
};