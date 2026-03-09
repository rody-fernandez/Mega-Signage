const { all, run } = require("../db/database");

async function insertMedia({ filename, original_name, mime, size, created_at }) {
  return run(
    `
    INSERT INTO media (filename, original_name, mime, size, created_at)
    VALUES (?, ?, ?, ?, ?)
    `,
    [filename, original_name, mime, size, created_at]
  );
}

async function listMedia() {
  return all(`SELECT * FROM media ORDER BY id DESC`);
}

async function listMediaByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return all(`SELECT * FROM media WHERE id IN (${placeholders})`, ids);
}

module.exports = {
  insertMedia,
  listMedia,
  listMediaByIds
};