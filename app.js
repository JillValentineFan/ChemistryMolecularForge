// MoleculeForge — game state, mode routing, UI orchestration.

import { MOLECULES, MOLECULE_BY_ID, CODEX_GROUPS, NOTATION_CATALOG, ELECTRON_GEOMETRIES, ELEMENTS, COLOR_LEGEND, VSEPR_FACTS, CPK } from "./molecules.js";
import { MoleculeRenderer } from "./renderer.js";
import { SFX, setMuted, unlockAudio } from "./audio.js";

// ============================================================
//   UTILITIES
// ============================================================
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN(arr, n) { return shuffle(arr).slice(0, n); }

function typewriter(el, text, speed = 28, onDone = null) {
  el.classList.add("typing");
  el.textContent = "";
  let i = 0;
  const step = () => {
    if (i >= text.length) {
      el.classList.remove("typing");
      onDone && onDone();
      return;
    }
    el.textContent += text[i++];
    setTimeout(step, speed);
  };
  step();
}

function tickNumber(el, from, to, ms = 350) {
  const start = performance.now();
  const animate = (now) => {
    const t = Math.min((now - start) / ms, 1);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(animate);
    else el.textContent = to;
  };
  requestAnimationFrame(animate);
}

// ============================================================
//   MODE ROUTING
// ============================================================
function showScreen(id) {
  $$(".screen").forEach(s => s.classList.remove("active"));
  $(`#${id}`).classList.add("active");
}

document.addEventListener("click", e => {
  const back = e.target.closest("[data-back]");
  if (back) {
    showScreen("main-menu");
    forge.reset(); polarityTrial.reset();
    return;
  }
  const action = e.target.closest("[data-action]");
  if (action) {
    const a = action.dataset.action;
    if (a === "legend")        { legend.open(); return; }
    if (a === "close-legend")  { legend.close(); return; }
  }
  // Click on legend backdrop closes it
  if (e.target.id === "legend-modal") { legend.close(); return; }

  const modeBtn = e.target.closest("[data-mode]");
  if (!modeBtn) return;
  const mode = modeBtn.dataset.mode;
  unlockAudio();
  if (mode === "forge")      { showScreen("forge-mode"); forge.start(); }
  else if (mode === "learn")      { showScreen("learn-mode"); learn.start(); }
  else if (mode === "polarity")   { showScreen("polarity-mode"); polarityTrial.start(); }
  else if (mode === "collection") { showScreen("collection-mode"); collection.render(); }
});

// Keyboard shortcuts: L = legend, Esc = close legend
document.addEventListener("keydown", e => {
  if (e.key === "l" || e.key === "L") {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    legend.toggle();
  } else if (e.key === "Escape") {
    legend.close();
  }
});

// Mute toggle
const muteCheckbox = $("#mute-checkbox");
muteCheckbox.addEventListener("change", e => {
  setMuted(!e.target.checked);
});

// ============================================================
//   COLLECTION (localStorage)
// ============================================================
const collection = (() => {
  const KEY = "moleculeforge_collection_v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }
  function save(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }
  function has(id)   { return load().includes(id); }
  function add(id)   { const arr = load(); if (!arr.includes(id)) { arr.push(id); save(arr); } }

  function render() {
    const grid = $("#collection-grid");
    const have = new Set(load());
    grid.innerHTML = "";
    for (const m of MOLECULES) {
      const collected = have.has(m.id);
      const card = document.createElement("div");
      card.className = "collection-card" + (collected ? " collected" : "");
      card.innerHTML = `
        <span class="lock">${collected ? "FORGED" : "LOCKED"}</span>
        <div class="collection-formula">${m.formula_html}</div>
        <div class="collection-name">${collected ? m.name.toUpperCase() : "????"}</div>
      `;
      grid.appendChild(card);
    }
    $("#collection-count").textContent = `${have.size} / ${MOLECULES.length}`;
  }

  return { has, add, render, load };
})();

