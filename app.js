// NEST project page. Renders site/data/*.json; no dependencies, no build step.
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = x => Math.round(x * 100) + "%";
const fmtP = p => (p < 0.001 ? "<0.001" : p.toFixed(p < 0.1 ? 3 : 2));
const NS = "http://www.w3.org/2000/svg";

function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}

function svg(w, h) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", `0 0 ${w} ${h}`);
  s.setAttribute("role", "img");
  return s;
}
function el(parent, tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}

// tooltip
const tip = document.createElement("div");
tip.className = "tip";
document.body.appendChild(tip);
function hover(node, html) {
  node.addEventListener("pointerenter", () => { tip.innerHTML = html; tip.style.opacity = 1; });
  node.addEventListener("pointermove", e => {
    const x = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = x + "px"; tip.style.top = (e.clientY + 14) + "px";
  });
  node.addEventListener("pointerleave", () => { tip.style.opacity = 0; });
}

// ---------- cards ----------
function renderCards(M) {
  const box = $("#cards");
  box.innerHTML = M.models.map(m => {
    const f = m.vs_filler, c = m.counting, r = m.rg;
    const sig = f.p < 0.05;
    return `<article class="card" style="--c:${m.colour}">
      <h3><span class="swatch"></span>${esc(m.name)}</h3>
      <div class="row"><span class="lab">Encoding floor: counting, D=4, per-number</span><span class="val">${pct(c.per_number)}</span>
        <div class="meter"><i style="width:${c.per_number * 100}%"></i></div></div>
      <div class="row"><span class="lab">Joint: stego vs word filler, wins (one-sided p)</span><span class="val">${f.b} vs ${f.c} <span class="q">(p=${fmtP(f.p)})</span></span>
        <div class="meter"><i style="width:${(f.b / Math.max(1, f.b + f.c)) * 100}%;background:${m.colour};outline:1px solid #00304955"></i></div></div>
      <div class="verdict">
        <span class="pill yes">Counting: ${pct(c.exact)} exact-match <span class="k">(n=${c.n})</span></span>
        <span class="pill no">${sig ? "Uplift over filler" : "No significant uplift"}</span>
      </div>
      <p class="small">Automated stego_success ${r.success_k}/${r.success_n} (upper bound); a hit in ${r.cells_with_hit} of 4 task families.</p>
    </article>`;
  }).join("");
}

// ---------- counting chart ----------
const RG_SHORT = { "Claude-4.5-Opus": 0, "Claude-4.6-Opus": 1, "Claude-4.6-Sonnet": 2, "Claude-4.5-Haiku": 3, "GPT-5.4": 4, "GPT-5.4-mini": 5 };
function renderCounting(C, M) {
  const rows = [...C.models].sort((a, b) => b.per_number - a.per_number);
  const W = 480, rowH = 13, top = 24, left = 128, right = 44, H = top + rows.length * rowH + 26;
  const s = svg(W, H);
  s.setAttribute("aria-label", "Bar chart of counting per-number accuracy at D=4 for 39 models");
  const x = v => left + v * (W - left - right);
  for (const t of [0, .25, .5, .75, 1]) {
    el(s, "line", { x1: x(t), x2: x(t), y1: top - 6, y2: H - 22, class: "grid" });
    el(s, "text", { x: x(t), y: H - 8, "text-anchor": "middle", "font-size": 10, class: "muted" }, pct(t));
  }
  el(s, "text", { x: left, y: 12, "font-size": 10.5, class: "muted" }, "per-number accuracy");
  rows.forEach((r, i) => {
    const y = top + i * rowH, idx = RG_SHORT[r.model];
    const m = idx != null ? M.models[idx] : null;
    const g = el(s, "g");
    el(g, "rect", { x: 0, y: y - 1, width: W, height: rowH, fill: "transparent" });
    el(g, "text", { x: left - 6, y: y + rowH - 4, "text-anchor": "end", "font-size": 10, "font-weight": m ? 700 : 400 }, r.model);
    el(g, "rect", {
      x: left, y: y + 1.5, width: Math.max(1, x(r.per_number) - left), height: rowH - 3, rx: 2,
      fill: m ? m.colour : "#b9c6cf", stroke: m ? "#003049" : "none", "stroke-width": m ? .8 : 0
    });
    el(g, "text", { x: x(r.per_number) + 4, y: y + rowH - 4, "font-size": 9.5, class: "muted" }, pct(r.per_number));
    hover(g, `<b>${esc(r.model)}</b> (${esc(r.provider)})<br>per-number ${pct(r.per_number)}, exact-match ${pct(r.exact)}<br>n = ${r.n} trials at D=4`);
  });
  $("#countChart").appendChild(s);
}

