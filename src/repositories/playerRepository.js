const { all, get, run } = require("../db/database");

async function createPlayer({ name, token, pairing_code, last_seen }) {
  return run(
    `
    INSERT INTO players (name, token, pairing_code, last_seen)
    VALUES (?, ?, ?, ?)
    `,
    [name, token, pairing_code, last_seen]
  );
}

async function updatePlayerLastSeen(token, last_seen) {
  return run(`UPDATE players SET last_seen = ? WHERE token = ?`, [last_seen, token]);
}

async function getPlayerByToken(token) {
  return get(`SELECT * FROM players WHERE token = ?`, [token]);
}

async function pairPlayerByCode({ pairing_code, screen_id, paired_at, last_seen }) {
  return run(
    `UPDATE players
     SET screen_id = ?, paired_at = ?, last_seen = ?
     WHERE pairing_code = ?`,
    [screen_id, paired_at, last_seen, pairing_code]
  );
}

async function listPlayersWithScreens() {
  return all(
    `
    SELECT
      p.id,
      p.name,
      p.token,
      p.pairing_code,
      p.screen_id,
      p.paired_at,
      p.last_seen,
      s.name as screen_name
    FROM players p
    LEFT JOIN screens s ON s.id = p.screen_id
    ORDER BY p.id DESC
    `
  );
}

module.exports = {
  createPlayer,
  updatePlayerLastSeen,
  getPlayerByToken,
  pairPlayerByCode,
  listPlayersWithScreens
};