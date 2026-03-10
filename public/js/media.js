window.loadMedia = async function(){
  appState.media = await api("/api/media");
  renderMediaList();
  renderMediaChecks();
};

window.renderMediaList = function(){
  const list = $id("media_list");
  let html = `
    <div class="list-header" style="grid-template-columns: 1.2fr 1fr 1fr 1fr;">
      <div>Archivo</div>
      <div>Tamaño</div>
      <div>URL</div>
      <div>ID</div>
    </div>
  `;
  for (const m of appState.media){
    html += `
      <div class="list-row" style="grid-template-columns: 1.2fr 1fr 1fr 1fr;">
        <div>${m.original_name}</div>
        <div>${fmtBytes(m.size)}</div>
        <div class="muted">${m.url}</div>
        <div>${m.id}</div>
      </div>
    `;
  }
  list.innerHTML = html;
};

window.renderMediaChecks = function(){
  $id("pl_media_list").innerHTML = appState.media.map(m => `
    <label class="media-item">
      <input type="checkbox" value="${m.id}" />
      <span>${m.original_name}</span>
      <span class="small muted">(${fmtBytes(m.size)})</span>
    </label>
  `).join("");
};

window.bindMedia = function(){
  $id("btn_upload_media").addEventListener("click", async () => {
    const file = $id("media_file").files[0];
    if (!file) {
      setStatus("media_status", "Elegí un archivo", false);
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/media/upload", { method:"POST", body: fd });
    const data = await res.json();

    setStatus("media_status", data.ok ? "Archivo subido" : (data.error || "Error"), !!data.ok);
    await loadMedia();
  });
};