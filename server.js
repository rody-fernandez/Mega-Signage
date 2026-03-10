const express = require("express");
const cors = require("cors");
const playersListRoutes = require("./src/routes/playersListRoutes");

const { PUBLIC_DIR, UPLOAD_DIR } = require("./src/config/paths");
const { requestLogger } = require("./src/utils/logger");
const { ensureUploadsDir } = require("./src/utils/helpers");
const { initDb } = require("./src/services/initDb");

const screenRoutes = require("./src/routes/screenRoutes");
const mediaRoutes = require("./src/routes/mediaRoutes");
const playlistRoutes = require("./src/routes/playlistRoutes");
const playerRoutes = require("./src/routes/playerRoutes");
const syncRoutes = require("./src/routes/syncRoutes");

const app = express();
const PORT = 3000;

app.use(cors());
app.use("/api/players", playersListRoutes);
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

ensureUploadsDir();

app.use("/public", express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/", (req, res) => {
  res.redirect("/public/admin.html");
});

app.use("/api/screens", screenRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/player", playerRoutes);
app.use("/api/sync", syncRoutes);

initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Mega Signage V2: http://0.0.0.0:${PORT}/public/admin.html`);
      console.log(`Player: http://<IP>:${PORT}/public/player.html`);
    });
  })
  .catch((e) => {
    console.error("DB init error:", e);
    process.exit(1);
  });
