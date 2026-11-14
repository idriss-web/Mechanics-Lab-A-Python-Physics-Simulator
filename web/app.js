"use strict";
const S = 100;
const TYPES = {
  pendulum: {label: "Pendulum", prefix: "P", params: [["length","Length","m",1.5],["mass","Mass","kg",1],["angle","Start angle","deg",45],["damping","Damping","1/s",0.05]]},
  spring: {label: "Spring mass", prefix: "S", params: [["k","Stiffness","N/m",20],["mass","Mass","kg",1],["rest","Rest length","m",1],["stretch","Start stretch","m",0.5],["damping","Damping","N·s/m",0.1],["horizontal","Horizontal","",false]]},
  ball: {label: "Bouncing ball", prefix: "B", params: [["speed","Launch speed","m/s",6],["angle","Launch angle","deg",50],["mass","Mass","kg",1],["restitution","Bounciness","0–1",0.75],["drag","Air drag","1/s",0.05]]},
  double: {label: "Double pendulum", prefix: "D", params: [["l1","Length 1","m",1],["l2","Length 2","m",1],["m1","Mass 1","kg",1],["m2","Mass 2","kg",1],["angle1","Angle 1","deg",120],["angle2","Angle 2","deg",-10],["damping","Damping","1/s",0]]},
  orbit: {label: "Orbit", prefix: "O", params: [["mu","Gravity pull","m³/s²",4],["distance","Distance","m",1.5],["speed_factor","Speed factor","×circ.",0.8],["mass","Mass","kg",1]]},
};
const COLORS = ["#D1495B","#2E86AB","#D99A21","#6A4C93","#3C8D5A","#C46A2D"];
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const board = document.getElementById("board"), bctx = board.getContext("2d");
const scope = document.getElementById("scope"), sctx = scope.getContext("2d");

let objs = [], counters = {}, selected = null, tool = null, drag = null, mouse = {x: 0, y: 0};
let result = null, tPlay = 0, playing = true, lastTs = null, scopeMode = "motion", hidden = new Set();

const floorY = () => board.clientHeight - 50;
const snap = v => Math.round(v / 10) * 10;
const fmt = x => Math.abs(x) < 1e-9 ? "0" : String(+x.toPrecision(3));
const radiusPx = m => 8 + 4 * Math.sqrt(m);
const colorOf = o => COLORS[objs.indexOf(o) % COLORS.length];
const frames = () => result ? result.t.length : 0;
const frameIdx = () => Math.min(frames() - 1, Math.floor(tPlay * (result?.fps || 60)));

function addObj(type, x, y, params = {}) {
  const tp = TYPES[type]; counters[tp.prefix] = (counters[tp.prefix] || 0) + 1;
  const base = {}; tp.params.forEach(p => base[p[0]] = p[3]);
  const o = {id: tp.prefix + counters[tp.prefix], type, x: snap(x), y: snap(y), params: {...base, ...params}};
  objs.push(o); return o;
}
function pts(o, idx) {
  const r = result?.objects[o.id]; if (!r) return null;
  return r.pts[idx].map(p => [o.x + p[0] * S, o.y + p[1] * S]);
}

function coil(g, x1, y1, x2, y2) {
  const L = Math.hypot(x2 - x1, y2 - y1); if (L < 1) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux, lead = Math.min(14, L / 4), n = 14;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 + ux * lead, y1 + uy * lead);
  const span = L - 2 * lead;
  for (let i = 1; i < n; i++) {
    const d = lead + span * i / n, a = (i % 2 ? 1 : -1) * 9;
    g.lineTo(x1 + ux * d + nx * a, y1 + uy * d + ny * a);
  }
  g.lineTo(x2 - ux * lead, y2 - uy * lead); g.lineTo(x2, y2); g.stroke();
}
function hatch(g, x, y, w, vertical) {
  g.beginPath();
  if (vertical) { g.moveTo(x - w, y); g.lineTo(x + w, y); for (let i = -w; i < w; i += 8) { g.moveTo(x + i, y); g.lineTo(x + i - 6, y - 8); } }
  else { g.moveTo(x, y - w); g.lineTo(x, y + w); for (let i = -w; i < w; i += 8) { g.moveTo(x, y + i); g.lineTo(x - 8, y + i - 6); } }
  g.stroke();
}
function disc(g, x, y, r, fill) {
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = css("--ink"); g.stroke();
}
function trail(g, o, idx, pointIndex, color) {
  const r = result.objects[o.id]; if (!document.getElementById("trails").checked) return;
  const from = Math.max(0, idx - 420);
  g.beginPath(); g.strokeStyle = color; g.globalAlpha = .45; g.lineWidth = 1.6;
  for (let i = from; i <= idx; i++) {
    const p = r.pts[i][pointIndex]; const X = o.x + p[0] * S, Y = o.y + p[1] * S;
    i === from ? g.moveTo(X, Y) : g.lineTo(X, Y);
  }
  g.stroke(); g.globalAlpha = 1;
}