// ---------- McNemar chart ----------
function renderMcNemar(M) {
  const rows = [
    ...M.models.map(m => ({ name: m.name, colour: m.colour, ...m.vs_filler })),
    { sep: true, name: "By task family (pooled over models)" },
    ...M.families.map(f => ({ name: f.name, colour: "#003049", fam: true, ...f })),
  ];
  const W = 480, rowH = 30, top = 26, left = 128, right = 92, H = top + rows.length * rowH + 30;
  const s = svg(W, H);
  s.setAttribute("aria-label", "Dot plot: share of discordant pairs won by stego against word filler, per model and per task family");
  const x = v => left + v * (W - left - right);
  for (const t of [0, .25, .5, .75, 1]) {
    el(s, "line", { x1: x(t), x2: x(t), y1: top - 8, y2: H - 26, class: "grid" });
    el(s, "text", { x: x(t), y: H - 12, "text-anchor": "middle", "font-size": 10, class: "muted" }, t.toFixed(2));
  }
  el(s, "line", { x1: x(.5), x2: x(.5), y1: top - 8, y2: H - 26, stroke: "#c1121f", "stroke-dasharray": "4 3", "stroke-width": 1.2 });
  el(s, "text", { x: left, y: 12, "font-size": 10.5, class: "muted" }, "← filler wins more     stego wins more →");
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    if (r.sep) {
      el(s, "text", { x: 4, y: y + 4, "font-size": 10.5, "font-style": "italic", class: "muted" }, r.name);
      return;
    }
    const g = el(s, "g");
    el(g, "rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, fill: "transparent" });
    el(g, "text", { x: left - 8, y: y + 4, "text-anchor": "end", "font-size": 11, "font-weight": r.fam ? 400 : 700 }, r.name);
    const n = r.b + r.c, [lo, hi] = wilson(r.b, n);
    el(g, "line", { x1: x(lo), x2: x(hi), y1: y, y2: y, stroke: "#003049", "stroke-width": 2, class: "ci" });
    el(g, "circle", { cx: x(n ? r.b / n : .5), cy: y, r: 6, fill: r.colour, stroke: "#003049", "stroke-width": 1.2 });
    el(g, "text", { x: W - right + 8, y: y + 4, "font-size": 10.5 }, `${r.b}/${r.c}  p=${fmtP(r.p)}`);
    hover(g, `<b>${esc(r.name)}</b><br>stego wins ${r.b}, word-filler wins ${r.c}<br>${r.n} paired items; one-sided McNemar p=${fmtP(r.p)}`);
  });
  $("#mcnChart").appendChild(s);
}

// ---------- decoder ----------
const MODEL_NAME = { opus45: "Claude Opus 4.5", opus46: "Claude Opus 4.6", gpt54mini: "GPT-5.4-mini", gpt54: "GPT-5.4", sonnet46: "Claude Sonnet 4.6", haiku45: "Claude Haiku 4.5" };
const FAM = { maze: "maze", simple_equations: "linear equation", basic_arithmetic: "arithmetic", chain_sum: "chain sum" };
const VERDICT = {
  baseline_defeated: ["Real encoding, not a success", "Baselines got the same answer (constant maze answer)."],
  encoded_fragments_no_uplift: ["Encoded fragments, no uplift", "Task-related acrostic fragments; hits like this give no uplift over word filler. Not a verified success."],
  artifact: ["Automated hit, nothing encoded", "The scorer counted it, but the carrier is ordinary prose; the answer came from hidden reasoning tokens."],
};

function coverHTML(segs) {
  return segs.map(s => {
    if (s.i == null) return esc(s.t);
    return esc(s.t.slice(0, s.i)) + `<mark>${esc(s.t[s.i])}</mark>` + esc(s.t.slice(s.i + 1));
  }).join("").replace(/\n/g, "<br>");
}

