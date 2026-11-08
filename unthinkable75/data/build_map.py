#!/usr/bin/env python3
"""Builds src/mapdata.js (Europe 1975 theatre) from Natural Earth (public domain) + OurAirports (public domain).
Usage: python3 build_map.py <natural-earth-vector/geojson dir> <ourairports-data dir> <out mapdata.js>
Everything is projected to a flat km grid (equirectangular, standard parallel 50N)."""
import sys, json, csv, math, base64
import numpy as np
from PIL import Image, ImageDraw

NE, OA, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
LON0, LON1, LAT0, LAT1 = -10.0, 40.0, 36.0, 65.0
KM = 111.195
CX = math.cos(math.radians(50))
W = round((LON1 - LON0) * CX * KM); H = round((LAT1 - LAT0) * KM)
CELL = 8
GW, GH = W // CELL + 1, H // CELL + 1

def P(lon, lat):
    return ((lon - LON0) * CX * KM, (LAT1 - lat) * KM)

# ---- 1975 blocs by ADM0_A3  (1 NATO, 2 Pact, 3 neutral)
NATO = 'USA GBR FRA DEU BEL NLD LUX DNK NOR ISL ITA PRT GRC TUR CAN'.split()
PACT = 'POL CZE SVK HUN ROU BGR RUS UKR BLR LTU LVA EST MDA'.split()
NEUT = 'SWE FIN CHE AUT IRL ESP SRB HRV SVN BIH MNE MKD KOS ALB LIE SMR VAT MCO AND MLT'.split()
BLOC = {c: 1 for c in NATO}; BLOC.update({c: 2 for c in PACT}); BLOC.update({c: 3 for c in NEUT})
# ISO2 -> ADM0_A3 for the point datasets (cities/airfields carry ISO_A2 / iso_country)
ISO2 = {'US':'USA','GB':'GBR','FR':'FRA','DE':'DEU','BE':'BEL','NL':'NLD','LU':'LUX','DK':'DNK','NO':'NOR','IS':'ISL','IT':'ITA','PT':'PRT','GR':'GRC','TR':'TUR',
        'PL':'POL','CZ':'CZE','SK':'SVK','HU':'HUN','RO':'ROU','BG':'BGR','RU':'RUS','UA':'UKR','BY':'BLR','LT':'LTU','LV':'LVA','EE':'EST','MD':'MDA',
        'SE':'SWE','FI':'FIN','CH':'CHE','AT':'AUT','IE':'IRL','ES':'ESP','RS':'SRB','HR':'HRV','SI':'SVN','BA':'BIH','ME':'MNE','MK':'MKD','XK':'KOS','AL':'ALB',
        'LI':'LIE','SM':'SMR','VA':'VAT','MC':'MCO','AD':'AND','MT':'MLT'}

# East Germany (approximate outline, lon/lat) - NE has only unified Germany
GDR = [(10.75,54.05),(14.3,54.05),(14.2,53.9),(14.1,53.3),(14.45,52.7),(14.75,52.2),(14.7,51.5),(14.9,51.05),(14.8,50.85),(14.3,50.9),(13.5,50.7),(12.9,50.4),(12.2,50.25),
       (11.9,50.4),(11.25,50.35),(10.95,50.3),(10.4,50.55),(9.95,50.75),(10.0,51.0),(10.1,51.35),(10.25,51.55),(10.65,51.65),(10.7,51.9),(11.1,52.1),(10.95,52.45),(10.85,52.8),
       (10.7,53.1),(10.9,53.4),(10.8,53.5),(10.8,53.9)]

def inside(poly, x, y):
    c = False; n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i+1) % n]
        if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1)+x1: c = not c
    return c

def bloc_of(a3, lon, lat):
    if a3 == 'DEU' and inside(GDR, lon, lat): return 2
    return BLOC.get(a3, 0)

# ---- helpers
def rdp(pts, eps):
    pts = np.asarray(pts, float)
    if len(pts) < 3: return pts
    keep = np.zeros(len(pts), bool); keep[0] = keep[-1] = True
    stack = [(0, len(pts)-1)]
    while stack:
        a, b = stack.pop()
        if b <= a+1: continue
        p, q = pts[a], pts[b]; d = q-p; L = math.hypot(*d)
        seg = pts[a+1:b]
        dist = np.hypot(*(seg-p).T) if L == 0 else np.abs(d[0]*(seg[:,1]-p[1])-d[1]*(seg[:,0]-p[0]))/L
        i = int(np.argmax(dist))
        if dist[i] > eps:
            k = a+1+i; keep[k] = True; stack += [(a, k), (k, b)]
    return pts[keep]

def clip_ring(ring):   # Sutherland-Hodgman to lon/lat bbox
    def clip(pts, inside_f, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i-1], pts[i]
            ia, ib = inside_f(a), inside_f(b)
            if ib:
                if not ia: out.append(inter(a, b))
                out.append(b)
            elif ia: out.append(inter(a, b))
        return out
    def ix(x): return lambda a, b: (x, a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]))
    def iy(y): return lambda a, b: (a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]), y)
    pts = [tuple(p[:2]) for p in ring]
    for f, it in ((lambda p: p[0] >= LON0, ix(LON0)), (lambda p: p[0] <= LON1, ix(LON1)),
                  (lambda p: p[1] >= LAT0, iy(LAT0)), (lambda p: p[1] <= LAT1, iy(LAT1))):
        if not pts: return []
        pts = clip(pts, f, it)
    return pts

