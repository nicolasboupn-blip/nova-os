#!/usr/bin/env python3
"""Inline src/* into a single index2.html (v2: real-time Europe campaign)."""
import os
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(here, p), encoding='utf-8').read()
out = (rd('src/template2.html').replace('/*@CSS@*/', rd('src/style2.css')).replace('/*@MAP@*/', rd('src/mapdata.js'))
       .replace('/*@WAR@*/', rd('src/war.js')).replace('/*@M3D@*/', rd('src/models3d.js')).replace('/*@UI@*/', rd('src/ui2.js')))
open(os.path.join(here, 'index2.html'), 'w', encoding='utf-8').write(out)
print('wrote index2.html', len(out) // 1024, 'KB')
