const { all, get, run } = require("../db/database");

async function listScreens() {
  return all(`SELECT * FROM screens ORDER BY name ASC`);
}

async function getScreenByName(name) {
  return get(`SELECT * FROM screens WHERE name = ?`, [name]);
}

async function updateScreen({
  name,
  floor,
  width_px,
  height_px,
  orientation,
  fit,
  x_offset,
  y_offset
}) {
  return run(
    `
    UPDATE screens
    SET floor = ?, width_px = ?, height_px = ?, orientation = ?, fit = ?, x_offset = ?, y_offset = ?
    WHERE name = ?
    `,
    [floor, width_px, height_px, orientation, fit, x_offset, y_offset, name]
  );
}

module.exports = {
  listScreens,
  getScreenByName,
  updateScreen
};