# Unthinkable '75 - 3D vehicle viewer (models/)

Procedural WebGL 3D models of every vehicle in the game (170 models, ~370 effect buttons). No assets, no CDN, one HTML file.

- `index.html` is the built viewer (open it directly, or in a NOVA WebView).
- `node build.js` rebuilds `index.html` from `src/*.js` (concatenated alphabetically) + `style.css` + `template.html`.
- `gamemap.json` maps **game unit ids** (`src/war.js`) to **model ids**. 157 of 159 ids are covered; `vdv` / `r_vdv` are foot infantry (no vehicle).
- Link to a model: `models/index.html#<game unit id or model id>`, e.g. `#m_m777`, `#e2d`, `#r_ropucha`. The hash also works on `hashchange`.
- `test/sweep.js` runs every model and every effect button headless (needs playwright + chrome) and prints errors (expect `"out": []`).

Contents: tanks, IFV/APC/wheeled, artillery (M777, M109, PzH2000, K9, MLRS/HIMARS...), missile launchers + SAMs, trucks, 2 trains (desert freight, scarlet steam express), aircraft (fighters, bombers, AWACS, E-2, transports), helicopters, drones, ships (VLS missile fire from Burke/subs), submarines.
Effects: tank/arty fire, missile launches with Call of War style trails, SAM intercepts, flight with afterburners, bomb runs, trains rolling.

Source files: `a_build` geometry, `b_gl` renderer/particles, `c_app` registry/app, `d_parts`, `m_*` model families, `n_fx*` effects, `y_ui` UI, `z_boot`.
Add a model: `reg({id,name,side,cat,era,fx,game:[unit ids],spec,build(m){...}})` in a `m_*.js` file, then `node build.js`.
