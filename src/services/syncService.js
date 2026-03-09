const { nowMs } = require("../utils/helpers");
const { all } = require("../db/database");

let syncState = {
  startAt: 0,
  seq: 0,
  scope: "ALL",
  issuedAt: 0
};

function getSyncState() {
  return {
    startAt: syncState.startAt || 0,
    seq: syncState.seq || 0,
    scope: syncState.scope || "ALL"
  };
}

async function triggerSync(scope = "ALL") {
  let targets = 0;

  if (scope === "P1") {
    const rows = await all(
      `SELECT COUNT(*) as c
       FROM players p
       LEFT JOIN screens s ON s.id = p.screen_id
       WHERE s.floor = 'P1'`
    );
    targets = rows[0]?.c || 0;
  } else if (scope === "PB") {
    const rows = await all(
      `SELECT COUNT(*) as c
       FROM players p
       LEFT JOIN screens s ON s.id = p.screen_id
       WHERE s.floor = 'PB'`
    );
    targets = rows[0]?.c || 0;
  } else {
    const rows = await all(`SELECT COUNT(*) as c FROM players`);
    targets = rows[0]?.c || 0;
  }

  const startDelay = 6000;

  syncState = {
    startAt: nowMs() + startDelay,
    seq: (syncState.seq || 0) + 1,
    scope,
    issuedAt: nowMs()
  };

  return {
    ok: true,
    scope,
    targets,
    startAt: syncState.startAt,
    seq: syncState.seq
  };
}

module.exports = {
  getSyncState,
  triggerSync
};