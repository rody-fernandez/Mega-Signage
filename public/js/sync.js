window.bindSync = function(){
  $id("btn_sync_all").addEventListener("click", async () => {
    const r = await api("/api/sync/play","POST",{ scope:"ALL" });
    setStatus("sync_all_status", r.ok ? `SYNC ALL → seq ${r.seq}` : (r.error || "Error"), !!r.ok);
  });

  $id("btn_sync_p1").addEventListener("click", async () => {
    const r = await api("/api/sync/play","POST",{ scope:"P1" });
    setStatus("sync_p1_status", r.ok ? `SYNC P1 → seq ${r.seq}` : (r.error || "Error"), !!r.ok);
  });

  $id("btn_sync_pb").addEventListener("click", async () => {
    const r = await api("/api/sync/play","POST",{ scope:"PB" });
    setStatus("sync_pb_status", r.ok ? `SYNC PB → seq ${r.seq}` : (r.error || "Error"), !!r.ok);
  });
};