window.loadPlayers = async function(){
  appState.players = await api("/api/players");
  renderPlayersList();
};

window.renderPlayersList = function(){
  const list = $id("players_list");
  let html = `
    <div class="list-header">
      <div>Nombre</div>
      <div>Código</div>
      <div>Pantalla</div>
      <div>Estado</div>
    </div>
  `;
  for (const p of appState.players){
    html += `
      <div class="list-row">
        <div>${p.name}</div>
        <div>${p.pairing_code}</div>
        <div>${p.screen_name}</div>
        <div>${p.online ? '<span class="badge ok">ONLINE</span>' : `<span class="badge off">OFFLINE (${p.offline_seconds}s)</span>`}</div>
      </div>
    `;
  }
  list.innerHTML = html;
};

window.bindPlayers = function(){
  $id("btn_pair").addEventListener("click", async () => {
    const pairing_code = $id("pair_code").value.trim();
    const screen = $id("pair_screen").value;
    const r = await api("/api/player/pair", "POST", { pairing_code, screen });
    setStatus("pair_status", r.ok ? `Vinculado a ${r.screen}` : (r.error || "Error"), !!r.ok);
    await loadPlayers();
  });

  $id("btn_reload_players").addEventListener("click", loadPlayers);
};