def enc(pts):
    q = [(round(x), round(y)) for x, y in pts]
    out = [q[0][0], q[0][1]]
    for i in range(1, len(q)): out += [q[i][0]-q[i-1][0], q[i][1]-q[i-1][1]]
    return out

def area(r):
    return abs(sum(r[i][0]*r[i-1][1]-r[i-1][0]*r[i][1] for i in range(len(r))))/2

# ---- countries -> land polygons + bloc grid
cj = json.load(open(NE + '/ne_10m_admin_0_countries.geojson'))
land, owner_img = [], Image.new('L', (GW, GH), 0)
dr = ImageDraw.Draw(owner_img)
def gpix(lon, lat):
    x, y = P(lon, lat); return (x/CELL, y/CELL)
countries_seen = set()
for f in cj['features']:
    pr = f['properties']; a3 = pr.get('ADM0_A3') or pr.get('adm0_a3')
    if a3 == 'FRA' and pr.get('SOVEREIGNT') != 'France': continue
    if a3 not in BLOC: continue
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        ring = clip_ring(poly[0])
        if len(ring) < 3: continue
        countries_seen.add(a3)
        xy = [P(*p) for p in ring]
        if area(xy) < 250: continue          # tiny islands (<250 km2) are skipped
        if a3 == 'FRA' and ring[0][0] < LON0: continue
        land.append(enc(rdp(xy + [xy[0]], 1.5)))
        # raster: draw bloc 1/2/3; Germany handled per cell below
        v = BLOC[a3]
        dr.polygon([gpix(*p) for p in ring], fill=(9 if a3 == 'DEU' else v))
        for hole in poly[1:]:
            h = clip_ring(hole)
            if len(h) > 2: dr.polygon([gpix(*p) for p in h], fill=0)
grid = np.array(owner_img)
# Germany: cells flagged 9 become NATO(1) or Pact(2)
ys, xs = np.where(grid == 9)
for y, x in zip(ys, xs):
    lon = LON0 + (x*CELL + CELL/2)/(CX*KM); lat = LAT1 - (y*CELL + CELL/2)/KM
    grid[y, x] = 2 if inside(GDR, lon, lat) else 1
print('land polys', len(land), 'countries', len(countries_seen), 'grid', GW, GH)

# ---- borders
borders = []
bj = json.load(open(NE + '/ne_10m_admin_0_boundary_lines_land.geojson'))
def lines_of(g):
    return g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
def clip_line(coords, gap=45):
    # splits at the bbox edge and at long jumps (ferry links across water)
    segs, cur = [], []
    for lon, lat in coords:
        if LON0 <= lon <= LON1 and LAT0 <= lat <= LAT1:
            q = P(lon, lat)
            if cur and math.hypot(q[0]-cur[-1][0], q[1]-cur[-1][1]) > gap:
                if len(cur) > 1: segs.append(cur)
                cur = []
            cur.append(q)
        else:
            if len(cur) > 1: segs.append(cur)
            cur = []
    if len(cur) > 1: segs.append(cur)
    return segs
for f in bj['features']:
    for ln in lines_of(f['geometry']):
        for s in clip_line(ln, 1e9):
            borders.append(enc(rdp(s, 1.5)))
# the Iron Curtain: inner German border (approximate)
ic = [(10.8,53.9),(10.95,53.6),(10.9,53.4),(10.7,53.1),(10.85,52.8),(10.95,52.45),(11.1,52.1),(10.7,51.9),(10.65,51.65),(10.25,51.55),(10.1,51.35),(10.0,51.0),(9.95,50.75),(10.4,50.55),(10.95,50.3),(11.25,50.35),(11.9,50.4),(12.2,50.25)]
iron = [enc([P(*p) for p in ic])]
print('borders', len(borders))

# ---- roads and rails (+ passability rasters)
def raster(lines, width=1):
    im = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(im)
    for pts in lines: d.line([(x/CELL, y/CELL) for x, y in pts], fill=1, width=width)
    return np.array(im)
road_lines, road_draw = [], []
rj = json.load(open(NE + '/ne_10m_roads.geojson'))
for f in rj['features']:
    pr = f['properties']
    if pr.get('featurecla') != 'Road': continue
    t = pr.get('type') or ''
    if t not in ('Major Highway', 'Secondary Highway', 'Beltway'): continue
    for ln in lines_of(f['geometry']):
        for s in clip_line(ln):
            r = rdp(s, 1.0)
            if len(r) > 1:
                road_lines.append(r)
                road_draw.append((1 if t == 'Major Highway' else 2, enc(r)))
