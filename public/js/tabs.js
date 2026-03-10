window.openPanel = function(name){
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.panel === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  $id("panel-" + name).classList.add("active");
};

window.bindTabs = function(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => openPanel(btn.dataset.panel));
  });
};