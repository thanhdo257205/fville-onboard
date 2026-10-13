# First Day at F-Ville (Ngày Đầu Ở F-Ville)

A small 3D web game about an FPT Software intern's first onboarding day at the F-Ville 1 campus (Hòa Lạc).
Low-poly scenes are generated with Python scripts in Blender and exported to glTF; the game runs in the browser with
Vite + three.js.

- Play: https://thanhdo257205.github.io/fville-onboard/game/ · scene viewer: https://thanhdo257205.github.io/fville-onboard/viewer/
- Branches: `main` = source code, `gh-pages` = built site.
- Run locally: `npm --prefix game install` then `npm --prefix game run dev` (http://localhost:5180).
- Dances: press **T** or tap **🕺 Actions** to open the circular picker. Select **Breakdance** to play all 34 clips as one continuous routine;
  move or choose Stop to cancel the routine. Works offline; dance assets load on first use.
- Project guide (Vietnamese): [CLAUDE.md](CLAUDE.md) · design: [docs/GDD.md](docs/GDD.md) · progress: [docs/PROGRESS.md](docs/PROGRESS.md)

Credits: [CREDITS.md](CREDITS.md). Raw reference footage, Mixamo source files and Blender working files are not
included in this repository.
