# Atelier

A spell-circle workbench in the style of Witch Hat Atelier's magic system. Pick an element, draw signs freehand anywhere on the circle, close the ring, and read what the composition resolves to.

No build step, no backend. Static HTML/CSS/JS, deployable as-is to GitHub Pages.

## Run locally

```
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## How it works

Nothing is pre-selected before you draw. Draw one or more strokes anywhere on the circle (a pause of 1.5s locks the sign in, so a few strokes drawn close together count as one sign) and the shape decides which family it belongs to:

| Shape | Family |
|---|---|
| straight, drawn outward | Column, Crosshair, Enlarge, or Levitation |
| straight, drawn inward | Pull |
| wide sweep, outward | Dispersion, Radial, Rain, Billowing, or Weave |
| wide sweep, inward | Convergence, Window, or Collection |
| gentle wiggle that doesn't travel far | Float, Dancing Puppet, or Vision |
| sharp zigzag | Bolt, Bend, Direction, or Bird |
| closed loop, smooth | Diamond, Repetition, or Eye |
| closed loop, chaotic | Crush |

There's no shape difference between the signs within a family in the source material either. The stroke narrows it to a family; the sign-list row's dropdown lets you pick which one you meant.

### Files

- **`js/engine/classify.js`** — reads a sign's stroke geometry and returns a family plus its default member. Closedness is read directly off the raw geometry. Direction (outward vs. inward) compares the ring-center distance of the longest stroke's start to its end, not first-stroke-to-last-stroke, so a decoration drawn as its own stroke can't flip the reading. Everything else (straight line vs. corner vs. zigzag vs. wiggle) goes through a point-cloud shape matcher, the $1 Unistroke Recognizer (Wobbrock, Wilson & Li, 2007): the stroke is normalized (resampled, recentered, rescaled, rotated to a consistent orientation) and matched against reference examples in `js/data/templates.js`. Angular spread around the ring center is only checked once shape matching fails to find a confident match, to catch a genuine wide sweep without misreading a long-armed peak or zigzag as one. Deterministic, no network call, no model file. `classifyStrokeGroup()` takes an optional pool of extra templates from `js/training.js`. Direction isn't trainable the same way — it's a geometric comparison, not a template match.
- **`js/data/templates.js`** — reference examples for the shape matcher, one point array per shape. `straight`, `bend`, `bolt`, and `wavy` each carry templates traced off the actual glyph art in `assets/signs/*.webp`, alongside clean geometric templates and real hand-drawn examples. Add templates here to fix a shape that's still misread.
- **`js/training.js`** — personal corrections, saved to `localStorage`. The "Wrong reading?" panel lists every sign directly; for shape-matched families it also saves the drawn stroke as an extra template. A multi-stroke sign radiating from a shared center (a Crosshair's four arms) is saved one arm per entry. `js/app.js` also offers a one-time calibration flow on first visit.
- **`js/data/signatures.js`** — recognizes a drawn spell as a named spellbook entry, for the signatures whose sign composition is confirmed (documented on the wiki or read off the reference art).
- **`js/data/sigils.js`** — the 8 elements.
- **`js/data/signs.js`** — the 24 sign archetypes. Each has a `contribute(accumulator, instance)` function describing its effect on direction, spread, sustain, or intensity. Where the wiki doesn't document a sign's function, the entry says so and uses a placeholder grouped by feel.
- **`js/data/spellbook.js`** — 104 named canon spells for the reference gallery. Descriptions are included only where the wiki documents the effect.
- **`js/engine/compose.js`** — pure function reducing a chosen sigil and drawn signs into resolved parameters (direction, magnitude, spread, sustain, intensity) and misfire warnings.
- **`js/engine/render.js`** — canvas rendering, ink color sampled from the reference artwork.
- **`js/engine/vector.js`** — angle and compass-bearing math.
- **`js/grimoire.js`** — localStorage persistence and spell-code export/import.

Direction and strength are computed, not looked up: each directional sign contributes a force vector from its angle and drawn length, summed for the net reading. Nothing about a specific element × sign combination is hardcoded.

## The artwork

The sigil and sign glyphs in `assets/` are hand-drawn reconstructions of the canon designs, not traced from the manga's published pages.

## Adding a new sigil or sign

- **New element**: add an entry to `SIGILS` in `js/data/sigils.js` (name, particle style, image path).
- **New sign archetype**: add an entry to `SIGN_ARCHETYPES` in `js/data/signs.js` with a `contribute()` function and image path, and place it in `SIGN_BUCKETS` in `js/engine/classify.js`.
- **New spellbook entry**: add a row to `SPELLBOOK` in `js/data/spellbook.js`, with a `description` only if the wiki documents what it does.

## Testing the recognition engine

`test/run.js` is a plain Node script with no dependencies: it loads the engine files the same way `index.html` does and drives them with synthetic stroke geometry. Covers every sign family at several ring positions, jitter robustness at plausible hand-tremor levels, real hand-drawn examples traced from actual misclassifications, and every `SPELL_SIGNATURES` entry against its recipe and near-miss recipes that should be rejected.

Run with `node test/run.js`.

## Deploying to GitHub Pages

1. `git init`, commit, push to a GitHub repo.
2. In the repo's Settings → Pages, set the source to the `master` branch, root directory.
3. No Actions workflow needed — there's no build step.
