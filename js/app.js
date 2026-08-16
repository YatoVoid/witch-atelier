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
    groupPaths: [],
  };

  // First-visit calibration: walks through drawing examples of each named
  // sign, not just the underlying shape categories the point-cloud matcher
  // trains on (see js/training.js) -- shape alone can't tell same-family
  // signs apart (Bend vs Direction, Column vs Enlarge, ...), so calibrating
  // only the shapes left every family stuck on its one hardcoded default.
  // Shown once on first visit if there's no saved training data and it
  // hasn't been dismissed; also reachable any time after via the
  // Recalibrate button in the Shape guide, since handwriting drifts and a
  // family's preferred default is worth revisiting without re-triggering
  // the full first-visit banner.
  const ONBOARDING_KEY = "witch-atelier:onboarding-dismissed";
  const QUICK_CALIBRATION_REPS = 2;
  let calibrationRepCount = QUICK_CALIBRATION_REPS;
  let calibration = null; // { signIndex, rep } while active, else null

  // Every sign the "wrong reading?" panel can set, built from
  // SIGN_BUCKETS rather than a separate list, so it can't drift out of
  // sync with classify.js's family membership.
  const FAMILY_TRAIN_LABEL = { straightOut: "straight", straightIn: "straight", wavy: "wavy" };
  const SIGN_TRAIN_LABEL_OVERRIDE = { bend: "bend", direction: "bend", bird: "bend", bolt: "bolt" };
  const CORRECTION_FAMILIES = Object.keys(SIGN_BUCKETS).flatMap((familyKey) =>
    SIGN_BUCKETS[familyKey].map((archetypeId) => {
      const trainLabel = SIGN_TRAIN_LABEL_OVERRIDE[archetypeId] || FAMILY_TRAIN_LABEL[familyKey];
      return {
        archetypeId,
        name: getArchetype(archetypeId).name,
        trainLabel,
        trainable: Boolean(trainLabel),
        inverted: familyKey.endsWith("In"),
      };
    })
  );

  // One calibration step per named sign (not per shape), grouped by
  // family (SIGN_BUCKETS order, not SIGN_ARCHETYPES' order -- the two
  // don't match, and stepping through Direction long before Bend and Bird
  // meant whichever of the three happened to be calibrated last quietly
  // became the family's default, discarding whatever the first two had
  // just set without any indication that's what was happening). Completing
  // a sign's reps feeds the shape matcher (where the family has one --
  // wideOut/wideIn/closedSmooth/closedChaotic are read structurally, not
  // template-matched, so trainLabel is null for those); which one becomes
  // the family's preferred default (see PREFERRED_DEFAULT_KEY below) is
  // asked explicitly once the whole family's signs are calibrated, not
  // inferred from whichever was drawn last.
  const CALIBRATION_FAMILIES = Object.keys(SIGN_BUCKETS).map((familyKey) => ({
    familyKey,
    signs: SIGN_BUCKETS[familyKey].map((id) => {
      const archetype = getArchetype(id);
      return {
        id,
        name: archetype.name,
        image: archetype.image,
        familyKey,
        trainLabel: SIGN_TRAIN_LABEL_OVERRIDE[id] || FAMILY_TRAIN_LABEL[familyKey],
      };
    }),
  }));

  // Shape alone can't tell apart signs in the same family (see classify.js),
  // so correcting "Direction" to "Bend" (or Enlarge, Bird, Float, ...) only
  // ever teaches the shape matcher what a bend/direction/bolt/bird-shaped
  // stroke looks like -- classifyStrokeGroup() always returns the family's
  // one hardcoded default archetype ("direction" for a bend-shaped peak,
  // chosen since it's the more commonly used of the two) regardless of how
  // much training data piles up for it, so a correction to a non-default
  // family member could never actually change what showed up next time, no
  // matter how many times it was repeated. This remembers a preferred
  // default per family separately from shape training, and finalizeGroup()
  // below applies it after classification.
  const PREFERRED_DEFAULT_KEY = "witch-atelier:preferred-defaults";
  function getPreferredDefaults() {
    try {
      return JSON.parse(localStorage.getItem(PREFERRED_DEFAULT_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function setPreferredDefault(familyKey, archetypeId) {
    const prefs = getPreferredDefaults();
    prefs[familyKey] = archetypeId;
    localStorage.setItem(PREFERRED_DEFAULT_KEY, JSON.stringify(prefs));
  }

  // How many separate strokes THIS user tends to draw a given sign with,
  // learned from calibration reps rather than asked for directly.
  // CalibrationDataset already stores every kept rep's raw paths per
  // sign (see keepCalibrationRep below), so paths.length across those
  // reps already is exactly that -- no new storage, no new calibration
  // step, just reading data that was already being collected. The mode
  // (most repeated count) is used rather than an average, since a
  // fractional "2.4 strokes" wouldn't mean anything to compare against a
  // live drawing's actual, integer count.
  function personalStrokeCountProfile() {
    const bySign = {};
    for (const entry of CalibrationDataset.list()) {
      (bySign[entry.signId] ||= []).push(entry.paths.length);
    }
    const profile = {};
    for (const signId in bySign) {
      const counts = bySign[signId];
      const freq = {};
      for (const c of counts) freq[c] = (freq[c] || 0) + 1;
      let best = counts[0];
      for (const c in freq) {
        if (freq[c] > freq[best] || (freq[c] === freq[best] && Number(c) < best)) best = Number(c);
      }
      profile[signId] = best;
    }
    return profile;
  }

  // Column and Levitation both list a valid 2-stroke drawing in the
  // source material, so the canon min/max table in classify.js can't
  // tell them apart at count 2 and correctly doesn't try. But if THIS
  // user's own calibration reps show Column always lands on 2 strokes
  // and Levitation always lands on 3, that ambiguity doesn't exist for
  // them specifically -- a live drawing that comes in at exactly 2 or
  // exactly 3 strokes has an unambiguous personal answer, even though
  // the shared canon range never could. Only trusted on an exact match:
  // picking whichever calibrated member's mode count is merely closest
  // to what was drawn, with no exact hit, would just be guessing with
  // extra steps.
  function refineByPersonalStrokeCount(detectedArchetypeId, strokeCount) {
    const candidates = bucketCandidates(detectedArchetypeId);
    if (candidates.length <= 1) return detectedArchetypeId;
    const profile = personalStrokeCountProfile();
    let best = null;
    let bestDist = Infinity;
    for (const id of candidates) {
      if (!(id in profile)) continue;
      const dist = Math.abs(profile[id] - strokeCount);
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    }
    return best !== null && bestDist === 0 ? best : detectedArchetypeId;
  }

  const GROUP_WINDOW_MS = 1400; // pause this long to lock in a multi-part sign

  let drawing = false;
  let rawPoints = []; // client-space points for the in-progress stroke
  let groupTimer = null;
  let casting = false; // true for the duration of castEffect()'s animation, blocks new strokes

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
    result.match = matchSpell(state);
    renderReadout(result);
    render();
    document.getElementById("cast-btn").disabled = !state.ringComplete;
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
    // Each element's own color (see js/data/sigils.js), read by
    // .chip-image's border/background rules in style.css -- makes the
    // element picker itself color-coded instead of every chip looking
    // identical until you read the label.
    btn.style.setProperty("--sigil-color", sigil.color);
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
  // A sign can be one or more strokes; after a stroke ends there's a short
  // pause during which another stroke counts as part of the same sign.
  // Once that pause elapses, the group classifies and locks in (classify.js).
  //
  // Each point passes through a One Euro Filter (js/engine/smoothing.js)
  // before it's stored or drawn: a fingertip resting mid-stroke jitters
  // by a few px even when the person means to hold still or move in a
  // straight line, and that noise was going straight into the geometry
  // classify.js measures (loop closure, sharp-turn counts, hub-detection
  // radius). The filter is speed-adaptive, not a fixed smoothing window --
  // slow movement gets smoothed hard, a fast deliberate corner barely at
  // all -- so a genuine sharp turn drawn at normal speed survives while
  // low-speed tremor gets absorbed. Reset per stroke (not per sign) so a
  // pause between a multi-stroke sign's parts doesn't smear across strokes.
  let strokeSmoother = null;
  canvas.addEventListener("pointerdown", (e) => {
    // Awaiting Keep/Redo, or picking a family's default: the pending
    // stroke isn't resolved yet, so a new one can't start on top of it.
    if (calibration && calibration.mode !== "draw") return;
    // The canvas is genuinely CSS-tilted in 3D while a cast plays (see
    // #circle.casting in style.css) -- toLocal() maps pointer coordinates
    // against the canvas's on-screen bounding box, which the tilt
    // changes the shape of, so a stroke started mid-cast would land
    // somewhere other than where the finger/cursor actually is.
    if (casting) return;
    if (groupTimer) {
      clearTimeout(groupTimer);
      groupTimer = null;
    }
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    strokeSmoother = createStrokeSmoother();
    rawPoints = [strokeSmoother(toLocal(e.clientX, e.clientY), e.timeStamp)];
    state.livePath = rawPoints;
    render();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = strokeSmoother(toLocal(e.clientX, e.clientY), e.timeStamp);
    const last = rawPoints[rawPoints.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return; // skip near-duplicate points
    rawPoints.push(p);
    state.livePath = rawPoints;
    render();
  });

  const lastDrawnEl = document.getElementById("last-drawn");
  let groupPaths = [];

  // Only updates "Read as: ..." when the correction is for the
  // most-recently-drawn sign, so an older correction doesn't overwrite it.
  function refreshLastDrawnIfCurrent(instance) {
    if (state.signs[state.signs.length - 1] !== instance) return;
    const archetype = getArchetype(instance.archetypeId);
    lastDrawnEl.textContent = `Read as: ${archetype.name} (${archetype.short})`;
  }

  function finalizeGroup() {
    groupTimer = null;
    if (groupPaths.length === 0) return;

    if (calibration) {
      // Doesn't save or advance yet -- groupPaths is left as-is (still
      // rendered, semi-transparent, by drawScene) so the drawn stroke
      // stays visible while Keep/Redo decides whether it was any good.
      // A bad rep committed straight to training data with no way back
      // was actively teaching the matcher the wrong thing.
      enterCalibrationReview();
      render();
      return;
    }

    const detectedArchetypeId = classifyStrokeGroup(groupPaths, Training.asTemplatePool());
    // Personal stroke-count habit (see refineByPersonalStrokeCount above)
    // wins first where it has a confident, exact answer -- it's a
    // per-drawing signal, more specific than a single flat preference for
    // the whole family. Falls through to the flat preferred default (e.g.
    // Bend instead of Direction -- see PREFERRED_DEFAULT_KEY above) only
    // when it doesn't have one. bucketCandidates() re-derives the same
    // family the detected id is already in either way, so neither of
    // these can change what family (and therefore what effect) the sign
    // resolves to, only which member within it.
    const personalMatch = refineByPersonalStrokeCount(detectedArchetypeId, groupPaths.length);
    let archetypeId = personalMatch;
    if (personalMatch === detectedArchetypeId) {
      const preferredDefaults = getPreferredDefaults();
      const family = familyKeyOf(detectedArchetypeId);
      const preferred = family && preferredDefaults[family];
      if (preferred && bucketCandidates(detectedArchetypeId).includes(preferred)) archetypeId = preferred;
    }
    const spine = groupPaths.reduce((a, b) => (pathLength(b) > pathLength(a) ? b : a));
    const start = spine[0];
    const end = spine[spine.length - 1];
    const angle = Vector.angle(end.x, end.y);
    const totalLength = groupPaths.reduce((sum, p) => sum + pathLength(p), 0);
    const length = Math.max(0.15, Math.min(1.4, totalLength / ringRadius()));
    const distFromCenterStart = Math.hypot(start.x, start.y);
    const distFromCenterEnd = Math.hypot(end.x, end.y);
    const inverted = distFromCenterEnd < distFromCenterStart; // drawn inward = pull

    state.signs.push({
      archetypeId,
      angle,
      length,
      baseLength: length,
      inverted,
      paths: groupPaths.slice(),
      basePaths: groupPaths.map((p) => p.slice()),
      anchor: { x: groupPaths[0][0].x, y: groupPaths[0][0].y },
    });
    groupPaths = [];
    state.groupPaths = groupPaths;
    const archetype = getArchetype(archetypeId);
    lastDrawnEl.textContent = `Read as: ${archetype.name} (${archetype.short})`;
    renderSignList();
    recompute();
  }

  function finishStroke() {
    if (!drawing) return;
    drawing = false;
    state.livePath = null;
    if (rawPoints.length >= 2 && pathLength(rawPoints) >= 8) {
      groupPaths.push(rawPoints.slice());
      state.groupPaths = groupPaths;
      // Calibration's own step text already says what's happening; this
      // status line is for normal drawing, sitting right below it.
      if (!calibration) lastDrawnEl.textContent = "Drawing... (pause to lock in)";
    }
    rawPoints = [];
    render();
    if (groupTimer) clearTimeout(groupTimer);
    groupTimer = setTimeout(finalizeGroup, GROUP_WINDOW_MS);
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

  // ---- Clear: start the current spell over, keep the chosen element ----
  document.getElementById("clear-btn").addEventListener("click", () => {
    state.signs = [];
    state.ringComplete = false;
    ringToggle.classList.remove("active");
    ringToggle.textContent = "Ring open";
    lastDrawnEl.textContent = "";
    correctionPanelState.clear();
    renderSignList();
    recompute();
  });

  // ---- Calibration ----
  const calibrationBanner = document.getElementById("calibration-banner");
  const calibrationStepEl = document.getElementById("calibration-step");
  const calibrationStepText = document.getElementById("calibration-step-text");
  const calibrationOverlay = document.getElementById("calibration-overlay");
  const calibrationReviewActions = document.getElementById("calibration-review-actions");
  const calibrationDefaultPicker = document.getElementById("calibration-default-picker");
  const calibrationDefaultText = document.getElementById("calibration-default-text");
  const calibrationDefaultOptions = document.getElementById("calibration-default-options");

  function dismissOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, "true");
    calibrationBanner.hidden = true;
  }

  // Where to resume is computed fresh from the drawings themselves every
  // time, not tracked as a separate pointer -- a separate "familyIndex/
  // signIndex/rep so far" value only stays correct as long as nothing
  // else ever changes the underlying data without also updating it in
  // lockstep, and importing a file (possibly one merging data from a
  // completely different session) is exactly the kind of change that
  // pointer had no way to know about.
  //
  // Resume trusts forward progress at the FAMILY level rather than
  // stopping at the first individual sign short of the target: an
  // imported file built after a storage reset mid-session can genuinely
  // have zero examples of an earlier family (Column, say) while still
  // having plenty of a much later one (Bolt) -- that's not evidence
  // Column needs redoing, it's evidence of exactly when the reset
  // happened, since the app's own flow never reaches a later family
  // without going through every earlier family's default-picker first.
  // Whichever family the drawings reach furthest into is trusted as the
  // real starting point; every family before it is treated as already
  // done regardless of what any one file happens to contain for it.
  // Signs WITHIN that furthest family are still checked properly from
  // its own start, since drawing can genuinely leave one of its earlier
  // signs (Rain, say) short while a later one in the same family (Weave)
  // is already at target.
  function computeCalibrationResumePoint(targetRepCount) {
    const counts = CalibrationDataset.countBySign();
    let furthestFamilyIndex = 0;
    for (let familyIndex = 0; familyIndex < CALIBRATION_FAMILIES.length; familyIndex++) {
      const hasAnyData = CALIBRATION_FAMILIES[familyIndex].signs.some((sign) => (counts[sign.id] || 0) > 0);
      if (hasAnyData) furthestFamilyIndex = familyIndex;
    }
    for (let familyIndex = furthestFamilyIndex; familyIndex < CALIBRATION_FAMILIES.length; familyIndex++) {
      const family = CALIBRATION_FAMILIES[familyIndex];
      for (let signIndex = 0; signIndex < family.signs.length; signIndex++) {
        const rep = counts[family.signs[signIndex].id] || 0;
        if (rep < targetRepCount) return { familyIndex, signIndex, rep };
      }
    }
    return null; // every sign from the furthest family onward already has targetRepCount+ examples
  }

  function currentCalibrationFamily() {
    return CALIBRATION_FAMILIES[calibration.familyIndex];
  }
  function currentCalibrationSign() {
    return currentCalibrationFamily().signs[calibration.signIndex];
  }

  function renderCalibrationStep() {
    calibration.mode = "draw";
    calibrationDefaultPicker.hidden = true;
    calibrationStepEl.hidden = false;
    calibrationReviewActions.hidden = true;
    const sign = currentCalibrationSign();
    calibrationStepText.innerHTML =
      `<strong>${sign.name}</strong> (${calibration.rep + 1} of ${calibrationRepCount}): trace the shape shown faintly on the circle.`;
    calibrationOverlay.src = sign.image;
    calibrationOverlay.hidden = false;
  }

  function enterCalibrationReview() {
    calibration.mode = "review";
    const sign = currentCalibrationSign();
    calibrationStepText.innerHTML = `<strong>${sign.name}</strong>: keep this one, or redo it?`;
    calibrationReviewActions.hidden = false;
  }

  function advanceCalibration() {
    calibration.rep++;
    if (calibration.rep >= calibrationRepCount) {
      calibration.rep = 0;
      calibration.signIndex++;
    }
    const family = currentCalibrationFamily();
    if (calibration.signIndex >= family.signs.length) {
      if (family.signs.length > 1) {
        enterDefaultPicker(family);
      } else {
        setPreferredDefault(family.familyKey, family.signs[0].id);
        advanceCalibrationFamily();
      }
      return;
    }
    renderCalibrationStep();
  }

  function advanceCalibrationFamily() {
    calibration.familyIndex++;
    calibration.signIndex = 0;
    calibration.rep = 0;
    if (calibration.familyIndex >= CALIBRATION_FAMILIES.length) {
      stopCalibration(true);
      return;
    }
    renderCalibrationStep();
  }

  // Asked once per family, after every member's reps are done, rather than
  // inferred from whichever sign happened to be calibrated last -- shape
  // alone can't tell Bend from Direction from Bird, so there's no way to
  // recover the intended default from the drawing itself after the fact.
  function enterDefaultPicker(family) {
    calibration.mode = "pick-default";
    calibrationStepEl.hidden = true;
    calibrationOverlay.hidden = true;
    calibrationDefaultPicker.hidden = false;
    const names = family.signs.map((s) => s.name).join(", ");
    calibrationDefaultText.innerHTML = `Which of these should read as by default: <strong>${names}</strong>?`;
    calibrationDefaultOptions.innerHTML = "";
    family.signs.forEach((sign) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip chip-image correct-chip";
      const img = document.createElement("img");
      img.src = sign.image;
      img.alt = "";
      const label = document.createElement("span");
      label.textContent = sign.name;
      btn.append(img, label);
      btn.addEventListener("click", () => {
        setPreferredDefault(family.familyKey, sign.id);
        advanceCalibrationFamily();
      });
      calibrationDefaultOptions.appendChild(btn);
    });
  }

  function stopCalibration(completed) {
    calibration = null;
    calibrationStepEl.hidden = true;
    calibrationOverlay.hidden = true;
    calibrationReviewActions.hidden = true;
    calibrationDefaultPicker.hidden = true;
    dismissOnboarding();
    lastDrawnEl.textContent = completed
      ? "Calibration saved. Draw normally now, it'll use these examples alongside the built-in ones."
      : "";
  }

  function startCalibration(repCount) {
    calibrationBanner.hidden = true;
    calibrationRepCount = repCount;
    const resumeAt = computeCalibrationResumePoint(repCount);
    calibration = resumeAt
      ? { familyIndex: resumeAt.familyIndex, signIndex: resumeAt.signIndex, rep: resumeAt.rep, mode: "draw" }
      : { familyIndex: 0, signIndex: 0, rep: 0, mode: "draw" };
    renderCalibrationStep();
    // The Circle tab is where the actual drawing step lives; on mobile
    // (where these are real tabs, not just a desktop 3-column layout)
    // tapping Build training set otherwise leaves the step sitting
    // unseen behind the Sigils & Signs tab the button itself is on,
    // easy to mistake for nothing having happened. Harmless to call on
    // desktop too -- every panel is already visible there regardless.
    document.querySelector('[data-tab-target="circle"]')?.click();
  }

  document.getElementById("calibration-start").addEventListener("click", () => startCalibration(QUICK_CALIBRATION_REPS));
  document.getElementById("calibration-skip").addEventListener("click", dismissOnboarding);
  document.getElementById("calibration-stop").addEventListener("click", () => stopCalibration(false));
  function keepCalibrationRep() {
    if (!calibration || calibration.mode !== "review") return;
    const sign = currentCalibrationSign();
    const trainingOk = sign.trainLabel ? Training.save(groupPaths, sign.trainLabel) : true;
    const datasetOk = CalibrationDataset.add(sign.id, sign.familyKey, groupPaths);
    if (!trainingOk || !datasetOk) {
      // Storage is full (localStorage.setItem threw -- see the comments on
      // Training.save/CalibrationDataset.add). Everything saved before this
      // rep is untouched and safe; this rep specifically didn't make it in.
      // Left in review rather than advancing past it silently, with the
      // drawn stroke still on screen, so nothing here just quietly
      // vanishes -- the only way out is to actually go export.
      calibrationStepText.innerHTML =
        `<strong>Storage is full.</strong> Everything saved before this didn't go anywhere -- export it now ` +
        `(Shape guide → Export training data), then either free up space or stop here with what you have.`;
      return;
    }
    updateDatasetProgress();
    groupPaths = [];
    state.groupPaths = groupPaths;
    render();
    advanceCalibration();
  }
  function redoCalibrationRep() {
    if (!calibration || calibration.mode !== "review") return;
    groupPaths = [];
    state.groupPaths = groupPaths;
    render();
    renderCalibrationStep(); // same sign, same rep count -- just try again
  }
  document.getElementById("calibration-keep").addEventListener("click", keepCalibrationRep);
  document.getElementById("calibration-redo").addEventListener("click", redoCalibrationRep);
  // Building a real training set means hundreds of Keep clicks in a row --
  // reaching for the mouse every time is exactly the friction that makes
  // 50-per-sign painful. Shift keeps (one hand stays on the drawing hand's
  // side of the keyboard); Escape redoes, the same "back out of this"
  // meaning it has everywhere else. Only live during the review step, so
  // neither key does anything while actually drawing or elsewhere in the app.
  document.addEventListener("keydown", (e) => {
    if (!calibration || calibration.mode !== "review" || e.repeat) return;
    if (e.key === "Shift") {
      e.preventDefault();
      keepCalibrationRep();
    } else if (e.key === "Escape") {
      e.preventDefault();
      redoCalibrationRep();
    }
  });
  // Always reachable, not just on first visit: handwriting drifts, and
  // revisiting which sign should default for a family (Bend vs Direction,
  // ...) is a normal thing to want later, not just once at onboarding.
  // Tucked into the already-collapsed Shape guide section rather than a
  // banner, so it's available without sitting in front of the user
  // every time they open the app.
  document.getElementById("recalibrate-btn").addEventListener("click", () => startCalibration(QUICK_CALIBRATION_REPS));

  const datasetProgressEl = document.getElementById("dataset-progress");
  const exportDatasetBtn = document.getElementById("export-dataset-btn");
  function updateDatasetProgress() {
    const total = CalibrationDataset.list().length;
    if (total === 0) {
      datasetProgressEl.hidden = true;
      exportDatasetBtn.hidden = true;
      return;
    }
    const bySign = CalibrationDataset.countBySign();
    const signsCovered = Object.keys(bySign).length;
    datasetProgressEl.hidden = false;
    datasetProgressEl.textContent = `Training set: ${total} drawings across ${signsCovered} of ${SIGN_ARCHETYPES.length} signs.`;
    exportDatasetBtn.hidden = false;
  }
  exportDatasetBtn.addEventListener("click", () => CalibrationDataset.download());

  updateDatasetProgress();

  if (!localStorage.getItem(ONBOARDING_KEY) && Training.list().length === 0) {
    calibrationBanner.hidden = false;
  }

  // ---- Placed signs list (fine control + accessible alternative to drawing) ----
  const signList = document.getElementById("sign-list");
  // renderSignList() rebuilds every row from scratch, so open/confirmed
  // panel state lives here instead, keyed by sign instance (not index,
  // which shifts when a sign is removed) so it survives the rebuild.
  const correctionPanelState = new Map();
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
          refreshLastDrawnIfCurrent(instance);
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
      row.appendChild(slider);

      const lengthReadout = document.createElement("span");
      lengthReadout.className = "sign-row-length";
      lengthReadout.textContent = instance.length.toFixed(2);
      row.appendChild(lengthReadout);

      slider.addEventListener("input", () => {
        const newLength = parseFloat(slider.value);
        const scale = newLength / instance.baseLength;
        instance.paths = instance.basePaths.map((path) =>
          path.map((p) => ({
            x: instance.anchor.x + (p.x - instance.anchor.x) * scale,
            y: instance.anchor.y + (p.y - instance.anchor.y) * scale,
          }))
        );
        instance.length = newLength;
        lengthReadout.textContent = newLength.toFixed(2);
        recompute();
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "mini-btn danger";
      removeBtn.textContent = "remove";
      removeBtn.addEventListener("click", () => {
        state.signs.splice(i, 1);
        correctionPanelState.delete(instance);
        renderSignList();
        recompute();
      });
      row.appendChild(removeBtn);

      const entry = document.createElement("div");
      entry.className = "sign-entry";
      entry.appendChild(row);

      const panelState = correctionPanelState.get(instance) || { open: false, message: null };

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "correct-toggle";
      toggleBtn.setAttribute("aria-expanded", String(panelState.open));
      toggleBtn.innerHTML = '<span class="correct-toggle-icon" aria-hidden="true">&#9998;</span> Wrong reading?';
      entry.appendChild(toggleBtn);

      const panel = document.createElement("div");
      panel.className = "correct-panel";
      panel.hidden = !panelState.open;

      const panelHint = document.createElement("p");
      panelHint.className = "correct-panel-hint";
      panelHint.textContent = "What should this sign have been read as?";
      panel.appendChild(panelHint);

      const optionRow = document.createElement("div");
      optionRow.className = "correct-options";
      CORRECTION_FAMILIES.forEach(({ archetypeId: targetId, name, trainLabel, trainable, inverted }) => {
        const btn = document.createElement("button");
        btn.className = "chip correct-chip";
        btn.type = "button";
        btn.textContent = trainable ? name : `${name} (this sign only)`;
        btn.title = trainable
          ? `Also saves this stroke so similar shapes read as ${name} from now on`
          : `${name} is read from where the sign sits on the ring, not shape-matched, so this only fixes this one sign`;
        btn.addEventListener("click", () => {
          if (trainable) {
            Training.save(instance.basePaths, trainLabel);
            setPreferredDefault(familyKeyOf(targetId), targetId);
          }
          instance.archetypeId = targetId;
          if (inverted !== undefined) instance.inverted = inverted;
          refreshLastDrawnIfCurrent(instance);
          correctionPanelState.set(instance, {
            open: true,
            message: trainable
              ? `Saved. Shapes like this should read as ${name} from now on.`
              : `Changed to ${name} for this sign. This family isn't shape-matched, so it isn't remembered for next time.`,
          });
          renderSignList();
          recompute();
        });
        optionRow.appendChild(btn);
      });
      panel.appendChild(optionRow);

      const panelConfirm = document.createElement("p");
      panelConfirm.className = "correct-panel-confirm";
      panelConfirm.hidden = !panelState.message;
      panelConfirm.textContent = panelState.message || "";
      panel.appendChild(panelConfirm);

      toggleBtn.addEventListener("click", () => {
        const nowOpen = panel.hidden;
        panel.hidden = !nowOpen;
        toggleBtn.setAttribute("aria-expanded", String(nowOpen));
        correctionPanelState.set(instance, { open: nowOpen, message: nowOpen ? panelState.message : null });
      });
      entry.appendChild(panel);

      signList.appendChild(entry);
    });
  }

  // ---- Readout ----
  const readoutEl = document.getElementById("readout");
  function renderReadout(result) {
    const { params, warnings, label, ok, match } = result;
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
      ${match ? `<p class="spell-match">Matches a known spell: ${match}</p>` : ""}
      ${warnings.length ? `<ul class="warnings">${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>` : ""}
      <p class="status ${ok ? "ok" : "warn"}">${ok ? "stable" : "unstable"}</p>
    `;
  }

  // ---- Cast: only fires with a closed ring ----
  const castBtn = document.getElementById("cast-btn");
  castBtn.addEventListener("click", () => {
    if (!state.ringComplete || casting) return;
    const result = composeSpell(state);
    // A recognized named spell (Light Beam, Grasping Wind, ...) gets its
    // own cast motion instead of the generic direction/spread-driven
    // burst -- see js/data/castpresets.js for which ones and why.
    const preset = castPresetFor(matchSpell(state));
    // The tilt is a real CSS 3D transform on the canvas itself (see
    // #circle.casting in style.css), not anything faked in render.js.
    // Sequenced rather than started together: the plate tilts back
    // first, THEN the effect fires once it's actually settled into
    // position, THEN the plate levels back out only once the effect is
    // done -- starting the burst mid-tilt (or leveling out while it was
    // still playing) looked like the two were racing each other instead
    // of one following the other. TILT_MS has to match the #circle.casting
    // transition duration in style.css, there's no DOM event fired here
    // that ties them together automatically.
    const TILT_MS = 500;
    casting = true;
    canvas.classList.add("casting");
    castBtn.disabled = true;
    setTimeout(() => {
      castEffect(canvas, size, result.params, result.sigil, state, 1000, preset, () => {
        canvas.classList.remove("casting");
        setTimeout(() => {
          casting = false;
          castBtn.disabled = false;
        }, TILT_MS);
      });
    }, TILT_MS);
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
  // Recognized spells (those with a SPELL_SIGNATURES entry) sort first.
  const spellbookEl = document.getElementById("spellbook");
  const spellbookCountEl = document.getElementById("spellbook-count");
  const spellbookSearchEl = document.getElementById("spellbook-search");
  const spellbookRecognizedToggle = document.getElementById("spellbook-recognized-toggle");
  const recognizedNames = new Set(SPELL_SIGNATURES.map((s) => s.name));
  const sortedSpellbook = SPELLBOOK.slice().sort((a, b) => {
    const ra = recognizedNames.has(a.name) ? 0 : 1;
    const rb = recognizedNames.has(b.name) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  spellbookCountEl.textContent = `${recognizedNames.size} of ${SPELLBOOK.length} spells below can be recognized from what you draw. Look for the Recognized badge.`;

  let recognizedOnly = false;

  function renderSpellbook() {
    const query = spellbookSearchEl.value.trim().toLowerCase();
    spellbookEl.innerHTML = "";
    sortedSpellbook.forEach((spell) => {
      const isRecognized = recognizedNames.has(spell.name);
      if (recognizedOnly && !isRecognized) return;
      if (query && !spell.name.toLowerCase().includes(query)) return;

      const card = document.createElement("figure");
      card.className = "spellbook-card";
      const img = document.createElement("img");
      img.src = spell.image;
      img.alt = spell.name;
      img.loading = "lazy";
      const caption = document.createElement("figcaption");
      const titleRow = document.createElement("div");
      titleRow.className = "spellbook-title-row";
      const title = document.createElement("span");
      title.className = "spellbook-title";
      title.textContent = spell.name;
      titleRow.appendChild(title);
      if (isRecognized) {
        const badge = document.createElement("span");
        badge.className = "recognized-badge";
        badge.textContent = "Recognized";
        titleRow.appendChild(badge);
      }
      caption.appendChild(titleRow);
      if (spell.description) {
        const desc = document.createElement("span");
        desc.className = "spellbook-desc";
        desc.textContent = spell.description;
        caption.appendChild(desc);
      }
      card.append(img, caption);
      spellbookEl.appendChild(card);
    });

    if (!spellbookEl.children.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No spells match.";
      spellbookEl.appendChild(empty);
    }
  }

  spellbookSearchEl.addEventListener("input", renderSpellbook);
  spellbookRecognizedToggle.addEventListener("click", () => {
    recognizedOnly = !recognizedOnly;
    spellbookRecognizedToggle.classList.toggle("active", recognizedOnly);
    spellbookRecognizedToggle.setAttribute("aria-pressed", String(recognizedOnly));
    renderSpellbook();
  });

  renderSpellbook();

  // ---- init ----
  renderSignList();
  refreshGrimoire();
  recompute();
  resizeCanvas();
})();