function drawObj(g, o, idx) {
  const p = o.params, ink = css("--ink"), col = colorOf(o), P = pts(o, idx);
  g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = ink; g.lineWidth = 2;
  if (!P) { disc(g, o.x, o.y, 7, col); return; }
  if (o.type === "pendulum") {
    trail(g, o, idx, 1, col); hatch(g, o.x, o.y, 22, true);
    g.strokeStyle = css("--steel"); g.lineWidth = 3; g.beginPath(); g.moveTo(...P[0]); g.lineTo(...P[1]); g.stroke();
    disc(g, P[1][0], P[1][1], radiusPx(p.mass), col); disc(g, o.x, o.y, 3, ink);
  } else if (o.type === "spring") {
    const s = 18 + 6 * Math.sqrt(p.mass), h = s / 2;
    if (p.horizontal) {
      hatch(g, o.x, o.y, 26, false); g.strokeStyle = css("--steel"); g.lineWidth = 2.5; coil(g, P[0][0], P[0][1], P[1][0], P[1][1]);
      g.fillStyle = col; g.strokeStyle = ink; g.lineWidth = 2; g.fillRect(P[1][0], P[1][1] - h, s, s); g.strokeRect(P[1][0], P[1][1] - h, s, s);
    } else {
      hatch(g, o.x, o.y, 26, true); g.strokeStyle = css("--steel"); g.lineWidth = 2.5; coil(g, P[0][0], P[0][1], P[1][0], P[1][1]);
      g.fillStyle = col; g.strokeStyle = ink; g.lineWidth = 2; g.fillRect(P[1][0] - h, P[1][1], s, s); g.strokeRect(P[1][0] - h, P[1][1], s, s);
    }
  } else if (o.type === "ball") {
    trail(g, o, idx, 0, col); disc(g, P[0][0], P[0][1], radiusPx(p.mass), col);
  } else if (o.type === "double") {
    trail(g, o, idx, 2, col); hatch(g, o.x, o.y, 22, true);
    g.strokeStyle = css("--steel"); g.lineWidth = 3; g.beginPath(); g.moveTo(...P[0]); g.lineTo(...P[1]); g.lineTo(...P[2]); g.stroke();
    disc(g, P[1][0], P[1][1], radiusPx(p.m1), col); disc(g, P[2][0], P[2][1], radiusPx(p.m2), col); disc(g, o.x, o.y, 3, ink);
  } else if (o.type === "orbit") {
    trail(g, o, idx, 1, col);
    disc(g, o.x, o.y, 11, css("--gold")); disc(g, P[1][0], P[1][1], radiusPx(p.mass), col);
  }
}

function hitTest(x, y) {
  const idx = result ? frameIdx() : 0;
  for (let k = objs.length - 1; k >= 0; k--) {
    const o = objs[k], P = pts(o, idx) || [[o.x, o.y]];
    if (Math.hypot(x - o.x, y - o.y) < 18 || P.some(q => Math.hypot(x - q[0], y - q[1]) < 18)) return o;
  }
  return null;
}

