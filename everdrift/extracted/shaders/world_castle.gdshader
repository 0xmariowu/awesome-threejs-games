shader_type spatial;
// The Castle of Four Winds (spec §5.2, §5.3): the ruin in the valley and the whole interior in a few merged meshes
// (one per material, level_mesh.gd CastleKit), so the castle costs a handful of draw calls. Each vertex carries its
// piece's style in UV2.y and the height of its floor in UV2.x; COLOR tints it:
//   0 stone   pale ashlar in world-space courses (0.42 m high, 0.9 m bricks, alternate rows offset), dark mortar,
//             each block a little lighter or darker; flat tops become big flagstones; grime rises from the floor
//   1 marble  the foyer's floor: a checker of two marbles (2 m tiles) with veins and grout
//   2 wood    planks along the piece's longest horizontal run, with grain
//   3 gold    a warm metal: bright, a hard toy highlight
//   4 plain   the vertex colour as it is (carpet, cloth, the dark of windows)
//   5 slate   roof tiles in rows of scallops
//   6 ivy     leafy green clumps
//   7 marked  the stone of a wall made for kicking off: three teal grooves down each face (the chimney)
// Dust (`dust`, 0..1) settles on everything that faces up: a pale grey in soft patches, heavier in the corners the
// noise picks. The interior uses a lot of it, the ruin outside a little. Lit by the world's toon ramp
// (world_lighting.gdshaderinc), so it sits with the islands; indoors the moonlight and the torches do the mood.
render_mode specular_disabled;

#include "res://shaders/world_lighting.gdshaderinc"

uniform vec3 stone_a : source_color = vec3(0.86, 0.84, 0.8);
uniform vec3 stone_b : source_color = vec3(0.74, 0.72, 0.7);
uniform vec3 mortar : source_color = vec3(0.45, 0.43, 0.42);
uniform vec3 marble_a : source_color = vec3(0.93, 0.9, 0.84);
uniform vec3 marble_b : source_color = vec3(0.42, 0.46, 0.58);
uniform vec3 wood_a : source_color = vec3(0.58, 0.36, 0.22);
uniform vec3 wood_b : source_color = vec3(0.45, 0.27, 0.16);
uniform vec3 gold_a : source_color = vec3(1.0, 0.8, 0.34);
uniform vec3 slate_a : source_color = vec3(0.36, 0.4, 0.55);
uniform vec3 ivy_a : source_color = vec3(0.3, 0.58, 0.26);
uniform vec3 groove : source_color = vec3(0.12, 0.62, 0.66);
uniform vec3 dust_color : source_color = vec3(0.78, 0.76, 0.74);
uniform float dust = 0.35;
uniform float grime = 0.35;
uniform float tile = 2.0;
// Wall block size (m, width x course height): the ruin outside keeps small bricks; the foyer uses big ashlar, which
// reads as a grand hall rather than a tiled room.
uniform vec2 block = vec2(0.9, 0.42);
// Walls darken with height above their floor (0 = off): the foyer's upper walls and vault sink into the night, so
// the moonlit floor, the paintings and the flames carry the room.
uniform float height_dark = 0.0;
uniform float height_dark_span = 9.0;

varying vec3 wpos;
varying vec3 wnrm;
varying vec2 info;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize(mat3(MODEL_MATRIX) * NORMAL);
	info = UV2;
}

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

// 1 on a line of width w (in cells) at the integer grid lines of x, anti-aliased.
float grid_line(float x, float w) {
	float d = abs(fract(x + 0.5) - 0.5);
	float aa = max(fwidth(x), 1e-4);
	return 1.0 - smoothstep(w - aa, w + aa, d);
}

// Face coordinates: (along, up) on walls, the ground plane on tops.
vec2 face_uv(vec3 n) {
	if (abs(n.y) > 0.6) {
		return wpos.xz;
	}
	return vec2(abs(n.x) > abs(n.z) ? wpos.z : wpos.x, wpos.y);
}

