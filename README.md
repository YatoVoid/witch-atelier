# Atelier

A spell-circle workbench in the style of Witch Hat Atelier's magic system: place a sigil at the center of a ring, surround it with signs, and read what the composition actually resolves to.

No build step. No backend. Static HTML/CSS/JS, deployable as-is to GitHub Pages.

## Run locally

```
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## How it works

- `js/data/sigils.js` — the elements (fire, water, wind, earth, light). Each one only needs a name and a `describe(params)` function that turns generic effect parameters into a sentence.
- `js/data/signs.js` — the sign archetypes (Column, Levitation, Dispersion, Crushing). Each one only needs a `contribute(accumulator, instance)` function describing how it affects direction, spread, sustain, or raw intensity.
- `js/engine/compose.js` — pure function that reduces a chosen sigil + placed signs into resolved parameters (direction, magnitude, spread, sustain, intensity) and an honest readout, including misfire warnings when signs cancel out.
- `js/engine/render.js` — canvas rendering: the ring, the sigil glyph, the sign strokes, and the cast animation.
- `js/grimoire.js` — localStorage persistence and spell-code export/import (a spell is fully described by its data, so sharing one is just sharing a string — no server needed).

Direction and strength are computed, not looked up: each Column sign contributes a force vector from its angle and drawn length, and the net direction/skew come from summing those vectors. Nothing about a specific element+sign combination is hardcoded — `describe()` reads the same generic parameters every combination produces.

## Adding a new sigil or sign

This is the part meant to grow as more of the source material's rules get pinned down.

- **New element**: add an entry to `SIGILS` in `js/data/sigils.js` (name, particle style for the cast animation, a `describe(params)` function) and a case in `drawSigil()` in `js/engine/render.js` for its glyph shape. Nothing else changes.
- **New sign archetype**: add an entry to `SIGN_ARCHETYPES` in `js/data/signs.js` with a `contribute()` function, plus a case in `drawSign()` in `js/engine/render.js` for how it's drawn. `compose.js` and `app.js` pick it up automatically — the palette, the placement logic, and the readout are all generated from these two data files.

## Deploying to GitHub Pages

1. `git init`, commit, push to a GitHub repo.
2. In the repo's Settings → Pages, set the source to the `main` branch, root directory.
3. No Actions workflow needed since there's no build step.
