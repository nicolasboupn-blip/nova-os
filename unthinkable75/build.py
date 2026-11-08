#!/usr/bin/env python3
"""Inline src/* into a single index.html (what NOVA loads from assets)."""
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
def rd(p):
    with open(os.path.join(here, p), encoding='utf-8') as f:
        return f.read()
tpl = rd('src/template.html')
out = (tpl.replace('/*@CSS@*/', rd('src/style.css'))
          .replace('/*@ENGINE@*/', rd('src/engine.js'))
          .replace('/*@UI@*/', rd('src/ui.js')))
dst = os.path.join(here, 'index.html')
with open(dst, 'w', encoding='utf-8') as f:
    f.write(out)
print('wrote', dst, len(out) // 1024, 'KB')