function drawBoard() {
  const W = board.clientWidth, H = board.clientHeight, dpr = devicePixelRatio || 1;
  if (board.width !== W * dpr || board.height !== H * dpr) { board.width = W * dpr; board.height = H * dpr; }
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0); bctx.clearRect(0, 0, W, H);
  if (objs.some(o => o.type === "ball")) {
    const fy = floorY(); bctx.strokeStyle = css("--ink"); bctx.lineWidth = 3;
    bctx.beginPath(); bctx.moveTo(0, fy); bctx.lineTo(W, fy); bctx.stroke();
    bctx.lineWidth = 1.5; bctx.beginPath();
    for (let x = 0; x < W; x += 14) { bctx.moveTo(x, fy); bctx.lineTo(x - 8, fy + 10); }
    bctx.stroke();
  }
  const idx = result ? frameIdx() : 0;
  for (const o of objs) {
    if (o === selected) {
      bctx.strokeStyle = css("--steel"); bctx.setLineDash([4, 3]); bctx.lineWidth = 1.5;
      bctx.beginPath(); bctx.arc(o.x, o.y, 16, 0, Math.PI * 2); bctx.stroke(); bctx.setLineDash([]);
    }
    drawObj(bctx, o, idx);
    bctx.fillStyle = css("--ink"); bctx.font = "600 12px 'Avenir Next','Segoe UI',sans-serif"; bctx.textAlign = "center";
    bctx.fillText(o.id, o.x, o.y - 30);
  }
  if (tool) { bctx.globalAlpha = .5; disc(bctx, snap(mouse.x), snap(mouse.y), 8, css("--coral")); bctx.globalAlpha = 1; }
  document.getElementById("readout").textContent = result ? `t = ${fmt(Math.min(tPlay, result.t[result.t.length - 1]))} s` : "";
}

function changed() { renderInspector(); drawBoard(); scheduleRun(); }
function removeSelected() { if (!selected) return; objs = objs.filter(o => o !== selected); selected = null; changed(); }

board.addEventListener("pointerdown", e => {
  board.focus(); const r = board.getBoundingClientRect(); mouse = {x: e.clientX - r.left, y: e.clientY - r.top};
  if (tool) { selected = addObj(tool, mouse.x, mouse.y); if (!e.shiftKey) setTool(null); changed(); return; }
  const o = hitTest(mouse.x, mouse.y); selected = o;
  if (o) { drag = {o, dx: mouse.x - o.x, dy: mouse.y - o.y}; board.setPointerCapture(e.pointerId); }
  renderInspector(); drawBoard();
});
board.addEventListener("pointermove", e => {
  const r = board.getBoundingClientRect(); mouse = {x: e.clientX - r.left, y: e.clientY - r.top};
  if (drag) { drag.o.x = snap(mouse.x - drag.dx); drag.o.y = snap(mouse.y - drag.dy); }
  drawBoard();
});
board.addEventListener("pointerup", () => { if (drag) { drag = null; changed(); } });
addEventListener("keydown", e => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
  else if (e.key === "Escape") setTool(null);
  else if (e.key === " ") { e.preventDefault(); togglePlay(); }
});

function setTool(t) {
  tool = t; board.style.cursor = t ? "copy" : "crosshair";
  document.querySelectorAll("#parts button").forEach(b => b.classList.toggle("on", b.dataset.type === t));
  drawBoard();
}
(function () {
  const el = document.getElementById("parts");
  for (const [type, tp] of Object.entries(TYPES)) {
    const b = document.createElement("button"); b.dataset.type = type; b.textContent = tp.label;
    b.onclick = () => setTool(tool === type ? null : type); el.append(b);
  }
})();

function renderInspector() {
  const el = document.getElementById("inspector"), o = selected;
  if (!o) {
    el.innerHTML = `<h2>Inspector</h2><p>Select an object to edit its numbers.</p>
    <p><b>Place:</b> pick an object, click the board.<br><b>Move:</b> drag it.<br><b>Delete:</b> press Delete.<br><b>Pause / play:</b> press Space.</p>
    <p>Everything is simulated by the Python server. Changes re-run the simulation automatically.</p>`;
    return;
  }
  const tp = TYPES[o.type]; let h = `<h2>${tp.label} ${o.id}</h2>`;
  for (const [key, label, unit] of tp.params) {
    const v = o.params[key];
    h += typeof v === "boolean"
      ? `<div class="row"><label for="f_${key}">${label}</label><input type="checkbox" id="f_${key}" data-key="${key}" ${v ? "checked" : ""}></div>`
      : `<div class="row"><label for="f_${key}">${label}</label><input type="text" id="f_${key}" data-key="${key}" value="${v}"><span>${unit}</span></div>`;
  }
  h += `<table><tr><td>Kinetic energy</td><td id="rd-ke">–</td></tr><tr><td>Potential energy</td><td id="rd-pe">–</td></tr><tr><td>Total energy</td><td id="rd-tot">–</td></tr></table>
    <div class="btns"><button id="del">Delete</button></div>`;
  el.innerHTML = h;
  el.querySelectorAll("input").forEach(inp => inp.onchange = () => {
    const key = inp.dataset.key;
    if (inp.type === "checkbox") o.params[key] = inp.checked;
    else { const v = parseFloat(inp.value); if (isNaN(v)) { inp.value = o.params[key]; return; } o.params[key] = v; }
    changed();
  });
  document.getElementById("del").onclick = removeSelected;
}
function updateReadouts() {
  if (!selected || !result) return;
  const e = result.objects[selected.id]?.energy, i = frameIdx(); if (!e) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmt(v) + " J"; };
  set("rd-ke", e.ke[i]); set("rd-pe", e.pe[i]); set("rd-tot", e.total[i]);
}

