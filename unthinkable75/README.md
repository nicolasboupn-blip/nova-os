# Unthinkable '75

Alt-history turn-based campaign: Operation Unthinkable moved to summer 1975, NATO strikes east from the Fulda Gap toward Dresden.
Escalation ladder (0-5), tiered unit unlocks, logistics (trains, convoys, railhead), AWACS/tankers, fog and unknown contacts, politics.

- `src/engine.js` game logic (pure JS, seeded RNG, deterministic saves), `src/ui.js` UI, `src/style.css`, `src/template.html`
- `python3 build.py` -> single-file `index.html` (what NOVA loads)
- `node test/sim.js [games]` headless invariants + balance sim

## NOVA hosting
Load `file:///android_asset/unthinkable75/index.html` in a WebView (JS + DOM storage enabled) for 3 persistent save slots.
Optional bridge `NovaSave.get/set/del(key)` overrides localStorage. Hooks: `NovaHost.close()`, `NovaHost.expand()`.
URL params: `?slot=1`, `?mini=1`. JS API: `window.U75.mini()`, `.setMini(bool)`, `.open(slot)`.
The floating pop-out host (Java side) is not wired yet.

Note: E-3 AWACS is flagged as alt-history (entered service 1977). No Pact tanker modeled.
