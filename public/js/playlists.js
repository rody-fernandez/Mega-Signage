window.loadPlaylists = async function(){
  const data = await api("/api/playlists");

  appState.playlists = Array.isArray(data)
    ? data.map(p => ({
        id: p?.id ?? "",
        name: p?.name ?? "",
        screen_name: p?.screen_name ?? p?.screen ?? "",
        media_ids: Array.isArray(p?.media_ids) ? p.media_ids : [],
        active: Number(p?.active || 0),
        created_at: p?.created_at ?? 0
      }))
    : [];

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

  if (!appState.playlists.length) {
    html += `
      <div class="list-row">
        <div>-</div>
        <div>No hay playlists</div>
        <div>0</div>
        <div>No</div>
        <div>-</div>
      </div>
    `;
    list.innerHTML = html;
    return;
  }

  for (const p of appState.playlists){
    html += `
      <div class="list-row">
        <div>${p.screen_name || "-"}</div>
        <div>${p.name || "-"}</div>
        <div>${(p.media_ids || []).length}</div>
        <div>${p.active ? '<span class="badge ok">Activa</span>' : '<span class="badge">No</span>'}</div>
        <div>${p.id || "-"}</div>
      </div>
    `;
  }

  list.innerHTML = html;
};

window.renderActivatePlaylists = function(){
  const screen = $id("pl_activate_screen").value || (appState.screens[0]?.name || "");
  const sel = $id("pl_activate_list");

  const filtered = appState.playlists.filter(p => String(p.screen_name) === String(screen));

  if (!filtered.length) {
    sel.innerHTML = `<option value="">No hay playlists para ${screen}</option>`;
    return;
  }

  sel.innerHTML = filtered.map(p => `
    <option value="${p.id}">
      ${p.name} (id:${p.id})
    </option>
  `).join("");
};

window.bindPlaylists = function(){
  $id("btn_create_playlist").addEventListener("click", async () => {
    const screen_name = $id("pl_screen").value;
    const name = $id("pl_name").value.trim();
    const media_ids = [...document.querySelectorAll("#pl_media_list input[type=checkbox]:checked")]
      .map(x => Number(x.value));

    if (!screen_name) {
      setStatus("playlist_status", "Elegí una pantalla", false);
      return;
    }

    if (!name) {
      setStatus("playlist_status", "Escribí un nombre de playlist", false);
      return;
    }

    if (!media_ids.length) {
      setStatus("playlist_status", "Seleccioná al menos un medio", false);
      return;
    }

    const r = await api("/api/playlists/create", "POST", { screen_name, name, media_ids });

    setStatus("playlist_status", r.ok ? "Playlist creada" : (r.error || "Error"), !!r.ok);

    if (r.ok) {
      $id("pl_name").value = "";
      document.querySelectorAll("#pl_media_list input[type=checkbox]").forEach(ch => ch.checked = false);
    }

    await loadPlaylists();
  });

  $id("btn_reload_playlists").addEventListener("click", loadPlaylists);
  $id("pl_activate_screen").addEventListener("change", renderActivatePlaylists);

  $id("btn_activate_playlist").addEventListener("click", async () => {
    const screen_name = $id("pl_activate_screen").value;
    const playlist_id = Number($id("pl_activate_list").value || 0);

    if (!playlist_id) {
      setStatus("activate_status", "No hay playlist seleccionada", false);
      return;
    }

    const r = await api("/api/playlists/activate", "POST", { screen_name, playlist_id });

    setStatus("activate_status", r.ok ? "Playlist activada" : (r.error || "Error"), !!r.ok);
    await loadPlaylists();
  });
};