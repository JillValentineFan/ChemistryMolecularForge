# MoleculeForge

A VSEPR chemistry game where you don't take a quiz — you **forge** molecules.
Each correct answer assembles the molecule piece by piece, culminating in a
fully rendered cel-shaded 3D model that you can rotate, inspect, and add to
your Forged Collection.

The 3D models are the reward.

---

## Visual Style

Stylized 3D with **cel shading** (toon-quantized lighting in 4 brightness
bands) plus **inverted-hull outlines** (every mesh rendered twice — once
filled, once expanded with back-faces in dark color, producing a clean
black silhouette). The aesthetic of a textbook orbital chart, but alive.

| Color    | Meaning                                                    |
|----------|------------------------------------------------------------|
| Cyan `#38bdf8`    | s orbital                                          |
| Purple `#a855f7`  | p orbital · also primary UI accent                 |
| Pink `#ec4899`    | d orbital · also net-dipole arrow                  |
| Yellow `#facc15`  | f orbital · also formulas, scores, bond angles     |
| Orange `#fb923c`  | Lone pair (always — instantly distinguishes them)  |
| Cream `#fef3c7`   | Atom labels                                        |
| Green `#4ade80`   | Symmetric ✕ (bond dipoles cancel → nonpolar)       |

**Hybrid orbital colors are weighted blends** of the pure orbital colors,
weighted by hybridization composition. e.g., `sp³` = 25% s + 75% p, so its
lobes render in a purple-with-blue-tint hue. The color *is* the lesson.

Press **L** anywhere in the game to open the full Color Key.

---

## Modes

- **Forge** — Answer 4 questions per molecule (electron groups → electron
  geometry → AXₙEₘ + molecular geometry → polarity). Each correct answer
  triggers a stage of the assembly animation: central atom materialises with
  a particle burst, electron-domain guide lines extend, hybrid orbital lobes
  bloom outward and bonded atoms fly into them, dipole vectors visualise.
  Every 2 correct answers, a **VSEPR fact** appears at the top — 30 facts
  in the pool, drawn without immediate repeats.
- **Codex** — Reference mode. Browse all 16 molecules grouped by electron
  geometry. Detailed atom-by-atom info (atomic number, valence,
  electronegativity, period, role) plus pedagogical notes and toggleable
  bond-angle arcs.
- **Polarity Trial** — Speed round. 8 molecules, 15 seconds each, polar or
  nonpolar. Score depends on accuracy and speed.
- **Forged Collection** — Molecules saved via the "Add to Collection" button
  persist in `localStorage` between sessions.

---

## Tech

Pure HTML / CSS / JS. No build step. Three.js r160 via ES module CDN with
import map.

```
index.html       page shell + import map + meta tags + legend modal
styles.css       cel-shaded textbook palette
app.js           game state, mode routing, UI orchestration, legend, fact card
renderer.js      Three.js scene, toon shader, inverted-hull outline, animations
molecules.js     molecule data, ELEMENTS table, COLOR_LEGEND, VSEPR_FACTS
audio.js         procedural sound effects (Web Audio API)
og-card.svg      social share preview
```

Designed for desktop ≥ 1280 px width.

---

## Run Locally

ES module imports do **not** work via `file://` — you need an HTTP server.
Any static server works.

```bash
cd MoleculeForge

# Pick one:
python3 -m http.server 8000             # Python
npx serve .                             # Node (no install needed)
php -S localhost:8000                   # PHP
ruby -run -e httpd . -p 8000            # Ruby
```

Open `http://localhost:8000` in a desktop browser (Chrome / Firefox /
Safari / Edge).

---

## Keyboard Shortcuts

- **L** — open / close the Color Key from anywhere
- **Esc** — close the Color Key
- **← / →** — cycle molecules in Codex mode

---

## Deploy / Host

The project is fully static — no build, no server, no API. Drop the folder
on any static host. Three options below, easiest first.

### Option 1: GitHub Pages (free, recommended)

```bash
cd MoleculeForge
git init
git add .
git commit -m "Initial commit"

# Create the repo on github.com first, then:
git branch -M main
git remote add origin https://github.com/<your-username>/MoleculeForge.git
git push -u origin main
```

Then on github.com → repo → **Settings** → **Pages**:
- **Source**: `Deploy from a branch`
- **Branch**: `main`, folder `/ (root)`
- **Save**

Live at `https://<your-username>.github.io/MoleculeForge/` in ~1 minute.
Future `git push` triggers redeploy automatically.

### Option 2: Netlify (free, drag-and-drop or git)

- Visit [app.netlify.com/drop](https://app.netlify.com/drop) and drag the
  `MoleculeForge` folder in.
- Or connect your GitHub repo: pick the repo, leave build command empty,
  publish directory `.` — that's it.

### Option 3: Cloudflare Pages / Vercel

Both work the same: connect the GitHub repo, no build command, output
directory `.`. Deploy.

### Why it works at any subpath

- All local references in `index.html` are relative (`styles.css`, `app.js`,
  `og-card.svg`).
- All ES module imports are relative (`./molecules.js`, etc.) or bare
  specifiers resolved via the import map.
- Three.js is loaded from a CDN, absolute by design.
- No `/`-prefixed paths anywhere — no rewrites, no `<base href>` needed.

---

## Molecules (16 total)

| Electron Geometry      | Molecules                  |
|------------------------|----------------------------|
| Linear                 | BeCl₂, CO₂, HCl, XeF₂      |
| Trigonal Planar        | BF₃, SO₂                   |
| Tetrahedral            | CH₄, NH₃, H₂O, NH₄⁺        |
| Trigonal Bipyramidal   | PCl₅, SF₄, ClF₃            |
| Octahedral             | SF₆, BrF₅, XeF₄            |

All bond angles, lone-pair geometries, and polarities follow standard
textbook treatment. Coordinates are pre-computed in `molecules.js` (single
source of truth).

---

## Credits

Built with [Three.js](https://threejs.org/). CPK colors per Jmol convention.
Cel-shading + inverted-hull outline technique is standard for stylized 3D
(originated with *Jet Set Radio*, 2000). VSEPR pedagogy follows standard
general-chemistry treatment.
