const { all, run, get } = require("../db/database");

async function getAllPlaylists() {
  return await all(`SELECT * FROM playlists ORDER BY id DESC`);
}

async function getPlaylistsByScreen(screen_name) {
  return await all(
    `SELECT * FROM playlists WHERE screen_name = ? ORDER BY id DESC`,
    [screen_name]
  );
}

async function createPlaylist(data) {
  return await run(
    `
    INSERT INTO playlists (screen_name, name, media_ids, active, created_at)
    VALUES (?, ?, ?, 0, ?)
    `,
    [
      data.screen_name,
      data.name,
      JSON.stringify(data.media_ids || []),
      data.created_at,
    ]
  );
}

async function activatePlaylist(screen_name, playlist_id) {
  await run(`UPDATE playlists SET active = 0 WHERE screen_name = ?`, [screen_name]);
  await run(`UPDATE playlists SET active = 1 WHERE id = ?`, [playlist_id]);
}

async function getActivePlaylistByScreen(screen_name) {
  return await get(
    `
    SELECT * FROM playlists
    WHERE screen_name = ? AND active = 1
    ORDER BY id DESC
    LIMIT 1
    `,
    [screen_name]
  );
}

module.exports = {
  getAllPlaylists,
  getPlaylistsByScreen,
  createPlaylist,
  activatePlaylist,
  getActivePlaylistByScreen,
};