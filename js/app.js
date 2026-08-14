(function () {
  const canvas = document.getElementById("circle");
  const ctx = canvas.getContext("2d");
  let size = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const state = {
    sigilId: null,
    signs: [],
    ringComplete: false,
    livePath: null,
  };

  let drawing = false;
  let rawPoints = []; // client-space points for the in-progress stroke

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    size = Math.floor(Math.min(rect.width, rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(canvas.parentElement);

  function render() {
    drawScene(ctx, size, state);
  }

  setImageLoadedCallback(render);

  function recompute() {
    const result = composeSpell(state);
    renderReadout(result);
    render();
    return result;
  }

  function ringRadius() {
    return size * RING_RATIO;
  }

  function toLocal(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left - size / 2, y: clientY - rect.top - size / 2 };
  }

  function pathLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return total;
  }

  // ---- Palette: sigils ----
  const sigilPalette = document.getElementById("sigil-palette");
  SIGILS.forEach((sigil) => {
    const btn = document.createElement("button");
    btn.className = "chip chip-image";
    btn.dataset.sigil = sigil.id;
    const img = document.createElement("img");
    img.src = sigil.image;
    img.alt = "";
    const label = document.createElement("span");
    label.textContent = sigil.name;
    btn.append(img, label);
    btn.addEventListener("click", () => {
      state.sigilId = sigil.id;
      [...sigilPalette.children].forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      recompute();
    });
    sigilPalette.appendChild(btn);
  });

  // ---- Sign shape guide (reference only, drawing is what selects the archetype) ----
  const signPalette = document.getElementById("sign-palette");
  SIGN_ARCHETYPES.forEach((archetype) => {
    const row = document.createElement("div");
    row.className = "shape-guide-row";
    const img = document.createElement("img");
    img.src = archetype.image;
    img.alt = "";
    img.className = "shape-guide-thumb";
    const text = document.createElement("div");
    const name = document.createElement("span");
    name.className = "shape-guide-name";
    name.textContent = archetype.name;
    const hint = document.createElement("span");
    hint.className = "shape-guide-hint";
    hint.textContent = archetype.short;
    text.append(name, hint);
    row.append(img, text);
    signPalette.appendChild(row);
  });

  // ---- Freehand stroke capture: draw anywhere, any shape, any length ----
  // No archetype is picked beforehand. The shape you draw is classified after
  // the stroke ends, in engine/classify.js.
  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    rawPoints = [toLocal(e.clientX, e.clientY)];
    state.livePath = rawPoints;
    render();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = toLocal(e.clientX, e.clientY);
    const last = rawPoints[rawPoints.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return; // skip near-duplicate points
    rawPoints.push(p);
    state.livePath = rawPoints;
    render();
  });

  const lastDrawnEl = document.getElementById("last-drawn");

  function finishStroke() {
    if (!drawing) return;
    drawing = false;
    state.livePath = null;
    if (rawPoints.length < 2 || pathLength(rawPoints) < 8) {
      // too short to be a deliberate stroke, discard rather than guess
      rawPoints = [];
      render();
      return;
    }

    const archetypeId = classifyStroke(rawPoints);
    const start = rawPoints[0];
    const end = rawPoints[rawPoints.length - 1];
    const angle = Vector.angle(end.x, end.y);
    const length = Math.max(0.15, Math.min(1.4, pathLength(rawPoints) / ringRadius()));
    const distFromCenterStart = Math.hypot(start.x, start.y);
    const distFromCenterEnd = Math.hypot(end.x, end.y);
    const inverted = distFromCenterEnd < distFromCenterStart; // drawn inward = pull

    state.signs.push({
      archetypeId,
      angle,
      length,
      inverted,
      path: rawPoints.slice(),
    });
    rawPoints = [];
    const archetype = getArchetype(archetypeId);
    lastDrawnEl.textContent = `Read as: ${archetype.name} (${archetype.short})`;
    renderSignList();
    recompute();
  }

  canvas.addEventListener("pointerup", finishStroke);
  canvas.addEventListener("pointercancel", finishStroke);

  // ---- Ring completion toggle ----
  const ringToggle = document.getElementById("ring-toggle");
  ringToggle.addEventListener("click", () => {
    state.ringComplete = !state.ringComplete;
    ringToggle.classList.toggle("active", state.ringComplete);
    ringToggle.textContent = state.ringComplete ? "Ring closed" : "Ring open";
    recompute();
  });

  // ---- Placed signs list (fine control + accessible alternative to drawing) ----
  const signList = document.getElementById("sign-list");
  function renderSignList() {
    signList.innerHTML = "";
    if (state.signs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No signs drawn yet. Draw a stroke anywhere on the circle.";
      signList.appendChild(empty);
      return;
    }
    state.signs.forEach((instance, i) => {
      const archetype = getArchetype(instance.archetypeId);
      const row = document.createElement("div");
      row.className = "sign-row";

      const thumb = document.createElement("img");
      thumb.className = "sign-row-thumb";
      thumb.src = archetype.image;
      thumb.alt = "";
      row.appendChild(thumb);

      const label = document.createElement("span");
      label.className = "sign-row-label";
      let orientation = "";
      if (instance.archetypeId === "column") orientation = instance.inverted ? " · pull" : " · push";
      if (["pull", "direction", "collection"].includes(instance.archetypeId)) orientation = " · inward";
      label.textContent = `${Math.round(Vector.toBearing(instance.angle))}°${orientation}`;
      row.appendChild(label);

      const candidates = bucketCandidates(instance.archetypeId);
      if (candidates.length > 1) {
        const select = document.createElement("select");
        select.className = "sign-row-select";
        candidates.forEach((id) => {
          const opt = document.createElement("option");
          opt.value = id;
          opt.textContent = getArchetype(id).name;
          if (id === instance.archetypeId) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => {
          instance.archetypeId = select.value;
          renderSignList();
          recompute();
        });
        row.appendChild(select);
      } else {
        const name = document.createElement("span");
        name.className = "sign-row-name";
        name.textContent = archetype.name;
        row.appendChild(name);
      }

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0.15";
      slider.max = "1.4";
      slider.step = "0.01";
      slider.value = String(instance.length);
      slider.addEventListener("input", () => {
        instance.length = parseFloat(slider.value);
        recompute();
      });
      row.appendChild(slider);

      const removeBtn = document.createElement("button");
      removeBtn.className = "mini-btn danger";
      removeBtn.textContent = "remove";
      removeBtn.addEventListener("click", () => {
        state.signs.splice(i, 1);
        renderSignList();
        recompute();
      });
      row.appendChild(removeBtn);

      signList.appendChild(row);
    });
  }

  // ---- Readout ----
  const readoutEl = document.getElementById("readout");
  function renderReadout(result) {
    const { params, warnings, label, ok } = result;
    const dirText = params.hasDirection
      ? `${Vector.compassLabel(params.direction)} (${Math.round(Vector.toBearing(params.direction))}°)`
      : "none";
    readoutEl.innerHTML = `
      <dl>
        <dt>Element</dt><dd>${result.sigil ? result.sigil.name : "none"}</dd>
        <dt>Direction</dt><dd>${dirText}</dd>
        <dt>Skew</dt><dd>${params.magnitude.toFixed(2)}</dd>
        <dt>Spread</dt><dd>${params.spreadRatio.toFixed(2)}</dd>
        <dt>Sustain</dt><dd>${params.sustainRatio.toFixed(2)}</dd>
        <dt>Intensity</dt><dd>${params.intensity.toFixed(2)}</dd>
      </dl>
      <p class="effect-label">${label}</p>
      ${warnings.length ? `<ul class="warnings">${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>` : ""}
      <p class="status ${ok ? "ok" : "warn"}">${ok ? "stable" : "unstable"}</p>
    `;
  }

  // ---- Cast ----
  document.getElementById("cast-btn").addEventListener("click", () => {
    const result = composeSpell(state);
    castEffect(canvas, size, result.params, result.sigil, state);
  });

  // ---- Save / Grimoire ----
  const grimoireList = document.getElementById("grimoire-list");
  const nameInput = document.getElementById("spell-name");

  function refreshGrimoire() {
    const entries = Grimoire.list();
    grimoireList.innerHTML = "";
    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Grimoire is empty.";
      grimoireList.appendChild(empty);
      return;
    }
    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "grimoire-row";
      const title = document.createElement("button");
      title.className = "grimoire-title";
      title.textContent = entry.name;
      title.addEventListener("click", () => {
        state.sigilId = entry.sigilId;
        state.signs = JSON.parse(JSON.stringify(entry.signs));
        state.ringComplete = true;
        ringToggle.classList.add("active");
        ringToggle.textContent = "Ring closed";
        [...sigilPalette.children].forEach((c) => c.classList.toggle("active", c.dataset.sigil === entry.sigilId));
        renderSignList();
        recompute();
      });
      row.appendChild(title);

      const codeBtn = document.createElement("button");
      codeBtn.className = "mini-btn";
      codeBtn.textContent = "copy code";
      codeBtn.addEventListener("click", async () => {
        const code = Grimoire.encode(entry.name, entry);
        await navigator.clipboard.writeText(code);
        codeBtn.textContent = "copied";
        setTimeout(() => (codeBtn.textContent = "copy code"), 1200);
      });
      row.appendChild(codeBtn);

      const delBtn = document.createElement("button");
      delBtn.className = "mini-btn danger";
      delBtn.textContent = "delete";
      delBtn.addEventListener("click", () => {
        Grimoire.remove(entry.id);
        refreshGrimoire();
      });
      row.appendChild(delBtn);

      grimoireList.appendChild(row);
    });
  }

  document.getElementById("save-btn").addEventListener("click", () => {
    const name = nameInput.value.trim() || "Unnamed spell";
    Grimoire.save(name, state);
    nameInput.value = "";
    refreshGrimoire();
  });

  // ---- Import by code ----
  document.getElementById("import-btn").addEventListener("click", () => {
    const code = document.getElementById("import-code").value;
    const decoded = Grimoire.decode(code);
    if (!decoded) {
      alert("Code didn't decode into a spell.");
      return;
    }
    state.sigilId = decoded.sigilId;
    state.signs = decoded.signs;
    state.ringComplete = true;
    ringToggle.classList.add("active");
    ringToggle.textContent = "Ring closed";
    [...sigilPalette.children].forEach((c) => c.classList.toggle("active", c.dataset.sigil === decoded.sigilId));
    renderSignList();
    recompute();
    document.getElementById("import-code").value = "";
  });

  // ---- Spellbook gallery ----
  const spellbookEl = document.getElementById("spellbook");
  SPELLBOOK.forEach((spell) => {
    const card = document.createElement("figure");
    card.className = "spellbook-card";
    const img = document.createElement("img");
    img.src = spell.image;
    img.alt = spell.name;
    img.loading = "lazy";
    const caption = document.createElement("figcaption");
    const title = document.createElement("span");
    title.className = "spellbook-title";
    title.textContent = spell.name;
    caption.appendChild(title);
    if (spell.description) {
      const desc = document.createElement("span");
      desc.className = "spellbook-desc";
      desc.textContent = spell.description;
      caption.appendChild(desc);
    }
    card.append(img, caption);
    spellbookEl.appendChild(card);
  });

  // ---- init ----
  renderSignList();
  refreshGrimoire();
  recompute();
  resizeCanvas();
})();