let runTimer = null;
const scheduleRun = () => { clearTimeout(runTimer); runTimer = setTimeout(run, 120); };
function setStatus(msg, err) { const s = document.getElementById("status"); s.textContent = msg; s.className = err ? "err" : ""; }
async function run() {
  if (!objs.length) { result = null; setStatus(""); renderChips(); drawBoard(); drawScope(); return; }
  const payload = {
    gravity: parseFloat(document.getElementById("grav").value), t_end: parseFloat(document.getElementById("tend").value), fps: 60,
    objects: objs.map(o => ({id: o.id, type: o.type, params: o.type === "ball" ? {...o.params, height: Math.max(0.12, (floorY() - o.y) / S)} : o.params})),
  };
  if (!(payload.t_end > 0) || isNaN(payload.gravity)) { setStatus("Gravity and duration must be numbers.", true); return; }
  try {
    const res = await fetch("/api/simulate", {method: "POST", body: JSON.stringify(payload)});
    const data = await res.json();
    if (!res.ok) { setStatus(data.error, true); return; }
    result = data; tPlay = 0; setStatus(`${objs.length} object${objs.length > 1 ? "s" : ""} simulated by Python.`);
    renderChips(); drawBoard(); drawScope();
  } catch (err) { setStatus("Cannot reach the Python server. Is server.py still running?", true); }
}

function scopeSeries() {
  if (!result || !objs.length) return [];
  const o = selected || objs[0], r = result.objects[o.id]; if (!r) return [];
  if (scopeMode === "energy") return [["kinetic", r.energy.ke], ["potential", r.energy.pe], ["total", r.energy.total]].map(([n, d]) => ({key: n, name: n, data: d}));
  return Object.entries(r.signals).map(([n, d]) => ({key: n, name: n, data: d}));
}
function renderChips() {
  const el = document.getElementById("chips"); el.innerHTML = "";
  const o = selected || objs[0];
  if (o) { const t = document.createElement("span"); t.textContent = o.id + ":"; t.style.color = "var(--muted)"; el.append(t); }
  scopeSeries().forEach((s, i) => {
    const d = document.createElement("div"); d.className = "chip" + (hidden.has(s.key) ? " off" : "");
    d.innerHTML = `<i style="background:${COLORS[i % COLORS.length]}"></i>${s.name}`;
    d.onclick = () => { hidden.has(s.key) ? hidden.delete(s.key) : hidden.add(s.key); renderChips(); drawScope(); };
    el.append(d);
  });
}
function drawScope() {
  const W = scope.clientWidth, H = scope.clientHeight, dpr = devicePixelRatio || 1;
  if (scope.width !== W * dpr || scope.height !== H * dpr) { scope.width = W * dpr; scope.height = H * dpr; }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, W, H);
  sctx.font = "11.5px 'Avenir Next','Segoe UI',sans-serif";
  const all = scopeSeries(), shown = all.filter(s => !hidden.has(s.key));
  if (!result || !all.length) { sctx.fillStyle = css("--muted"); sctx.fillText("Place an object to see its motion and energy here.", 20, H / 2); return; }
  const L = 54, R = 14, T = 8, B = 22, pw = W - L - R, ph = H - T - B, t = result.t, t1 = t[t.length - 1];
  let lo = Infinity, hi = -Infinity;
  for (const s of shown) for (const v of s.data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * .08; lo -= pad; hi += pad;
  const X = x => L + x / t1 * pw, Y = y => T + (1 - (y - lo) / (hi - lo)) * ph;
  sctx.strokeStyle = "rgba(23,36,58,.12)"; sctx.fillStyle = css("--muted"); sctx.lineWidth = 1; sctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) { let v = lo + (hi - lo) * i / 4; if (Math.abs(v) < (hi - lo) * 1e-6) v = 0; const y = Y(v); sctx.beginPath(); sctx.moveTo(L, y); sctx.lineTo(L + pw, y); sctx.stroke(); sctx.fillText(fmt(v), L - 6, y + 4); }
  for (let i = 0; i <= 6; i++) { sctx.textAlign = i === 6 ? "right" : "center"; const tv = t1 * i / 6, x = X(tv); sctx.beginPath(); sctx.moveTo(x, T); sctx.lineTo(x, T + ph); sctx.stroke(); sctx.fillText(fmt(tv) + " s", x, H - 6); }
  if (lo < 0 && hi > 0) { sctx.strokeStyle = "rgba(23,36,58,.4)"; sctx.beginPath(); sctx.moveTo(L, Y(0)); sctx.lineTo(L + pw, Y(0)); sctx.stroke(); }
  all.forEach((s, i) => {
    if (hidden.has(s.key)) return;
    sctx.strokeStyle = COLORS[i % COLORS.length]; sctx.lineWidth = 2; sctx.beginPath();
    s.data.forEach((v, k) => k ? sctx.lineTo(X(t[k]), Y(v)) : sctx.moveTo(X(t[k]), Y(v))); sctx.stroke();
  });
  const px = X(t[frameIdx()]); sctx.strokeStyle = css("--ink"); sctx.lineWidth = 1.5; sctx.beginPath(); sctx.moveTo(px, T); sctx.lineTo(px, T + ph); sctx.stroke();
}
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => {
  scopeMode = b.dataset.mode; document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b)); renderChips(); drawScope();
});
scope.addEventListener("pointerdown", e => {
  if (!result) return; const r = scope.getBoundingClientRect(), f = (e.clientX - r.left - 54) / (r.width - 54 - 14);
  if (f >= 0 && f <= 1) { tPlay = f * result.t[result.t.length - 1]; drawBoard(); drawScope(); }
});

