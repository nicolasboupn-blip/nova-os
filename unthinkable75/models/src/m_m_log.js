'use strict';
/* ===== trucks, convoys, trains ===== */
function cargoTruck(id, name, side, game, col, dk, cover) {
  reg({ id, name, side, cat: 'Logistics', era: '1975', fx: 'none', game, spec: { Role: 'Supply convoy truck 6×6', Crew: '2', Load: '5 t', Speed: '80 km/h' }, build(m) {
    const h = truck(m, { col, len: 7.6, n: 3, r: .62 }); h.col(col, 0);
    h.box(0, 2.35, -1.3, 2.5, .08, 5.0, { c: dk }); // bed floor
    if (cover) { h.box(0, 2.9, -1.3, 2.5, 1.2, 5.0, { c: cover }); h.box(0, 3.5, -1.3, 2.3, .06, 4.9, { c: cover }); }
    else { h.mir(() => h.box(1.25, 2.6, -1.3, .06, .5, 5.0, { c: dk })); h.box(0, 2.6, -3.8, 2.5, .5, .06, { c: dk }); for (let i = 0; i < 4; i++) h.box(0, 2.6, -2.5 + i * 1.1, 1.6, .5, .9, { c: COL.brown }); }
  } });
}
cargoTruck('convoy', 'Supply Convoy Truck', 'NATO', ['convoy', 'train'].slice(0, 1), COL.nato, COL.natoDk, COL.od);
cargoTruck('pconvoy', 'Ural-375 Supply Truck', 'PACT', ['pconvoy'], COL.sovg, COL.sovdk, COL.sovdk);
/* engineers & infantry carriers reuse: bridge layer */
reg({ id: 'bridge', name: 'Bridge-Layer Tank', side: 'NATO', cat: 'Logistics', era: '1975', fx: 'none', game: ['eng'], spec: { Role: 'Armoured bridge layer', Crew: '2', Span: '22 m', Mass: '45 t' }, build(m) {
  const h = m.part('hull'); h.col(COL.nato, 0); tracks(h, { x: 1.5, tw: .55, rw: .32, nw: 6, zr: -2.0, zf: 1.6, sp: { z: -3.2, y: .6, r: .35 }, id: { z: 3.0, y: .55, r: .32 }, rollers: 0, t: .06, trackCol: COL.track, hubCol: COL.dkgrey });
  h.ext([[-3.4, .5], [2.6, .5], [3.3, .85], [3.3, 1.2], [2.0, 1.5], [-3.4, 1.5]], 2.8, { ax: 'x' });
  h.col(COL.natoDk, 0); h.box(0, 1.8, -.3, 3.6, .25, 10, {}); h.box(0, 2.0, -.3, 3.6, .1, 10, { c: COL.dkgrey }); for (let i = 0; i < 8; i++) h.box(0, 1.65, -4 + i * 1.1, 3.2, .2, .15, { c: COL.dkgrey });
  h.cyl(0, 1.7, 2.8, .2, .8, { ax: 'x', c: COL.dkgrey, n: 8 }); h.box(0, 1.55, 3.0, 1.0, .4, .8, { c: COL.natoDk }); } });
reg({ id: 'peng', name: 'MT-55 Bridge Layer', side: 'PACT', cat: 'Logistics', era: '1975', fx: 'none', game: ['peng'], spec: { Role: 'Armoured bridge layer', Crew: '2', Span: '18 m', Mass: '36 t' }, build(m) {
  const h = m.part('hull'); h.col(COL.sovg, 0); tracks(h, { x: 1.45, tw: .55, rw: .36, nw: 5, zr: -1.9, zf: 1.5, sp: { z: -3.0, y: .6, r: .33 }, id: { z: 2.9, y: .58, r: .33 }, rollers: 0, t: .06, trackCol: COL.track, hubCol: COL.dkgrey });
  h.ext([[-3.3, .5], [2.3, .5], [3.4, .9], [3.4, 1.0], [1.8, 1.45], [-3.3, 1.35]], 2.4, { ax: 'x' });
  h.col(COL.sovdk, 0); h.box(0, 1.7, -.2, 3.3, .22, 9, {}); for (let i = 0; i < 7; i++) h.box(0, 1.55, -3.8 + i * 1.1, 3.0, .2, .15, { c: COL.dkgrey }); h.box(0, 1.55, 2.8, .9, .4, .8, { c: COL.sovdk }); } });
