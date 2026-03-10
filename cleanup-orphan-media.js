const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const ROOT = __dirname;
const DB_PATH = path.join(ROOT, "mega-signage.db");
const UPLOAD_DIR = path.join(ROOT, "uploads");

const db = new sqlite3.Database(DB_PATH);

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function cleanup() {
  console.log("Buscando medios...");
  const mediaRows = await all(`SELECT * FROM media ORDER BY id ASC`);

  const validMediaIds = new Set();
  const missingMediaIds = [];

  for (const m of mediaRows) {
    const filePath = path.join(UPLOAD_DIR, m.filename);
    const exists = fs.existsSync(filePath);

    if (exists) {
      validMediaIds.add(m.id);
    } else {
      missingMediaIds.push(m.id);
      console.log(`Media roto detectado -> id:${m.id} file:${m.filename}`);
    }
  }

  if (missingMediaIds.length) {
    console.log(`Eliminando ${missingMediaIds.length} medios huérfanos de la tabla media...`);
    for (const id of missingMediaIds) {
      await run(`DELETE FROM media WHERE id = ?`, [id]);
    }
  } else {
    console.log("No hay medios huérfanos.");
  }

  console.log("Revisando playlists...");
  const playlistRows = await all(`SELECT * FROM playlists ORDER BY id ASC`);

  let cleanedPlaylists = 0;
  let deletedPlaylists = 0;

  for (const p of playlistRows) {
    let mediaIds = [];

    try {
      mediaIds = JSON.parse(p.media_ids || "[]");
      if (!Array.isArray(mediaIds)) mediaIds = [];
    } catch {
      mediaIds = [];
    }

    const filtered = mediaIds.filter((id) => validMediaIds.has(id));

    if (filtered.length === 0) {
      console.log(`Eliminando playlist vacía -> id:${p.id} name:${p.name}`);
      await run(`DELETE FROM playlists WHERE id = ?`, [p.id]);
      deletedPlaylists++;
    } else if (filtered.length !== mediaIds.length) {
      console.log(`Corrigiendo playlist -> id:${p.id} name:${p.name}`);
      await run(`UPDATE playlists SET media_ids = ? WHERE id = ?`, [
        JSON.stringify(filtered),
        p.id,
      ]);
      cleanedPlaylists++;
    }
  }

  console.log("Limpieza terminada.");
  console.log(`Medios huérfanos eliminados: ${missingMediaIds.length}`);
  console.log(`Playlists corregidas: ${cleanedPlaylists}`);
  console.log(`Playlists eliminadas por quedar vacías: ${deletedPlaylists}`);
}

cleanup()
  .then(() => {
    db.close();
    console.log("Proceso completado.");
  })
  .catch((err) => {
    console.error("Error:", err);
    db.close();
    process.exit(1);
  });