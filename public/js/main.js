window.addEventListener("DOMContentLoaded", async () => {
  bindTabs();
  bindScreens();
  bindMedia();
  bindPlaylists();
  bindPlayers();
  bindLayout();
  bindSync();

  await loadScreens();
  await loadMedia();
  await loadPlaylists();
  await loadPlayers();

  if (appState.screens[0]) {
    selectScreen(appState.screens[0].name);
  }

  setInterval(loadPlayers, 5000);
});