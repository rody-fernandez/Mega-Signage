window.renderLayout = function(){
  const canvas = $id("layout_canvas");
  if (!canvas) return;
  canvas.innerHTML = "";

  const maxW = Math.max(1000, ...appState.screens.map(s => Number(s.x_offset||0) + Number(s.width_px||0)));
  const maxH = Math.max(600, ...appState.screens.map(s => Number(s.y_offset||0) + Number(s.height_px||0)));

  const scaleX = canvas.clientWidth / maxW;
  const scaleY = canvas.clientHeight / maxH;
  const scale = Math.min(scaleX, scaleY);

  for (const s of appState.screens){
    const el = document.createElement("div");
    el.className = "screen-box" + (appState.selectedScreenName === s.name ? " active" : "");
    el.dataset.name = s.name;
    el.style.left = `${Math.round((s.x_offset||0) * scale)}px`;
    el.style.top = `${Math.round((s.y_offset||0) * scale)}px`;
    el.style.width = `${Math.max(30, Math.round((s.width_px||0) * scale))}px`;
    el.style.height = `${Math.max(30, Math.round((s.height_px||0) * scale))}px`;
    el.innerHTML = `<div class="screen-name">${s.name}</div>`;
    el.addEventListener("mousedown", (ev) => startDrag(ev, s.name, scale));
    el.addEventListener("click", () => selectScreen(s.name));
    canvas.appendChild(el);
  }
};

window.startDrag = function(ev, name, scale){
  const screen = appState.screens.find(s => s.name === name);
  if (!screen) return;

  appState.selectedScreenName = name;
  selectScreen(name);

  const startX = ev.clientX;
  const startY = ev.clientY;
  const originalX = Number(screen.x_offset || 0);
  const originalY = Number(screen.y_offset || 0);

  appState.drag = { name, startX, startY, originalX, originalY, scale };

  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", stopDrag);
};

window.onDragMove = function(ev){
  if (!appState.drag) return;
  const screen = appState.screens.find(s => s.name === appState.drag.name);
  if (!screen) return;

  const dx = ev.clientX - appState.drag.startX;
  const dy = ev.clientY - appState.drag.startY;

  screen.x_offset = Math.max(0, Math.round(appState.drag.originalX + (dx / appState.drag.scale)));
  screen.y_offset = Math.max(0, Math.round(appState.drag.originalY + (dy / appState.drag.scale)));

  if (appState.selectedScreenName === screen.name){
    $id("layout_selected_x").value = screen.x_offset;
    $id("layout_selected_y").value = screen.y_offset;
    $id("layout_x").value = screen.x_offset;
    $id("layout_y").value = screen.y_offset;
  }

  renderLayout();
};

window.stopDrag = function(){
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", stopDrag);
  appState.drag = null;
};

window.bindLayout = function(){
  $id("btn_apply_layout_to_selected").addEventListener("click", () => {
    const name = appState.selectedScreenName;
    if (!name) return;
    const s = appState.screens.find(x => x.name === name);
    if (!s) return;

    s.x_offset = Number($id("layout_x").value || 0);
    s.y_offset = Number($id("layout_y").value || 0);
    s.width_px = Number($id("layout_w").value || 0);
    s.height_px = Number($id("layout_h").value || 0);

    $id("layout_selected_x").value = s.x_offset;
    $id("layout_selected_y").value = s.y_offset;
    $id("layout_selected_w").value = s.width_px;
    $id("layout_selected_h").value = s.height_px;

    renderLayout();
    setStatus("layout_status","Cambios aplicados localmente. Falta guardar layout.", true);
  });

  $id("btn_apply_detail_to_selected").addEventListener("click", () => {
    const name = appState.selectedScreenName;
    if (!name) return;
    const s = appState.screens.find(x => x.name === name);
    if (!s) return;

    s.floor = $id("layout_selected_floor").value.trim();
    s.x_offset = Number($id("layout_selected_x").value || 0);
    s.y_offset = Number($id("layout_selected_y").value || 0);
    s.width_px = Number($id("layout_selected_w").value || 0);
    s.height_px = Number($id("layout_selected_h").value || 0);
    s.orientation = $id("layout_selected_orientation").value;
    s.fit = $id("layout_selected_fit").value;

    $id("layout_x").value = s.x_offset;
    $id("layout_y").value = s.y_offset;
    $id("layout_w").value = s.width_px;
    $id("layout_h").value = s.height_px;

    renderLayout();
    setStatus("layout_status","Cambios aplicados localmente. Falta guardar layout.", true);
  });

  $id("btn_save_layout").addEventListener("click", async () => {
    const items = appState.screens.map(s => ({
      name: s.name,
      floor: s.floor,
      x_offset: Number(s.x_offset || 0),
      y_offset: Number(s.y_offset || 0),
      width_px: Number(s.width_px || 0),
      height_px: Number(s.height_px || 0),
      orientation: s.orientation || "vertical",
      fit: s.fit || "contain"
    }));

    const r = await api("/api/screens/layout/save", "POST", { items });
    setStatus("layout_status", r.ok ? `Layout guardado (${r.count})` : (r.error || "Error"), !!r.ok);
    await loadScreens();
  });
};