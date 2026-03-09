async function columnExists(all, table, column) {
  const rows = await all(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

async function runMigrations({ run, all }) {
  await run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      pairing_code TEXT NOT NULL UNIQUE,
      screen_id INTEGER,
      paired_at INTEGER,
      last_seen INTEGER DEFAULT 0
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      floor TEXT DEFAULT '',
      width_px INTEGER DEFAULT 0,
      height_px INTEGER DEFAULT 0
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screen_name TEXT NOT NULL,
      name TEXT NOT NULL,
      media_ids TEXT NOT NULL,
      active INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  if (!(await columnExists(all, "screens", "orientation"))) {
    await run(`ALTER TABLE screens ADD COLUMN orientation TEXT DEFAULT 'vertical'`);
  }

  if (!(await columnExists(all, "screens", "fit"))) {
    await run(`ALTER TABLE screens ADD COLUMN fit TEXT DEFAULT 'contain'`);
  }

  if (!(await columnExists(all, "screens", "x_offset"))) {
    await run(`ALTER TABLE screens ADD COLUMN x_offset INTEGER DEFAULT 0`);
  }

  if (!(await columnExists(all, "screens", "y_offset"))) {
    await run(`ALTER TABLE screens ADD COLUMN y_offset INTEGER DEFAULT 0`);
  }

  const defaultScreens = [
    ["C1", "P1", 128, 512, "vertical", "contain", 0, 0],
    ["C2", "P1", 192, 512, "vertical", "contain", 128, 0],
    ["C3", "P1", 256, 512, "vertical", "contain", 320, 0],
    ["C4", "P1", 128, 512, "vertical", "contain", 576, 0],
    ["C5", "P1", 128, 512, "vertical", "contain", 704, 0],
    ["C6", "P1", 320, 480, "vertical", "contain", 0, 0],
    ["C10", "PB", 704, 512, "vertical", "contain", 0, 0],
    ["C11", "PB", 192, 512, "vertical", "contain", 0, 0],
    ["C12", "PB", 256, 512, "vertical", "contain", 0, 0]
  ];

  for (const [name, floor, width_px, height_px, orientation, fit, x_offset, y_offset] of defaultScreens) {
    await run(
      `
      INSERT OR IGNORE INTO screens
      (name, floor, width_px, height_px, orientation, fit, x_offset, y_offset)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [name, floor, width_px, height_px, orientation, fit, x_offset, y_offset]
    );
  }
}

module.exports = {
  runMigrations
};