rail_lines, rail_draw = [], []
rl = json.load(open(NE + '/ne_10m_railroads.geojson'))
for f in rl['features']:
    pr = f['properties']
    if (pr.get('continent') or 'Europe') not in ('Europe', 'Asia'): continue
    for ln in lines_of(f['geometry']):
        for s in clip_line(ln):
            r = rdp(s, 1.0)
            if len(r) > 1:
                rail_lines.append(r)
                rail_draw.append(enc(r))
print('roads', len(road_draw), 'rails', len(rail_draw))
landmask = grid > 0
roads = raster(road_lines, 1).astype(bool) & landmask
rails = raster(rail_lines, 1).astype(bool) & landmask

def pack(b): return base64.b64encode(np.packbits(b.astype(np.uint8).ravel()).tobytes()).decode()
def rle(a):
    flat = a.ravel(); out = []; i = 0; n = len(flat)
    idx = np.flatnonzero(np.diff(flat)) + 1
    starts = np.concatenate(([0], idx)); ends = np.concatenate((idx, [n]))
    for s, e in zip(starts, ends): out += [int(flat[s]), int(e-s)]
    return out

# ---- cities
cities = []
pj = json.load(open(NE + '/ne_10m_populated_places_simple.geojson'))
cand = []
for f in pj['features']:
    pr = f['properties']; lon, lat = pr['longitude'], pr['latitude']
    if not (LON0 < lon < LON1 and LAT0 < lat < LAT1): continue
    a3 = ISO2.get(pr['iso_a2'])
    if a3 not in BLOC: continue
    x, y = P(lon, lat); gx, gy = int(x//CELL), int(y//CELL)
    if grid[min(gy, GH-1), min(gx, GW-1)] == 0: continue
    pop = pr['pop_max'] or 0
    cap = 1 if (pr.get('adm0cap') == 1 and pr.get('featurecla', '').startswith('Admin-0 capital')) else 0
    if pop >= 90000 or cap: cand.append((pop, pr['nameascii'] or pr['name'], x, y, lon, lat, a3, cap))
cand.sort(reverse=True)
for c in cand:
    if any(math.hypot(c[2]-o[2], c[3]-o[3]) < 14 for o in cities): continue
    cities.append(c)
cities_out = [[c[1], round(c[2]), round(c[3]), round(c[0]/1000), c[6], c[7], int(bloc_of(c[6], c[4], c[5]))] for c in cities]
print('cities', len(cities_out))

# ---- airfields (OurAirports; modern database - some fields opened after 1975)
rw = {}
for r in csv.DictReader(open(OA + '/runways.csv')):
    if r['closed'] == '1': continue
    try: ln = float(r['length_ft'] or 0)*0.3048
    except ValueError: continue
    paved = any(k in (r['surface'] or '').upper() for k in ('ASP', 'CON', 'BIT', 'PEM', 'TAR', 'PAV'))
    cur = rw.get(r['airport_ident'], (0, False))
    if paved and ln > cur[0] or (not cur[1] and ln > cur[0] and not paved):
        rw[r['airport_ident']] = (ln, paved)
MIL = ('AIR BASE', 'AIRBASE', ' AB', 'MILITARY', 'FLIEGERHORST', 'LUFTWAFFE', 'RAF ', 'BASE A', 'BASE AERIENNE', 'AERODROMO MILITAR', 'AEROPORTO MILITARE', 'NAVAL AIR', 'ARMY AIR', 'AFB', 'AIR FORCE')
af = []
for r in csv.DictReader(open(OA + '/airports.csv')):
    if r['type'] not in ('large_airport', 'medium_airport', 'small_airport'): continue
    a3 = ISO2.get(r['iso_country'])
    if a3 not in BLOC: continue
    lon, lat = float(r['longitude_deg']), float(r['latitude_deg'])
    if not (LON0 < lon < LON1 and LAT0 < lat < LAT1): continue
    ln, paved = rw.get(r['ident'], (0, False))
    name = r['name']; mil = any(k in name.upper() for k in MIL)
    ok = r['type'] in ('large_airport', 'medium_airport') and (ln >= 1300 or mil) or (r['type'] == 'small_airport' and paved and ln >= 1500) or (mil and ln >= 1100)
    if not ok: continue
    x, y = P(lon, lat); gx, gy = int(x//CELL), int(y//CELL)
    if grid[min(gy, GH-1), min(gx, GW-1)] == 0: continue
    af.append([name, r['ident'], round(x), round(y), int(ln), 3 if r['type'] == 'large_airport' else 2 if r['type'] == 'medium_airport' else 1, 1 if mil else 0, a3, int(bloc_of(a3, lon, lat))])
print('airfields', len(af))

data = dict(W=W, H=H, cell=CELL, gw=GW, gh=GH, lon0=LON0, lat1=LAT1, cx=CX, km=KM,
            land=land, borders=borders, iron=iron, roadsD=road_draw, rails=rail_draw,
            grid=rle(grid), roadBits=pack(roads), railBits=pack(rails),
            cities=cities_out, air=af)
s = json.dumps(data, separators=(',', ':'))
with open(OUT, 'w') as f: f.write('window.U75MAP=' + s + ';\n')
print('wrote', OUT, len(s)//1024, 'KB')