function togglePlay() { playing = !playing; document.getElementById("play").textContent = playing ? "Pause" : "Play"; }
document.getElementById("play").onclick = togglePlay;
document.getElementById("restart").onclick = () => { tPlay = 0; playing = true; document.getElementById("play").textContent = "Pause"; };
function loop(ts) {
  if (lastTs !== null && playing && result) {
    tPlay += (ts - lastTs) / 1000 * parseFloat(document.getElementById("speed").value);
    if (tPlay > result.t[result.t.length - 1]) tPlay = 0;
  }
  lastTs = ts;
  if (result) { drawBoard(); drawScope(); updateReadouts(); }
  requestAnimationFrame(loop);
}

const PRESETS = {
  "Simple pendulum": [["pendulum", 450, 100, {length: 2, angle: 40, damping: 0}]],
  "Pendulum race (3 lengths)": [["pendulum", 260, 80, {length: 1, angle: 30, damping: 0}], ["pendulum", 420, 80, {length: 1.5, angle: 30, damping: 0}], ["pendulum", 600, 80, {length: 2, angle: 30, damping: 0}]],
  "Mass on a spring": [["spring", 260, 60], ["spring", 420, 60, {k: 80}], ["spring", 560, 300, {horizontal: true, damping: 0.05}]],
  "Projectile bounce": [["ball", 80, 300, {speed: 7.5, angle: 55}], ["ball", 80, 360, {speed: 7, angle: 70, restitution: 0.9, mass: 0.5}]],
  "Chaotic double pendulum": [["double", 450, 170, {angle1: 120, angle2: -10}], ["double", 450, 170, {angle1: 120.5, angle2: -10}]],
  "Planet orbit": [["orbit", 450, 250], ["orbit", 450, 250, {distance: 1, speed_factor: 1}]],
};
function build(list) {
  objs = []; counters = {}; selected = null; result = null;
  list.forEach(([t, x, y, p]) => addObj(t, x, y, p));
  changed();
}
const presetSel = document.getElementById("preset");
Object.keys(PRESETS).forEach(k => presetSel.add(new Option(k, k)));
presetSel.onchange = () => { if (presetSel.value) build(PRESETS[presetSel.value]); };
document.getElementById("clear").onclick = () => { objs = []; counters = {}; selected = null; result = null; setStatus(""); renderInspector(); renderChips(); drawBoard(); drawScope(); };
for (const id of ["grav", "tend"]) document.getElementById(id).onchange = scheduleRun;
addEventListener("resize", () => { drawBoard(); drawScope(); scheduleRun(); });

renderInspector(); build(PRESETS["Simple pendulum"]); presetSel.value = "Simple pendulum";
requestAnimationFrame(loop);
