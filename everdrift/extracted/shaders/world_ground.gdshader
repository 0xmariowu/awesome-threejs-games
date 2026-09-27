shader_type spatial;
// Grass-topped islands and background hills, all in one merged mesh.
// Grass tops carry a subtle two-tone world-space checker; the grass wraps over the edge as a scalloped lip;
// dirt sides get horizontal stripes that darken with depth. Per-piece data comes in through UV2:
//   UV2.x = world height of the piece's top surface, UV2.y = style (0 island, 1 hill, 2 rock, 3 sand, 4 far mountain,
//   5 sandstone: Gale Gorge's canyon, warm strata under a grass lip).
render_mode specular_disabled;

#include "res://shaders/world_lighting.gdshaderinc"

uniform vec3 grass_a : source_color = vec3(0.47, 0.84, 0.19);
uniform vec3 grass_b : source_color = vec3(0.39, 0.76, 0.15);
uniform vec3 grass_lip : source_color = vec3(0.33, 0.66, 0.13);
uniform vec3 grass_tint : source_color = vec3(0.62, 0.86, 0.22);
uniform vec3 dirt_a : source_color = vec3(0.93, 0.62, 0.33);
uniform vec3 dirt_b : source_color = vec3(0.83, 0.5, 0.26);
uniform vec3 dirt_deep : source_color = vec3(0.52, 0.3, 0.2);
uniform vec3 rock_a : source_color = vec3(0.72, 0.68, 0.64);
uniform vec3 sand_a : source_color = vec3(0.98, 0.9, 0.62);
uniform vec3 sand_b : source_color = vec3(0.92, 0.82, 0.55);
uniform vec3 hill_top : source_color = vec3(0.58, 0.86, 0.46);
uniform vec3 hill_base : source_color = vec3(0.36, 0.68, 0.46);
uniform vec3 sandstone_a : source_color = vec3(0.96, 0.75, 0.53);
uniform vec3 sandstone_b : source_color = vec3(0.88, 0.6, 0.42);
uniform vec3 sandstone_deep : source_color = vec3(0.68, 0.41, 0.31);
uniform float tile = 1.5;
uniform float lip = 0.34;
uniform float stripe = 0.45;

varying vec3 wpos;
varying vec3 wnrm;
varying vec2 info;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize(mat3(MODEL_MATRIX) * NORMAL);
	info = UV2;
}

// Anti-aliased square wave: 1 near integers, 0 near half-integers.
float square_wave(float x, float w) {
	float t = abs(fract(x) - 0.5) * 2.0;
	return smoothstep(0.5 - w, 0.5 + w, t);
}

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float value_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash21(i);
	float b = hash21(i + vec2(1.0, 0.0));
	float c = hash21(i + vec2(0.0, 1.0));
	float d = hash21(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void fragment() {
	vec3 n = normalize(wnrm);
	float top = info.x;
	float style = info.y;
	float below = top - wpos.y;

	// Grass: top faces, plus a scalloped lip hanging over the sides.
	float wob = 0.07 * sin(wpos.x * 3.1 + wpos.z * 1.7) + 0.05 * sin(wpos.z * 4.3 - wpos.x * 2.3);
	float lip_line = lip + wob;
	float lip_aa = max(fwidth(below), 0.004);
	float side_grass = 1.0 - smoothstep(lip_line - lip_aa, lip_line + lip_aa, below);
	float top_grass = smoothstep(0.45, 0.62, n.y);
	float grass = max(top_grass, side_grass);

	// Two-tone checker on the tops, faded out where it would alias.
	vec2 q = wpos.xz / tile;
	vec2 w = fwidth(q);
	float cx = square_wave(q.x, w.x * 1.2);
	float cz = square_wave(q.y, w.y * 1.2);
	float chk = cx + cz - 2.0 * cx * cz;
	float fade = 1.0 - smoothstep(0.15, 0.45, max(w.x, w.y));
	float patch = value_noise(wpos.xz * 0.23);
	vec3 g = mix(grass_a, grass_b, mix(0.5, chk, fade));
	g = mix(g, grass_tint, smoothstep(0.55, 0.85, patch) * 0.35);
	g = mix(g, grass_lip, (1.0 - top_grass) * 0.85);

	// Dirt: wavy horizontal stripes, darker further down, a soft shadow under the grass lip.
	float s = below / stripe + 0.18 * sin(wpos.x * 1.1 + wpos.z * 0.8);
	float band = square_wave(s, fwidth(s) * 1.2);
	vec3 d = mix(dirt_a, dirt_b, band);
	d = mix(d, dirt_deep, smoothstep(0.8, 5.5, below) * 0.75);
	float under = 1.0 - smoothstep(0.0, 0.28, below - lip_line);
	d *= 1.0 - 0.28 * under * (1.0 - grass);
	vec3 col = mix(d, g, grass);

	if (style > 4.5) {
		// Sandstone (the gorge): the dirt's wavy bands mixed with broad strata, reddening toward the river far below
		// the rim, under the same grass lip.
		float strata = 0.5 + 0.5 * sin(wpos.y * 1.7 + 0.8 * sin(wpos.x * 0.19 + wpos.z * 0.13));
		vec3 ss = mix(sandstone_a, sandstone_b, band * 0.55 + strata * 0.45);
		ss = mix(ss, sandstone_deep, smoothstep(6.0, 26.0, below) * 0.6);
		col = mix(ss, g, grass);
	} else if (style > 3.5) {
		// Far mountains: hill greens pushed toward a cool haze.
		float hgt = clamp((wpos.y - (top - 60.0)) / 60.0, 0.0, 1.0);
		col = mix(hill_base, hill_top, hgt);
		col = mix(col, vec3(0.62, 0.78, 0.86), 0.45);
	} else if (style > 2.5) {
		// Sand under shallow water.
		col = mix(sand_a, sand_b, 0.5 + 0.5 * sin(wpos.x * 0.7 + wpos.z * 0.5));
	} else if (style > 1.5) {
		// Rock (boulders): banded stone.
		vec3 r = mix(rock_a, rock_a * 0.82, band);
		col = mix(r, g, grass);
	} else if (style > 0.5) {
		// Hill: grass all over, lighter at the crown, darker toward the water, soft diagonal streaks.
		float hgt = clamp((wpos.y - (top - 20.0)) / 20.0, 0.0, 1.0);
		float streak = 0.5 + 0.5 * sin(wpos.x * 0.35 + wpos.z * 0.2 + wpos.y * 0.3);
		col = mix(hill_base, hill_top, smoothstep(0.0, 1.0, hgt));
		col *= 0.93 + 0.07 * streak;
		// Backdrop only (never walkable): pushed toward the sky haze so it recedes behind the islands.
		col = mix(col, vec3(0.62, 0.80, 0.88), 0.3);
	}
	ALBEDO = col;
	ROUGHNESS = 1.0;
}

void light() {
	DIFFUSE_LIGHT += world_toon_diffuse(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION);
}
