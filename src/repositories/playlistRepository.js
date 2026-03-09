const { all, get, run } = require("../db/database");

async function createPlaylist({ screen_name, name, media_ids, created_at }) {
  return run(
    `
    INSERT INTO playlists (screen_name, name, media_ids, active, created_at)
    VALUES (?, ?, ?, 0, ?)
    `,
    [screen_name, name, JSON.stringify(media_ids), created_at]
  );
}

async function listPlaylistsByScreen(screen_name) {
  return all(
    `SELECT * FROM playlists WHERE screen_name = ? ORDER BY id DESC`,
    [screen_name]
  );
}

async function deactivatePlaylistsByScreen(screen_name) {
  return run(`UPDATE playlists SET active = 0 WHERE screen_name = ?`, [screen_name]);
}

async function activatePlaylistById(playlist_id) {
  return run(`UPDATE playlists SET active = 1 WHERE id = ?`, [playlist_id]);
}

async function getActivePlaylistByScreen(screen_name) {
  return get(
    `SELECT * FROM playlists
     WHERE screen_name = ? AND active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [screen_name]
  );
}

module.exports = {
  createPlaylist,
  listPlaylistsByScreen,
  deactivatePlaylistsByScreen,
  activatePlaylistById,
  getActivePlaylistByScreen
};