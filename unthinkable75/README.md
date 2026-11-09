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

## v2 unit functions (carriers, engineers, SAMs)
- **Carriers**: M113/Fuchs, BTR-60/70 (1975); Boxer, BTR-82A (modern); truck convoys. Each carries 1 foot-infantry unit (inf, vdv, m_inf, r_vdv, engineers).
  Infantry: `BOARD CARRIER`, tap the carrier; it rides along at the carrier's speed. Carrier: `UNLOAD`. Passengers dismount automatically when the carrier is engaged or drops below 30% strength.
  If a carrier is destroyed, each passenger unit has a 50% chance to bail out (at ~55% strength) and fights on; the rest are lost.
- **Ambush** (combat units): hides after 20 quiet minutes, invisible to the enemy, fires only at 4 km or less, then gets +80% damage for 45 min.
- **Merge**: two units of the same type combine (target gets ~90% of the other's strength).
- **Engineers**: `MINES HERE / MINES AT`, 1 h to lay; 6 km minefield slows enemy ground units by half and hurts moving ones; enemy engineers clear it. `REPAIR NEARBY` heals friendly ground units within 6 km.
- **One-shot SAMs**: Patriot PAC-3, S-300, S-400 kill one whole aircraft unit per launch (helicopters excluded), one launch per 3 min per battery (`SAM_CD`), missiles limited (6 / 6 / 8) and reloaded near a friendly city. Other SAMs keep the old probabilistic damage.
- **Simple mode** (default in the unit dock): only the buttons that matter for the selection. `ALL OPTIONS` brings back the full five-tab panel, `Simple` returns.
- `node test/carry.js` covers all of the above headless.
