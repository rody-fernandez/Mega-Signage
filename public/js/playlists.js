window.loadPlaylists = async function(){
  appState.playlists = await api("/api/playlists");
  renderPlaylistsList();
  renderActivatePlaylists();
};

window.renderPlaylistsList = function(){
  const list = $id("playlists_list");
  let html = `
    <div class="list-header">
      <div>Pantalla</div>
      <div>Nombre</div>
      <div>Items</div>
      <div>Activa</div>
      <div>ID</div>
    </div>
  `;
  for (const p of appState.playlists){
    html += `
      <div class="list-row">
        <div>${p.screen_name}</div>
        <div>${p.name}</div>
        <div>${(p.media_ids || []).length}</div>
        <div>${p.active ? '<span class="badge ok">Activa</span>' : '<span class="badge">No</span>'}</div>
        <div>${p.id}</div>
      </div>
    `;
  }
  list.innerHTML = html;
};

window.renderActivatePlaylists = function(){
  const screen = $id("pl_activate_screen").value || (appState.screens[0]?.name || "");
  const sel = $id("pl_activate_list");
  const filtered = appState.playlists.filter(p => p.screen_name === screen);
  sel.innerHTML = filtered.map(p => `<option value="${p.id}">${p.name} (id:${p.id})</option>`).join("");
};

window.bindPlaylists = function(){
  $id("btn_create_playlist").addEventListener("click", async () => {
    const screen_name = $id("pl_screen").value;
    const name = $id("pl_name").value.trim();
    const media_ids = [...document.querySelectorAll("#pl_media_list input[type=checkbox]:checked")].map(x => Number(x.value));

    const r = await api("/api/playlists/create", "POST", { screen_name, name, media_ids });
    setStatus("playlist_status", r.ok ? "Playlist creada" : (r.error || "Error"), !!r.ok);
    await loadPlaylists();
  });

  $id("btn_reload_playlists").addEventListener("click", loadPlaylists);
  $id("pl_activate_screen").addEventListener("change", renderActivatePlaylists);

  $id("btn_activate_playlist").addEventListener("click", async () => {
    const screen_name = $id("pl_activate_screen").value;
    const playlist_id = Number($id("pl_activate_list").value || 0);
    const r = await api("/api/playlists/activate", "POST", { screen_name, playlist_id });
    setStatus("activate_status", r.ok ? "Playlist activada" : (r.error || "Error"), !!r.ok);
    await loadPlaylists();
  });
};