# DONE: all models below exist in `models/` (see models/README.md, models/gamemap.json). Open `models/index.html#<unit id>`.

# New units / mechanics added by the engine session (please give them models)

Needs a 3D/icon model (ids as in `src/war.js`):
- Air: `e2` E-2 Hawkeye, `e2d` E-2D, `c130` C-130 Hercules, `m_c130` C-130J/A400M, `an12` An-12, `r_il76` Il-76
- Sea: `m_roro`, `r_sealift` (transport ships), `m_lhd` (Wasp/Mistral LHD), `r_ropucha` (modern Ropucha)
- Ground: `m_m777` M777 155 mm towed howitzer
- Already existing but make sure each has an icon: kc135, kc46, e3, e7, a50, tu126, ec121

New mechanics: AWACS/E-2/tankers see everything within 300 km (`eye`), transport aircraft take a `lift` order (air-lift a ground unit),
fighters hit parked aircraft with 2 A/A missiles, ship missiles can hit land targets, blockades (sea control), `statusOf(u)` unit status text.

The 3D view is wired into the game: the **3D** button in the unit panel opens `src/models3d.js` (built from `models/src`, ids via `models/gamemap.json`). Rebuild it after changing models: see `tools in README`.
