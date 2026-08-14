# Atelier

A spell-circle workbench in the style of Witch Hat Atelier's magic system. Pick an element, draw signs freehand anywhere on the circle, and read what the composition resolves to.

No build step. No backend. Static HTML/CSS/JS, deployable as-is to GitHub Pages.

## Run locally

```
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## How it works

Nothing is pre-selected before you draw a sign. You draw one or more strokes anywhere on the circle (a pause of under a second locks the sign in, so a few strokes drawn close together in time count as one sign, matching how most of the reference glyphs are actually built from a spine plus a tick or two), and the shape decides which family it belongs to:

- straight, drawn outward: Column, Crosshair, or Enlarge
- straight, drawn inward: Pull or Direction
- wide sweep across many angles, outward: Dispersion, Radial, Rain, Billowing, or Weave
- wide sweep, inward: Convergence, Window, or Collection
- gentle back-and-forth wiggle that doesn't travel far from where it started: Levitation, Float, Bird, Dancing Puppet, Eye, or Vision
- sharp zigzag: Bolt or Bend
- closed loop, drawn smoothly: Diamond or Repetition
- closed loop, drawn chaotically: Crush

There's no shape difference between the signs within a family in the source material either. The stroke narrows it to a family; the sign-list row shows the rest of that family in a dropdown so you can say which one you actually meant, rather than the app pretending to detect a distinction that isn't there in the drawing.

- `js/engine/classify.js`: reads the geometry of a sign's strokes (how far it wobbles off a straight line rather than raw arc length, since a hand-drawn "straight" line still has a few pixels of tremor in it; angular spread from the ring's center; whether it closes into a loop) and returns a family and its default member. Closedness is checked on the whole shape first, before anything else, since a sharp-cornered outline (Diamond) would otherwise look identical to a zigzag. Everything else gets cut at its sharp corners, whether those corners came from separate strokes or from turning mid-drag in one continuous line, a corner is a corner either way, and judged by whether one part dominates the sign's total length: a T-shape's spine dominates and reads as Column even drawn as one stroke, a lightning-bolt zigzag has no dominant part and reads as Bolt. Deterministic heuristics, no model, no network call.
- `js/data/signatures.js`: recognizes a drawn spell as a named spellbook entry, but only for the two whose actual sign composition is documented on the wiki (Grasping Wind, Sylph Shoes Seal). The other 38 entries were never confirmed compositionally, so there's nothing honest to match against; faking that would be worse than not detecting them.
- `js/data/sigils.js`: the 8 elements (fire, water, earth, light, wind, wind underfoot, aeriforms, crystal).
- `js/data/signs.js`: the 24 sign archetypes, matching the named signs documented on the wiki. Each one has a `contribute(accumulator, instance)` function describing how it affects direction, spread, sustain, or raw intensity. Where the wiki doesn't document a sign's function (Bird, Eye, Vision, Dancing Puppet, Window), the comment says so, it's a placeholder grouped by feel, not a sourced fact.
- `js/data/spellbook.js`: 40 named canon spells for the reference gallery. Descriptions are only included where the wiki documents what the spell actually does; the rest show image and name only rather than a guessed description.
- `js/engine/compose.js`: pure function that reduces a chosen sigil + drawn signs into resolved parameters (direction, magnitude, spread, sustain, intensity) and an honest readout, including misfire warnings when directional signs cancel out.
- `js/engine/render.js`: canvas rendering. The ring and sign strokes are drawn from your actual recorded points. The sigil glyph is drawn from an image (see below).
- `js/engine/vector.js`: angle and compass-bearing math. Canvas angles put 0 degrees at east with y growing downward; `toBearing()` converts that to a map-style compass, 0 degrees at north, increasing clockwise, since that's what the readout displays.
- `js/grimoire.js`: localStorage persistence and spell-code export/import. A spell is fully described by its data, so sharing one is just sharing a string, no server needed.

Direction and strength are computed, not looked up: each directional sign contributes a force vector from its angle and drawn length, and the net direction/skew come from summing those vectors. Nothing about a specific element x sign combination is hardcoded. `compose.js` assembles the readout label from whatever generic parameters the placed signs happen to produce.

## The artwork

The sigil and sign glyphs in `assets/` are hand-drawn reconstructions of the canon designs, not traced from the manga's published pages. The spellbook gallery images are the same. This project doesn't reproduce the source material's actual printed artwork; that's copyrighted, and it also isn't available as data this tool could read even if that were the intent.

## Adding a new sigil or sign

This is the part meant to grow as more of the source material's rules get pinned down.

- **New element**: add an entry to `SIGILS` in `js/data/sigils.js` (name, particle style, image path) and put the image at that path. Nothing else changes.
- **New sign archetype**: add an entry to `SIGN_ARCHETYPES` in `js/data/signs.js` with a `contribute()` function and image path, and add it to the right family (or a new one) in `SIGN_BUCKETS` in `js/engine/classify.js`.
- **New spellbook entry**: add a row to `SPELLBOOK` in `js/data/spellbook.js` with an image path, and a `description` only if the wiki actually documents what it does.

## Deploying to GitHub Pages

1. `git init`, commit, push to a GitHub repo.
2. In the repo's Settings, Pages, set the source to the `master` branch, root directory.
3. No Actions workflow needed since there's no build step.