void fragment() {
	vec3 n = normalize(wnrm);
	float style = info.y;
	float above = wpos.y - info.x;
	vec3 tint = COLOR.rgb;
	vec3 col;
	float up = smoothstep(0.55, 0.9, n.y);
	vec2 f = face_uv(n);
	if (style < 0.5 || style > 6.5) {
		vec2 cell;
		float lines;
		if (abs(n.y) > 0.6) {
			// Flagstones: 1.2 m, rows offset.
			vec2 q = f / 1.2;
			q.x += 0.5 * step(0.5, fract(floor(q.y) * 0.5));
			cell = floor(q);
			lines = max(grid_line(q.x, 0.03), grid_line(q.y, 0.03));
		} else {
			vec2 q = f / block;
			q.x += 0.5 * step(0.5, fract(floor(q.y) * 0.5));
			cell = floor(q);
			lines = max(grid_line(q.x, 0.035), grid_line(q.y, 0.06));
		}
		float h = hash21(cell);
		col = mix(stone_a, stone_b, h * 0.8 + 0.2 * vnoise(f * 3.0));
		col *= 0.94 + 0.12 * vnoise(f * 9.0 + cell);
		col = mix(col, mortar, lines * 0.75);
		if (style > 6.5 && abs(n.y) < 0.6) {
			// Three grooves a metre apart down the face, with a pale lip.
			float g = f.x / 1.0 + 0.5;
			float line = grid_line(g, 0.07);
			float lip = grid_line(g, 0.12) - line;
			col = mix(col, stone_a * 1.1, lip * 0.6);
			col = mix(col, groove, line);
		}
	} else if (style < 1.5) {
		vec2 q = wpos.xz / tile;
		vec2 id = floor(q);
		float checker = mod(id.x + id.y, 2.0);
		float vein_n = vnoise(wpos.xz * 1.3 + id * 7.0) * 6.0;
		float vein = 1.0 - smoothstep(0.0, 0.08, abs(sin(wpos.x * 1.7 + wpos.z * 0.9 + vein_n)));
		vec3 m = mix(marble_a, marble_b, checker);
		m = mix(m, m * (checker > 0.5 ? 1.35 : 0.72), vein * 0.5);
		m *= 0.95 + 0.08 * vnoise(wpos.xz * 4.0);
		float grout = max(grid_line(q.x, 0.012), grid_line(q.y, 0.012));
		col = mix(m, mortar * 0.8, grout);
	} else if (style < 2.5) {
		float along = abs(n.y) > 0.6 ? wpos.x : f.x;
		float across = abs(n.y) > 0.6 ? wpos.z : f.y;
		float plank = floor(across / 0.28);
		float grain = vnoise(vec2(along * 2.0, across * 40.0 + plank * 13.0));
		col = mix(wood_a, wood_b, grain * 0.7 + 0.3 * hash21(vec2(plank, 3.0)));
		col = mix(col, wood_b * 0.55, grid_line(across / 0.28, 0.03));
	} else if (style < 3.5) {
		col = gold_a * (0.9 + 0.2 * vnoise(f * 6.0));
	} else if (style < 4.5) {
		col = vec3(1.0);
	} else if (style < 5.5) {
		vec2 q = vec2(f.x / 0.5, wpos.y / 0.32);
		q.x += 0.5 * step(0.5, fract(floor(q.y) * 0.5));
		float scallop = length(vec2(fract(q.x) - 0.5, (fract(q.y) - 0.1) * 0.9));
		col = slate_a * (0.8 + 0.25 * hash21(floor(q))) * (1.0 - 0.3 * smoothstep(0.45, 0.55, scallop));
	} else {
		float leaf = vnoise(f * 7.0) * 0.6 + vnoise(f * 17.0) * 0.4;
		col = mix(ivy_a * 0.55, ivy_a * 1.15, leaf);
	}
	col *= tint;
	// Grime climbing from the floor, and dust lying on what faces up (in patches).
	if (style < 2.5 || (style > 4.5 && style < 5.5) || style > 6.5) {
		col *= 1.0 - grime * (1.0 - smoothstep(0.0, 1.4, above)) * (0.6 + 0.4 * vnoise(f * 2.0));
		float patches = smoothstep(0.35, 0.8, vnoise(wpos.xz * 0.45) * 0.7 + vnoise(wpos.xz * 2.3) * 0.3);
		col = mix(col, dust_color, dust * up * (0.35 + 0.65 * patches));
	}
	if (height_dark > 0.0 && abs(style - 3.0) > 0.5) {
		col *= 1.0 - height_dark * smoothstep(1.5, height_dark_span, above);
	}
	ALBEDO = col;
	ROUGHNESS = 1.0;
	if (style > 2.5 && style < 3.5) {
		ROUGHNESS = 0.35;
	}
}

void light() {
	DIFFUSE_LIGHT += world_toon_diffuse(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION);
}
