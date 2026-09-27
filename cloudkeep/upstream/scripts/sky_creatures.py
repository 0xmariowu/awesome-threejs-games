"""Distinct, softly sculpted additions to the Cloudkeep creature library."""
import math
from modeling import TAU, linear, mix, material, mesh, sphere, tube, parent


def build_sky_creatures(M, begin, eye):
    def petal(name, side, span, forward, color_a, color_b, parent_name):
        vertices, faces, colors = [], [], []
        def point(t, u):
            chord = (.70 if forward else .64) * math.sin(math.pi * t) ** .62
            center = (.18 + .73 * t) if forward else (-.15 - .92 * t)
            return (side * (.15 + span * t), center + u * chord, .12 + .27 * t * t + .10 * math.sin(t * math.pi) * (1 - u * u))
        for j in range(33):
            t = j / 32
            for i in range(21):
                u = i / 10 - 1
                vertices.append(point(t, u))
                base = mix(linear(color_a), linear(color_b), min(1, t * .75 + abs(u) * .20))
                spot = ((t - .68) / .115) ** 2 + ((u - .04) / .28) ** 2
                if forward and spot < 1.35:
                    base = mix(base, linear('#bd7849' if spot > .78 else '#f8eab5'), .72)
                colors.append(base)
        for j in range(32):
            for i in range(20):
                a = j * 21 + i
                faces.append((a, a + 21, a + 22, a + 1) if side > 0 else (a + 1, a + 22, a + 21, a))
        parts = [mesh(name, vertices, faces, M['fin'], colors)]
        for u in [-.8, -.45, 0, .45, .8]:
            parts.append(tube('Fine wing vein', [tuple(p + (.007 if k == 2 else 0) for k, p in enumerate(point(.025 + t / 25 * .95, u))) for t in range(26)], .005, M['fin'], '#e6b769', 5))
        return parent(parent_name, parts, (side * .16, .05, .12))

    begin('moth')
    sphere('Velvet moth thorax', (0, -.02, .16), (.23, .67, .22), M['skin'], '#f5d69b', 32, 18)
    sphere('Soft moth head', (0, .54, .22), (.24, .23, .23), M['skin'], '#fff0c5', 28, 16)
    for side in [-1, 1]:
        eye(side * .17, .61, .28, .097)
        petal('Broad sun moth forewing', side, 2.20, True, '#e8a164', '#fff0bb', 'wing_left' if side < 0 else 'wing_right')
        petal('Rounded moth hindwing', side, 1.61, False, '#e6b27e', '#fff2d5', 'hind_left' if side < 0 else 'hind_right')
        tube('Curled moth antenna', [(side * .10, .69, .32), (side * .27, .90, .59), (side * .41, 1.14, .63), (side * .49, 1.24, .52)], [.028, .021, .014, .006], M['skin'], '#af8954', 8)
        sphere('Antenna pollen light', (side * .49, 1.24, .52), (.045, .045, .06), M['glow'], segments=12, rings=8)
    for j in range(5):
        sphere('Soft abdominal segment', (0, -.40 - j * .13, .13), (.17 - j * .018, .16, .14 - j * .015), M['skin'], '#e5ba73', 18, 10)

    begin('koi')
    vertices, faces, colors = [], [], []
    n, rings = 48, 52
    patches = [(-.10, .86, .46, .52), (.31, -.05, .29, .62), (-.27, -.66, .32, .34)]
    for j in range(rings + 1):
        t = j / rings; y = -1.55 + 3.25 * t
        radius = .53 * max(.0001, math.sin(t * math.pi)) ** .63
        for i in range(n):
            a = TAU * i / n; x = radius * math.cos(a); z = radius * 1.14 * math.sin(a)
            vertices.append((x, y, z))
            base = mix(linear('#fff3d7'), linear('#e8d5b2'), max(0, -math.sin(a)) * .23)
            for px, py, rx, ry in patches:
                d = ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2
                if d < 1.15 and z > -.2: base = mix(base, linear('#e18b58'), min(.9, (1.15 - d) * 5))
            colors.append(base)
    for j in range(rings):
        for i in range(n):
            a, b = j * n + i, j * n + (i + 1) % n
            faces.append((a, a + n, b + n, b))
    mesh('Porcelain koi body with painted patches', vertices, faces, M['skin'], colors)
    for side in [-1, 1]:
        eye(side * .38, 1.06, .19, .115)
        tube('Flowing koi whisker', [(side * .14, 1.59, -.13), (side * .28, 1.79, -.20), (side * .48, 1.65, -.25)], [.028, .018, .006], M['fin'], '#f8e2b2', 8)
        parts, v, f, c = [], [], [], []
        for j in range(25):
            t = j / 24
            for i in range(15):
                u = i / 14
                v.append((side * (.37 + 1.05 * t), .32 - .92 * t + (u - .5) * .75 * math.sin(math.pi * t), -.23 - .15 * t + .08 * math.sin(u * math.pi)))
                c.append(mix(linear('#eccb9e'), linear('#fff4d8'), t))
        for j in range(24):
            for i in range(14):
                a = j * 15 + i; f.append((a, a + 15, a + 16, a + 1))
        parts.append(mesh('Silk koi pectoral fin', v, f, M['fin'], c))
        parent('wing_left' if side < 0 else 'wing_right', parts, (side * .37, .32, -.23))
    tail_parts = []
    for side in [-1, 1]:
        v, f, c = [], [], []
        for j in range(29):
            t = j / 28
            for i in range(17):
                u = i / 16
                v.append((.055 * math.sin(u * math.pi) * t, -1.32 - 1.40 * t + .45 * u * math.sin(t * math.pi), side * (t * .95 + (u - .5) * .38 * math.sin(t * math.pi))))
                c.append(mix(linear('#efb67f'), linear('#fff4d5'), t * .8 + u * .15))
        for j in range(28):
            for i in range(16):
                a = j * 17 + i; f.append((a, a + 17, a + 18, a + 1))
        tail_parts.append(mesh('Forked silk koi tail', v, f, M['fin'], c))
    parent('tail', tail_parts, (0, -1.32, 0))
    v = [(-.018, .6 - i * .16, .4 + math.sin(i / 10 * math.pi) * .43) for i in range(11)] + [(0, .6 - i * .16, .32) for i in range(11)]
    mesh('Soft koi dorsal sail', v, [(i, i + 1, i + 12, i + 11) for i in range(10)], M['fin'], [linear('#f2d4a7')] * 22)

    begin('jelly')
    opal = material('Opal skin', roughness=.30)
    v, f, c = [], [], []
    n, rows = 64, 28
    for j in range(rows + 1):
        t = j / rows
        for i in range(n):
            a = TAU * i / n
            r = 1.10 * math.sin(t * math.pi / 2) * (1 + .035 * math.cos(a * 8) * t ** 3)
            z = .15 + 1.12 * math.cos(t * math.pi / 2) + .055 * math.cos(a * 8) * t ** 5
            v.append((r * math.cos(a), r * math.sin(a), z))
            c.append(mix(linear('#daf5dd'), linear('#6bc8b6'), t * .59 + max(0, math.cos(a * 8)) * .08))
    for j in range(rows):
        for i in range(n):
            a, b = j * n + i, j * n + (i + 1) % n
            f.append((a, a + n, b + n, b))
    mesh('Scalloped opal jelly bell', v, f, opal, c)
    sphere('Luminous jelly heart', (0, 0, .04), (.49, .49, .29), M['glow'], segments=32, rings=18)
    for side in [-1, 1]: eye(side * .32, .86, .42, .115)
    for k in range(8):
        a = k * TAU / 8
        parts = []
        points = []
        for j in range(23):
            t = j / 22
            r = .72 + .13 * math.sin(t * 5 + k)
            points.append((math.cos(a) * r + .16 * math.sin(t * 7 + k) * t, math.sin(a) * r + .13 * math.cos(t * 6 + k) * t, .12 - t * (1.9 + .23 * math.sin(k))))
        parts.append(tube('Long floating jelly tendril', points, [.043 * (1 - j / 25) for j in range(23)], M['fin'], '#b9e1c9', 8))
        parts.append(sphere('Tendril dew pearl', points[-1], (.046, .046, .073), M['glow'], segments=12, rings=8))
        parent(f'tentacle_{k}', parts, points[0])
    for k in range(8):
        a = k * TAU / 8
        sphere('Scalloped jelly fringe', (.91 * math.cos(a), .91 * math.sin(a), .13), (.23, .23, .13), opal, '#d9efc9', 20, 12)
