window.loadScreens = async function(){
  appState.screens = await api("/api/screens");
  renderScreensList();
  renderScreenSelects();
  renderLayout();
};

window.renderScreenSelects = function(){
  const selects = ["pl_screen","pl_activate_screen","pair_screen"];
  selects.forEach(id => {
    const sel = $id(id);
    if (!sel) return;
    sel.innerHTML = appState.screens.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
  });
  if (window.renderActivatePlaylists) renderActivatePlaylists();
};

window.renderScreensList = function(){
  const list = $id("screens_list");
  let html = `
    <div class="list-header">
      <div>Nombre</div>
      <div>Floor</div>
      <div>Resolución</div>
      <div>Posición</div>
      <div>Orientación</div>
      <div>Acción</div>
    </div>
  `;
  for (const s of appState.screens){
    html += `
      <div class="list-row">
        <div><strong>${s.name}</strong></div>
        <div>${s.floor || "-"}</div>
        <div>${s.width_px} x ${s.height_px}</div>
        <div>X:${s.x_offset||0} Y:${s.y_offset||0}</div>
        <div>${s.orientation || "vertical"} / ${s.fit || "contain"}</div>
        <div><button onclick="selectScreen('${s.name}')">Seleccionar</button></div>
      </div>
    `;
  }
  list.innerHTML = html;
};

window.selectScreen = function(name){
  const s = appState.screens.find(x => x.name === name);
  if (!s) return;

  appState.selectedScreenName = name;

  $id("scr_name").value = s.name;
  $id("scr_floor").value = s.floor || "";
  $id("scr_x").value = s.x_offset || 0;
  $id("scr_y").value = s.y_offset || 0;
  $id("scr_w").value = s.width_px || 0;
  $id("scr_h").value = s.height_px || 0;
  $id("scr_orientation").value = s.orientation || "vertical";
  $id("scr_fit").value = s.fit || "contain";

  $id("layout_selected_name").value = s.name;
  $id("layout_selected_floor").value = s.floor || "";
  $id("layout_selected_x").value = s.x_offset || 0;
  $id("layout_selected_y").value = s.y_offset || 0;
  $id("layout_selected_w").value = s.width_px || 0;
  $id("layout_selected_h").value = s.height_px || 0;
  $id("layout_selected_orientation").value = s.orientation || "vertical";
  $id("layout_selected_fit").value = s.fit || "contain";

  $id("layout_x").value = s.x_offset || 0;
  $id("layout_y").value = s.y_offset || 0;
  $id("layout_w").value = s.width_px || 0;
  $id("layout_h").value = s.height_px || 0;

  renderLayout();
  setStatus("screen_status", `Pantalla seleccionada: ${s.name}`, true);
};

window.bindScreens = function(){
  $id("btn_create_screen").addEventListener("click", async () => {
    const body = {
      name: $id("scr_name").value.trim(),
      floor: $id("scr_floor").value.trim(),
      x_offset: Number($id("scr_x").value || 0),
      y_offset: Number($id("scr_y").value || 0),
      width_px: Number($id("scr_w").value || 0),
      height_px: Number($id("scr_h").value || 0),
      orientation: $id("scr_orientation").value,
      fit: $id("scr_fit").value
    };
    const r = await api("/api/screens/create","POST",body);
    setStatus("screen_status", r.ok ? "Pantalla agregada" : (r.error || "Error"), !!r.ok);
    await loadScreens();
  });

  $id("btn_update_screen").addEventListener("click", async () => {
    const body = {
      name: $id("scr_name").value.trim(),
      floor: $id("scr_floor").value.trim(),
      x_offset: Number($id("scr_x").value || 0),
      y_offset: Number($id("scr_y").value || 0),
      width_px: Number($id("scr_w").value || 0),
      height_px: Number($id("scr_h").value || 0),
      orientation: $id("scr_orientation").value,
      fit: $id("scr_fit").value
    };
    const r = await api("/api/screens/update","POST",body);
    setStatus("screen_status", r.ok ? "Pantalla actualizada" : (r.error || "Error"), !!r.ok);
    await loadScreens();
  });

  $id("btn_delete_screen").addEventListener("click", async () => {
    const name = $id("scr_name").value.trim();
    if (!name) return;
    if (!confirm(`¿Eliminar pantalla ${name}?`)) return;
    const r = await api("/api/screens/delete","POST",{ name });
    setStatus("screen_status", r.ok ? "Pantalla eliminada" : (r.error || "Error"), !!r.ok);
    await loadScreens();
  });

  $id("btn_refresh_screens").addEventListener("click", loadScreens);
};