// ============================================================
//   LEGEND MODAL
// ============================================================
const legend = (() => {
  let built = false;
  const modal = () => $("#legend-modal");

  function buildRow(swatchHex, label, note) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-swatch" style="background:${swatchHex}"></span>
      <div class="legend-text">
        <div class="legend-name">${label}</div>
        <div class="legend-note">${note}</div>
      </div>
    `;
    return row;
  }

  function build() {
    if (built) return;
    const orb = $("#legend-orbitals");
    for (const o of COLOR_LEGEND.orbitals) orb.appendChild(buildRow(o.color, o.label, o.note));

    const hyb = $("#legend-hybrids");
    for (const h of COLOR_LEGEND.hybrids) hyb.appendChild(buildRow(h.color, h.label, h.note));

    const sem = $("#legend-semantic");
    for (const s of COLOR_LEGEND.semantic) sem.appendChild(buildRow(s.color, s.label, s.note));

    const atoms = $("#legend-atoms");
    for (const sym of Object.keys(ELEMENTS)) {
      const el = ELEMENTS[sym];
      const cpk = CPK[sym];
      const hex = "#" + cpk.color.toString(16).padStart(6, "0");
      const note = `${el.name} · Z=${el.number} · valence ${el.valence} · EN ${el.electronegativity} — ${el.role}`;
      atoms.appendChild(buildRow(hex, sym + " — " + el.name, note));
    }
    built = true;
  }

  function open() {
    build();
    modal().classList.add("visible");
    modal().setAttribute("aria-hidden", "false");
  }
  function close() {
    modal().classList.remove("visible");
    modal().setAttribute("aria-hidden", "true");
  }
  function toggle() {
    if (modal().classList.contains("visible")) close();
    else open();
  }

  return { open, close, toggle };
})();

// ============================================================
//   FACT CARD (transient overlay, used in Forge mode)
// ============================================================
const factCard = (() => {
  let pool = [];   // shuffled, drained sequentially
  let timer = null;

  function refill() {
    pool = shuffle(VSEPR_FACTS.slice());
  }

  function next() {
    if (!pool.length) refill();
    return pool.pop();
  }

  function show(text, ms = 4200) {
    const card = $("#fact-card");
    const body = $("#fact-text");
    if (!card || !body) return;
    body.textContent = text;
    card.classList.add("visible");
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => card.classList.remove("visible"), ms);
  }

  function hide() {
    const card = $("#fact-card");
    if (card) card.classList.remove("visible");
    if (timer) { clearTimeout(timer); timer = null; }
  }

  return { show, hide, next };
})();

// ============================================================
//   QUESTION GENERATION
// ============================================================
function distractorNumbers(correct) {
  const pool = [2, 3, 4, 5, 6].filter(x => x !== correct);
  return pickN(pool, 3);
}

function makeNotationOptions(mol) {
  const correct = `${mol.ax_notation} • ${mol.molecular_geometry}`;
  // Plausible distractors with same electron group count when possible
  const sameEGCount = NOTATION_CATALOG.filter(c => {
    const ng = (c.notation.match(/X(\d+|₂|₃|₄|₅|₆)/) || [])[1];
    return true;
  });
  const all = NOTATION_CATALOG.map(c => `${c.notation} • ${c.geometry}`);
  const distractors = pickN(all.filter(s => s !== correct), 3);
  return shuffle([correct, ...distractors]);
}

function buildQuestions(mol) {
  return [
    {
      stage: 1,
      key: "electron_groups",
      text: `How many electron groups surround the central ${mol.central_atom}?`,
      options: shuffle([mol.electron_groups, ...distractorNumbers(mol.electron_groups)]).map(String),
      correct: String(mol.electron_groups),
      hint: `Count bonded atoms plus lone pairs on ${mol.central_atom}. (Multiple bonds count as ONE group.)`,
    },
    {
      stage: 2,
      key: "electron_geometry",
      text: `What is the electron geometry around ${mol.central_atom}?`,
      options: shuffle(ELECTRON_GEOMETRIES.slice()),
      correct: mol.electron_geometry,
      hint: `${mol.electron_groups} electron groups → ${mol.electron_geometry.toLowerCase()}.`,
    },
    {
      stage: 3,
      key: "molecular",
      text: `Select the AXₙEₘ notation and molecular geometry.`,
      options: makeNotationOptions(mol),
      correct: `${mol.ax_notation} • ${mol.molecular_geometry}`,
      hint: `Bonded atoms = ${mol.atoms.length - 1}, lone pairs = ${mol.lone_pairs}. Geometry = ${mol.molecular_geometry.toLowerCase()}.`,
    },
    {
      stage: 4,
      key: "polarity",
      text: `Is ${mol.formula_html} polar or nonpolar?`,
      options: ["Polar", "Nonpolar"],
      correct: mol.polar ? "Polar" : "Nonpolar",
      hint: mol.polar
        ? "Bond dipoles do not cancel. Geometry creates a net dipole."
        : "Bond dipoles cancel exactly by symmetry of the geometry.",
    },
  ];
}

// Difficulty-weighted bag of 12 molecules.
function buildForgeRun() {
  const easy   = MOLECULES.filter(m => m.difficulty === "easy");
  const medium = MOLECULES.filter(m => m.difficulty === "medium");
  const hard   = MOLECULES.filter(m => m.difficulty === "hard");
  const seq = [
    ...pickN(easy, Math.min(4, easy.length)),
    ...pickN(medium, Math.min(4, medium.length)),
    ...pickN(hard, Math.min(4, hard.length)),
  ];
  return seq.slice(0, 12);
}

// ============================================================
//   FORGE MODE
// ============================================================
const forge = (() => {
  let renderer = null;
  let runQueue = [];
  let runIndex = 0;
  let score = 0;
  let streak = 0;
  let perfectMolecules = 0;
  let currentMol = null;
  let currentQuestions = [];
  let qIndex = 0;
  let perMoleculeScore = 0;
  let wrongOnThisMol = false;
  let correctAnswerCounter = 0;   // global across run, used to surface VSEPR facts every 2 answers

  const els = {
    canvas:    () => $("#forge-canvas"),
    progress:  () => $("#forge-progress"),
    streak:    () => $("#forge-streak"),
    score:     () => $("#forge-score"),
    blueprint: () => $("#forge-blueprint"),
    name:      () => $("#forge-name"),
    formula:   () => $("#forge-formula"),
    silhouette:() => $("#forge-silhouette"),
    qCard:     () => $("#forge-question"),
    qStage:    () => $("#forge-stage"),
    qText:     () => $("#forge-question-text"),
    qOptions:  () => $("#forge-options"),
    qHint:     () => $("#forge-hint"),
    banner:    () => $("#forge-banner"),
    summary:   () => $("#forge-summary"),
    sumName:   () => $("#summary-name"),
    sumMeta:   () => $("#summary-meta"),
    sumExpl:   () => $("#summary-explanation"),
    final:     () => $("#forge-final"),
    finalStats:() => $("#final-stats"),
  };

  function ensureRenderer() {
    if (!renderer) renderer = new MoleculeRenderer(els.canvas(), { autoRotateAfterIdle: false });
    renderer.setAutoRotate(false); // off during questions
    renderer.onResize();
  }

  function setProgressDisplay() {
    els.progress().textContent = `Molecule ${runIndex + 1} / ${runQueue.length}`;
    els.streak().textContent = streak >= 1 ? `Streak ×${streak}` : "";
  }

  function setScore(newScore, animate = true) {
    if (animate) tickNumber(els.score(), score, newScore);
    else els.score().textContent = newScore;
    score = newScore;
  }

  // ---------- Run lifecycle ----------
  function start() {
    ensureRenderer();
    runQueue = buildForgeRun();
    runIndex = 0;
    score = 0;
    streak = 0;
    perfectMolecules = 0;
    correctAnswerCounter = 0;
    factCard.hide();
    setScore(0, false);
    hide(els.summary()); hide(els.final()); hide(els.banner());
    nextMolecule();
  }

  function reset() {
    if (renderer) renderer.clearMolecule();
    hide(els.qCard()); hide(els.summary()); hide(els.final()); hide(els.banner());
    els.blueprint().classList.remove("visible");
  }

  function nextMolecule() {
    if (runIndex >= runQueue.length) return finishRun();
    currentMol = runQueue[runIndex];
    currentQuestions = buildQuestions(currentMol);
    qIndex = 0;
    perMoleculeScore = 100;
    wrongOnThisMol = false;

    setProgressDisplay();
    renderer.clearMolecule();
    renderer.setMolecule(currentMol);
    renderer.setAutoRotate(false);
    hide(els.summary()); hide(els.qCard()); hide(els.banner());

    // Reveal blueprint with typewriter
    els.silhouette().textContent = currentMol.atoms.length + " atoms · " + currentMol.electron_groups + " electron groups";
    els.formula().innerHTML = currentMol.formula_html;
    els.blueprint().classList.add("visible");
    typewriter(els.name(), currentMol.name.toUpperCase(), 26, () => {
      // Pulse platform = brief halo opacity flash via SFX cue
      SFX.tick();
      setTimeout(askCurrent, 300);
    });
  }

  function askCurrent() {
    if (qIndex >= currentQuestions.length) return finishMolecule();
    const q = currentQuestions[qIndex];
    const card = els.qCard();
    els.qStage().textContent = `Stage ${q.stage} / 4`;
    els.qText().innerHTML = q.text;
    els.qHint().classList.remove("visible");
    els.qHint().textContent = "";

    const opts = els.qOptions();
    opts.innerHTML = "";
    for (const optText of q.options) {
      const b = document.createElement("button");
      b.className = "answer-option";
      b.innerHTML = optText;
      b.addEventListener("click", () => answer(b, q, optText));
      opts.appendChild(b);
    }
    show(card);
  }

  function answer(btn, q, choice) {
    if (btn.classList.contains("correct") || btn.classList.contains("dimmed")) return;
    const correct = (choice === q.correct);
    if (correct) {
      btn.classList.add("correct");
      $$(".answer-option", els.qOptions()).forEach(b => { if (b !== btn) b.classList.add("dimmed"); });
      SFX.correct();
      correctAnswerCounter++;
      // Brief anticipation beat before assembly fires — earned, not instant.
      setTimeout(() => runStageAnimation(q.stage), 240);
      // Per-stage post-animation breath: longer for stages with longer animations.
      // Stage 4 dipole sequence: 400 fade-in + 700 hold + 420 fade-out + 480 anticipation + 420 reveal = 2420ms
      const postDelay = q.stage === 1 ? 1100
                      : q.stage === 2 ? 1000
                      : q.stage === 3 ? 1400
                      : 2900;
      // Every 2 correct answers across the run: surface a VSEPR fact while the stage animation plays.
      if (correctAnswerCounter % 2 === 0) {
        setTimeout(() => factCard.show(factCard.next()), 600);
      }
      setTimeout(() => {
        slideOutQ(() => { qIndex++; askCurrent(); });
      }, postDelay);
    } else {
      btn.classList.add("wrong");
      SFX.wrong();
      perMoleculeScore = Math.max(0, perMoleculeScore - 10);
      wrongOnThisMol = true;
      els.qHint().textContent = q.hint;
      els.qHint().classList.add("visible");
    }
  }

  function slideOutQ(after) {
    const c = els.qCard();
    c.classList.add("exiting");
    c.classList.remove("visible");
    setTimeout(() => {
      c.classList.remove("exiting");
      after && after();
    }, 320);
  }

  // ---------- Assembly per stage ----------
  function runStageAnimation(stage) {
    if (!currentMol) return;
    if (stage === 1) {
      // Materialize central atom
      const central = currentMol.atoms[0];
      renderer.addCentralAtom(central.element, central.position, true, () => SFX.atomMaterialize());
      SFX.atomMaterialize();
    } else if (stage === 2) {
      // Electron-domain guides (skeleton): use directions of all atoms after [0] AND lone pair positions
      const central = currentMol.atoms[0].position;
      const dirs = [];
      for (let i = 1; i < currentMol.atoms.length; i++) {
        const p = currentMol.atoms[i].position;
        dirs.push([p[0]-central[0], p[1]-central[1], p[2]-central[2]]);
      }
      for (const lp of currentMol.lone_pair_positions) {
        dirs.push([lp[0]-central[0], lp[1]-central[1], lp[2]-central[2]]);
      }
      renderer.showGuideLines(dirs, central);
    } else if (stage === 3) {
      // Atoms fly in + bonds grow + lone pairs after
      renderer.addBondedAtoms(currentMol.atoms, currentMol.bonds, currentMol.bond_orders, 0, () => {
        SFX.bondSnap();
        if (currentMol.lone_pair_positions.length) {
          setTimeout(() => renderer.addLonePairs(currentMol.lone_pair_positions, currentMol.atoms[0].position), 150);
        }
        if (currentMol.charge) {
          setTimeout(() => renderer.addChargeBadge(currentMol.charge), 250);
        }
      });
      // Subtle staggered bond snap clicks
      setTimeout(() => SFX.bondSnap(), 220);
      setTimeout(() => SFX.bondSnap(), 480);
    } else if (stage === 4) {
      renderer.showDipoles(currentMol, currentMol.polar);
    }
  }

  function finishMolecule() {
    hide(els.qCard());
    if (!wrongOnThisMol) perfectMolecules++;
    else                 perfectMolecules = 0; // streak of perfect molecules

    // Streak bonus: 3 perfect in a row → +100, then reset counter
    let bonus = 0;
    if (perfectMolecules >= 3) {
      bonus = 100;
      perfectMolecules = 0;
      streak++;
    } else if (wrongOnThisMol) {
      streak = 0;
    }

    const newScore = score + perMoleculeScore + bonus;
    setScore(newScore);

    // Banner — fires after stage 4 dipole animation has completed (post-delay handled the wait).
    const banner = els.banner();
    banner.innerHTML = `FORGED: ${currentMol.name}`;
    show(banner);
    SFX.forgeComplete();
    // Now the molecule is intentional; let it gently rotate while user reads summary.
    renderer.setAutoRotate(true);
    setTimeout(() => hide(banner), 2000);

    // Summary
    setTimeout(() => {
      els.sumName().innerHTML = `<strong>${currentMol.name}</strong> &nbsp; <span style="color:var(--amber)">${currentMol.formula_html}</span>`;
      els.sumMeta().textContent =
        `${currentMol.ax_notation}  •  ${currentMol.molecular_geometry}  •  ${currentMol.bond_angle_actual}  •  ${currentMol.hybridization}  •  ${currentMol.polar ? "Polar" : "Nonpolar"}`;
      els.sumExpl().innerHTML = currentMol.explanation + "<br><br><em style='color:var(--text-dim)'>" + currentMol.pedagogy_note + "</em>";

      const collectBtn = $("#btn-collect");
      collectBtn.textContent = collection.has(currentMol.id) ? "Already Collected ✓" : "Add to Collection";
      collectBtn.disabled = collection.has(currentMol.id);
      collectBtn.onclick = () => {
        collection.add(currentMol.id);
        collectBtn.textContent = "Collected ✓";
        collectBtn.disabled = true;
        SFX.correct();
      };
      $("#btn-next").onclick = () => {
        hide(els.summary());
        runIndex++;
        setTimeout(nextMolecule, 350);
      };

      show(els.summary());
    }, 2100);
  }

  function finishRun() {
    hide(els.summary());
    const stats = els.finalStats();
    stats.innerHTML = `
      <div>Final Score: <span class="stat-value">${score}</span></div>
      <div>Molecules Forged: <span class="stat-value">${runQueue.length}</span></div>
      <div>Streak Bonuses: <span class="stat-value">×${streak}</span></div>
    `;
    show(els.final());
  }

  function show(el) { el.classList.add("visible"); el.style.display = ""; }
  function hide(el) { el.classList.remove("visible"); }

  return { start, reset };
})();

// ============================================================
//   LEARN MODE
// ============================================================
const learn = (() => {
  let renderer = null;
  let currentMol = null;

  function ensureRenderer() {
    if (!renderer) renderer = new MoleculeRenderer($("#learn-canvas"), { autoRotateAfterIdle: true });
    renderer.setLabelsVisible(true);
    renderer.onResize();
  }

  function buildList() {
    const list = $("#codex-list");
    list.innerHTML = "";
    for (const grp of CODEX_GROUPS) {
      if (!grp.molecules.length) continue;
      const g = document.createElement("div");
      g.className = "codex-group";
      g.innerHTML = `<div class="codex-group-name">${grp.name}</div>`;
      for (const m of grp.molecules) {
        const item = document.createElement("div");
        item.className = "codex-item";
        item.dataset.id = m.id;
        item.innerHTML = `
          <span>${m.name}</span>
          <span class="codex-item-formula">${m.formula_html}</span>
        `;
        item.addEventListener("click", () => selectMol(m.id));
        g.appendChild(item);
      }
      list.appendChild(g);
    }
  }

  function selectMol(id) {
    $$(".codex-item").forEach(i => i.classList.toggle("active", i.dataset.id === id));
    const m = MOLECULE_BY_ID[id];
    currentMol = m;
    renderer.buildFullMolecule(m, { showDipoles: false, animate: true });
    renderer.setLabelsVisible(true);
    $("#btn-labels").textContent = "Labels: ON";
    $("#btn-angles").textContent = "Bond Angles: OFF";
    renderer.setAnglesVisible(false);
    renderInfo(m);
  }

  function renderInfo(m) {
    const panel = $("#learn-info");
    const hybridEntry = COLOR_LEGEND.hybrids.find(h => h.key === m.hybridization);
    const lobeColor = hybridEntry ? hybridEntry.color : "#a855f7";
    const lobeNote  = hybridEntry ? hybridEntry.note  : "";

    // Unique elements in this molecule with role breakdown
    const seen = new Set();
    const atomRows = m.atoms.map((a, idx) => {
      if (seen.has(a.element)) return null;
      seen.add(a.element);
      const el = ELEMENTS[a.element];
      if (!el) return null;
      const cpkHex = "#" + (CPK[a.element]?.color ?? 0x888888).toString(16).padStart(6, "0");
      const role = idx === 0 ? "central atom" : "bonded atom";
      return `
        <div class="atom-row">
          <span class="atom-dot" style="background:${cpkHex}"></span>
          <div class="atom-info">
            <div class="atom-line"><strong>${a.element}</strong> · ${el.name} <span class="atom-role">(${role})</span></div>
            <div class="atom-meta">Z=${el.number} · valence ${el.valence} · EN ${el.electronegativity} · period ${el.period}</div>
            <div class="atom-role-note">${el.role}</div>
          </div>
        </div>`;
    }).filter(Boolean).join("");

    panel.innerHTML = `
      <div class="info-name">${m.name}${m.charge ? ` <sup>${m.charge}</sup>` : ""}</div>
      <div class="info-formula">${m.formula_html}</div>
      <dl class="info-grid">
        <dt>Electron Groups</dt><dd>${m.electron_groups}</dd>
        <dt>Lone Pairs</dt><dd>${m.lone_pairs}</dd>
        <dt>AXₙEₘ</dt><dd>${m.ax_notation}</dd>
        <dt>Electron Geom.</dt><dd>${m.electron_geometry}</dd>
        <dt>Molecular Geom.</dt><dd>${m.molecular_geometry}</dd>
        <dt>Ideal Angle</dt><dd>${m.bond_angle_ideal}</dd>
        <dt>Actual Angle</dt><dd>${m.bond_angle_actual}</dd>
        <dt>Hybridization</dt><dd>
          <span class="hybrid-pill" style="background:${lobeColor}1f;border-color:${lobeColor}">
            <span class="hybrid-dot" style="background:${lobeColor}"></span>${m.hybridization}
          </span>
        </dd>
        <dt>Polarity</dt><dd>${m.polar ? `<span style="color:var(--pink)">Polar</span>` : `<span style="color:var(--green)">Nonpolar</span>`}</dd>
      </dl>
      <div class="info-section-label">Lobe Color</div>
      <div class="info-lobe-note">${lobeNote}</div>
      <div class="info-section-label">Atoms</div>
      <div class="atom-list">${atomRows}</div>
      <div class="info-section-label">Why This Shape</div>
      <div class="info-pedagogy">${m.pedagogy_note}</div>
    `;
  }

  function start() {
    ensureRenderer();
    buildList();
    selectMol(MOLECULES[0].id);

    $("#btn-labels").onclick = () => {
      renderer.labelsVisible = !renderer.labelsVisible;
      renderer.setLabelsVisible(renderer.labelsVisible);
      $("#btn-labels").textContent = `Labels: ${renderer.labelsVisible ? "ON" : "OFF"}`;
    };
    $("#btn-angles").onclick = () => {
      renderer.anglesVisible = !renderer.anglesVisible;
      renderer.setAnglesVisible(renderer.anglesVisible);
      $("#btn-angles").textContent = `Bond Angles: ${renderer.anglesVisible ? "ON" : "OFF"}`;
    };
  }

  return { start };
})();

// ============================================================
//   POLARITY TRIAL
// ============================================================
const polarityTrial = (() => {
  let renderer = null;
  let queue = [];
  let idx = 0;
  let score = 0;
  let correctCount = 0;
  let totalMs = 0;
  let timerStart = 0;
  let timerInterval = null;
  let answered = false;
  const TRIAL_LEN = 8;
  const PER_MOL_MS = 15000;

  function ensureRenderer() {
    if (!renderer) renderer = new MoleculeRenderer($("#polarity-canvas"), { autoRotateAfterIdle: false });
    renderer.setLabelsVisible(false);
    renderer.onResize();
  }

  function start() {
    ensureRenderer();
    queue = pickN(MOLECULES, TRIAL_LEN);
    idx = 0; score = 0; correctCount = 0; totalMs = 0;
    $("#trial-score").textContent = "0";
    $("#trial-final").classList.remove("visible");
    $("#trial-prompt").style.display = "";
    nextMol();
  }

  function reset() {
    stopTimer();
    if (renderer) renderer.clearMolecule();
  }

  function nextMol() {
    if (idx >= queue.length) return finish();
    const m = queue[idx];
    answered = false;
    $("#trial-progress").textContent = `${idx + 1} / ${queue.length}`;
    $("#trial-formula").innerHTML = m.formula_html;
    $("#trial-result").textContent = "";
    $("#trial-result").className = "trial-result";

    renderer.buildFullMolecule(m, { showDipoles: false, animate: true });
    startTimer();
  }

  function startTimer() {
    timerStart = performance.now();
    const fill = $("#trial-timer-fill");
    fill.style.width = "100%";
    fill.style.background = "var(--cyan)";
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const elapsed = performance.now() - timerStart;
      const rem = Math.max(0, PER_MOL_MS - elapsed);
      const pct = (rem / PER_MOL_MS) * 100;
      fill.style.width = pct + "%";
      if (pct < 30) fill.style.background = "var(--red)";
      else if (pct < 60) fill.style.background = "var(--amber)";
      if (rem <= 0) {
        clearInterval(timerInterval);
        if (!answered) handleAnswer(null);
      }
    }, 50);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function handleAnswer(choice) {
    if (answered) return;
    answered = true;
    stopTimer();
    const m = queue[idx];
    const elapsed = performance.now() - timerStart;
    totalMs += elapsed;

    let correct = false;
    if (choice === null) {
      $("#trial-result").textContent = "Time up!";
      $("#trial-result").classList.add("wrong");
    } else {
      correct = (choice === "polar") === m.polar;
      if (correct) {
        correctCount++;
        score += 100 + Math.max(0, Math.floor((PER_MOL_MS - elapsed) / 100));
        $("#trial-result").textContent = `Correct — ${m.polar ? "polar" : "nonpolar"} (${m.molecular_geometry})`;
        $("#trial-result").classList.add("correct");
        SFX.correct();
      } else {
        $("#trial-result").textContent = `Wrong — actually ${m.polar ? "polar" : "nonpolar"}`;
        $("#trial-result").classList.add("wrong");
        SFX.wrong();
      }
      tickNumber($("#trial-score"), parseInt($("#trial-score").textContent), score);
    }

    // Show dipole animation (full sequence: fade-in → hold → fade-out → beat → reveal ≈ 2420ms)
    renderer.showDipoles(m, m.polar);

    setTimeout(() => {
      idx++;
      nextMol();
    }, 2900);
  }

  function finish() {
    $("#trial-prompt").style.display = "none";
    const acc = ((correctCount / queue.length) * 100).toFixed(0);
    const avgMs = (totalMs / queue.length / 1000).toFixed(1);
    $("#trial-stats").innerHTML = `
      <div>Score: <span class="stat-value">${score}</span></div>
      <div>Accuracy: <span class="stat-value">${correctCount} / ${queue.length} (${acc}%)</span></div>
      <div>Avg Response: <span class="stat-value">${avgMs}s</span></div>
    `;
    $("#trial-final").classList.add("visible");
  }

  // Wire buttons once
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-answer]");
    if (!btn) return;
    if (!$("#polarity-mode").classList.contains("active")) return;
    handleAnswer(btn.dataset.answer);
  });

  return { start, reset };
})();

// ============================================================
//   INITIAL UI BOOTSTRAP
// ============================================================
collection.render(); // pre-populate the count badge
setMuted(true);      // muted by default per spec; checkbox starts checked = sound enabled? -> match checkbox state
setMuted(!$("#mute-checkbox").checked);

// Debug: arrow keys cycle through molecules in Learn mode (per implementation order step 4).
window.addEventListener("keydown", e => {
  if (!$("#learn-mode").classList.contains("active")) return;
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const items = $$(".codex-item");
  if (!items.length) return;
  let idx = items.findIndex(i => i.classList.contains("active"));
  if (idx < 0) idx = 0;
  idx = (idx + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
  items[idx].click();
});
