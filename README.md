# Atelier

A spell-circle workbench in the style of Witch Hat Atelier's magic system. Pick an element, draw signs freehand anywhere on the circle, and read what the composition resolves to.

No build step. No backend. Static HTML/CSS/JS, deployable as-is to GitHub Pages.

## Run locally

```
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## How it works

Nothing is pre-selected before you draw a sign. You draw a stroke anywhere on the circle, and its shape decides which archetype it becomes:

- straight, drawn outward: Column (push)
- straight, drawn inward: Pulling
- wide sweep across many angles, outward: Dispersion
- wide sweep, inward: Convergence
- gentle back-and-forth wiggle that doesn't travel far from where it started: Levitation
- sharp zigzag: Bolt
- closed loop, drawn smoothly: Diamond
- closed loop, drawn chaotically: Crushing

- `js/engine/classify.js`: reads a raw stroke's geometry (straightness, angular spread from the ring's center, turning/zigzag, whether it closes into a loop) and returns which archetype it is. Deterministic heuristics, no model, no network call.
- `js/data/sigils.js`: the elements (fire, water, air, earth, light).
- `js/data/signs.js`: the sign archetypes. Each one only needs a `contribute(accumulator, instance)` function describing how it affects direction, spread, sustain, or raw intensity.
- `js/engine/compose.js`: pure function that reduces a chosen sigil + drawn signs into resolved parameters (direction, magnitude, spread, sustain, intensity) and an honest readout, including misfire warnings when directional signs cancel out.
- `js/engine/render.js`: canvas rendering: the ring, the sigil glyph, the drawn sign strokes (rendered from your actual recorded points, not a synthetic redraw), and the cast animation.
- `js/engine/vector.js`: angle and compass-bearing math. Canvas angles put 0 degrees at east with y growing downward; `toBearing()` converts that to a map-style compass, 0 degrees at north, increasing clockwise, since that's what the readout displays.
- `js/grimoire.js`: localStorage persistence and spell-code export/import. A spell is fully described by its data, so sharing one is just sharing a string, no server needed.

Direction and strength are computed, not looked up: each directional sign (Column, Pulling) contributes a force vector from its angle and drawn length, and the net direction/skew come from summing those vectors. Nothing about a specific element x sign combination is hardcoded. `compose.js` assembles the readout label from whatever generic parameters the placed signs happen to produce.

On the sigils: the five elements' glyphs here (three spokes for fire, a three-bladed whorl for air, and so on) are original shapes, not traced from the manga's artwork. Reproducing the source material's actual glyph designs pixel-for-pixel isn't something this project does, both because that art is copyrighted and because it isn't available as data this tool can read. The air sigil's three-bladed shape follows a documented detail (the wiki describes it as three-sided, unlike the other air-family sigils, with a noted resemblance to the fire sigil), not a copy of the drawn glyph itself.

## Adding a new sigil or sign

This is the part meant to grow as more of the source material's rules get pinned down.

- **New element**: add an entry to `SIGILS` in `js/data/sigils.js` (name, particle style for the cast animation) and a case in `SIGIL_PATHS` in `js/engine/render.js` for its glyph shape. Nothing else changes.
- **New sign archetype**: add an entry to `SIGN_ARCHETYPES` in `js/data/signs.js` with a `contribute()` function, and a rule in `classifyStroke()` in `js/engine/classify.js` for what shape triggers it. `compose.js`, the shape guide, and the readout all pick it up automatically.

## Deploying to GitHub Pages

1. `git init`, commit, push to a GitHub repo.
2. In the repo's Settings, Pages, set the source to the `master` branch, root directory.
3. No Actions workflow needed since there's no build step.