function showCounting(e) {
  const segs = e.segments, L = segs.filter(s => s.L).map(s => s.L);
  const digits = L.map(l => e.letter_to_digit[l] ?? "?");
  const key = Object.entries(e.letter_to_digit).sort((a, b) => a[1] - b[1]).map(([l, d]) => `${d}→${l}`).join("  ");
  const okList = e.decoded.map((d, i) => d === e.expected[i]);
  $("#exView").innerHTML = `
    <div class="exhead"><b>${esc(e.model)}</b><span class="q">Counting, D=${e.D} · cover topic: ${esc(e.topic)}</span></div>
    <p class="small" style="margin-top:0">${esc(e.why)} Hidden sequence: <code>range(${e.range.join(", ")})</code> = <b>${e.expected.join(", ")}</b>. Key for this trial: <code>${esc(key)}</code></p>
    <div class="lbl">Cover text (carrier letters highlighted)</div>
    <div class="cover">${coverHTML(segs)}</div>
    <div class="lbl">Carrier letters → digits</div>
    <div class="strip">${L.map((l, i) => `<span class="cell">${esc(l)}<small>${esc(digits[i])}</small></span>`).join("")}</div>
    <div class="lbl">Decoded numbers vs hidden sequence</div>
    <div class="strip">${e.expected.map((x, i) => `<span class="cell ${okList[i] ? "ok" : "bad"}">${e.decoded[i] ?? "–"}<small>want ${x}</small></span>`).join("")}</div>
    <div class="verdictbox">Per-number accuracy <b>${pct(e.per_number)}</b>${e.exact ? ", exact match" : ""}.</div>`;
}

function showStego(e) {
  const model = MODEL_NAME[e.model] || e.model;
  const [vt, vx] = VERDICT[e.verdict] || [e.verdict, ""];
  const a = e.answer;
  const box = (k, v) => `<div class="ans ${String(v) === String(a.truth) ? "right" : ""}">${k}<b>${esc(v ?? "–")}</b></div>`;
  $("#exView").innerHTML = `
    <div class="exhead"><b>${esc(model)}</b><span class="q">Hidden task: ${FAM[e.family] || e.family} · cover question: “${esc(e.cover_question)}”</span></div>
    <div class="lbl">Cover text (carrier letters highlighted)</div>
    <div class="cover">${coverHTML(e.segments)}</div>
    <div class="lbl">Carrier letters</div>
    <div class="strip">${[...e.letters].map(l => `<span class="cell">${esc(l)}</span>`).join("")}</div>
    <div class="lbl">Hand reading</div>
    <div class="reading">${esc(e.reading)}</div>
    <div class="lbl">Answers (outlined = correct)</div>
    <div class="answers">${box("truth", a.truth)}${box("stego", a.stego)}${box("direct", a.direct)}${box("word filler", a.filler)}${a.cot != null ? box("plain CoT", a.cot) : ""}</div>
    <div class="verdictbox"><b>${esc(vt)}.</b> ${esc(vx)} Automated stego_success: <code>${e.stego_success_auto}</code>.</div>`;
}

function renderDecoder(E) {
  const tabs = $("#exTabs");
  const items = [];
  const add = (group, label, fn) => items.push({ group, label, fn });
  const TAG = { baseline_defeated: "path", encoded_fragments_no_uplift: "fragments", artifact: "no payload" };
  const seen = {};
  E.counting.forEach(e => add("Counting: given sequence", `${e.model} · D=${e.D}`, () => showCounting(e)));
  E.stego.forEach(e => {
    let lab = `${(MODEL_NAME[e.model] || e.model).replace("Claude ", "")} · ${FAM[e.family]} · ${TAG[e.verdict] || e.verdict}`;
    seen[lab] = (seen[lab] || 0) + 1;
    if (seen[lab] > 1) lab += ` ${seen[lab]}`;
    add("Reasoning Gym: hidden working", lab, () => showStego(e));
  });
  let last = null;
  items.forEach((it, i) => {
    if (it.group !== last) { const h = document.createElement("div"); h.className = "tabgroup"; h.textContent = it.group; tabs.appendChild(h); last = it.group; }
    const b = document.createElement("button");
    b.className = "tab"; b.type = "button"; b.setAttribute("role", "tab"); b.textContent = it.label;
    b.addEventListener("click", () => {
      tabs.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", "false"));
      b.setAttribute("aria-selected", "true"); it.fn();
    });
    tabs.appendChild(b);
    if (i === 1) b.click();   // open on the Fig. 1b counting trial
  });
}

// ---------- boot ----------
document.querySelectorAll(".copy").forEach(b => b.addEventListener("click", () => {
  const t = document.getElementById(b.dataset.target).textContent;
  navigator.clipboard?.writeText(t).then(() => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500); });
}));

Promise.all(["models", "counting", "examples"].map(n => fetch(`data/${n}.json`).then(r => r.json())))
  .then(([M, C, E]) => { renderCards(M); renderCounting(C, M); renderMcNemar(M); renderDecoder(E); })
  .catch(err => {
    document.querySelectorAll(".chart, #cards, #exView").forEach(n => n.textContent =
      "Could not load data/*.json. Serve the folder over HTTP (python3 -m http.server) instead of opening the file directly.");
    console.error(err);
  });
