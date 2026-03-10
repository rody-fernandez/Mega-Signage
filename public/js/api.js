window.api = async function(url, method="GET", body=null){
  const opts = { method, headers:{} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt; }
};

window.$id = function(id){
  return document.getElementById(id);
};

window.setStatus = function(id, msg, ok=true){
  const el = $id(id);
  if (!el) return;
  el.textContent = msg || "";
  el.className = "status " + (ok ? "ok" : "error");
};

window.fmtBytes = function(bytes){
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024*1024) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1024/1024).toFixed(1)} MB`;
};