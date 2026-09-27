shader_type spatial;
// The valley's ground (valley_terrain.gd), painted in the islands' toy palette (world_ground.gdshader): a grass
// checker with soft meadow patches on the flats, the islands' orange striped dirt wherever the ground gets steep (the
// river gorge, the pond, the hills' flanks) under a scalloped grass lip, grey banded rock and snow high on the valley's
// walls, sand along the water, a warm dirt path and a striped farm field from the vertex masks:
//   COLOR.r path (and the village plaza), COLOR.g farm field, COLOR.b meadow tint.
render_mode specular_disabled;

#include "res://shaders/world_lighting.gdshaderinc"

uniform vec3 grass_a : source_color = vec3(0.47, 0.84, 0.19);
uniform vec3 grass_b : source_color = vec3(0.39, 0.76, 0.15);
uniform vec3 grass_lip : source_color = vec3(0.33, 0.66, 0.13);
uniform vec3 grass_meadow : source_color = vec3(0.64, 0.86, 0.24);
uniform vec3 grass_deep : source_color = vec3(0.3, 0.64, 0.24);
uniform vec3 dirt_a : source_color = vec3(0.93, 0.62, 0.33);
uniform vec3 dirt_b : source_color = vec3(0.83, 0.5, 0.26);
uniform vec3 dirt_deep : source_color = vec3(0.52, 0.3, 0.2);
uniform vec3 path_a : source_color = vec3(0.93, 0.78, 0.52);
uniform vec3 path_b : source_color = vec3(0.86, 0.69, 0.44);
uniform vec3 rock_a : source_color = vec3(0.72, 0.68, 0.64);
uniform vec3 rock_b : source_color = vec3(0.6, 0.57, 0.56);
uniform vec3 snow : source_color = vec3(0.97, 0.98, 1.0);
uniform vec3 sand_a : source_color = vec3(0.98, 0.9, 0.62);
uniform vec3 sand_b : source_color = vec3(0.92, 0.82, 0.55);
uniform vec3 crop_a : source_color = vec3(0.95, 0.8, 0.3);
uniform vec3 crop_b : source_color = vec3(0.62, 0.42, 0.24);
uniform float tile = 1.5;
uniform float stripe = 0.45;
uniform float water_y = -2.5;

varying vec3 wpos;
varying vec3 wnrm;
varying vec4 masks;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize(mat3(MODEL_MATRIX) * NORMAL);
	masks = COLOR;
}

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
	float slope_y = n.y;

	// Grass: the islands' two-tone checker, faded out where it would alias, with meadow patches and deeper green
	// in the hollows.
	vec2 q = wpos.xz / tile;
	vec2 w = fwidth(q);
	float cx = square_wave(q.x, w.x * 1.2);
	float cz = square_wave(q.y, w.y * 1.2);
	float chk = cx + cz - 2.0 * cx * cz;
	float fade = 1.0 - smoothstep(0.15, 0.45, max(w.x, w.y));
	vec3 g = mix(grass_a, grass_b, mix(0.5, chk, fade));
	float patch = value_noise(wpos.xz * 0.11) * 0.6 + value_noise(wpos.xz * 0.37) * 0.4;
	g = mix(g, grass_meadow, smoothstep(0.5, 0.85, masks.b) * 0.45);
	g = mix(g, grass_deep, smoothstep(0.55, 0.2, patch) * 0.25);

	// Where the ground turns steep (cliffs, the gorge), the grass hangs over the edge as a scalloped lip onto striped
	// dirt. The scallops fade out with distance, where they would only speckle.
	float dist = length(VERTEX);
	float near = 1.0 - smoothstep(20.0, 45.0, dist);
	float wob = (0.05 * sin(wpos.x * 2.1 + wpos.z * 1.3) + 0.035 * sin(wpos.z * 2.9 - wpos.x * 1.6)) * near;
	float lip_aa = max(fwidth(slope_y) * 1.5, 0.01) + (1.0 - near) * 0.04;
	float grass = smoothstep(0.6 - lip_aa, 0.6 + lip_aa, slope_y + wob);
	g = mix(g, grass_lip, (1.0 - smoothstep(0.6, 0.74, slope_y + wob)) * 0.8);
	float s = wpos.y / stripe + 0.18 * sin(wpos.x * 1.1 + wpos.z * 0.8);
	float band = square_wave(s, fwidth(s) * 1.2);
	vec3 d = mix(dirt_a, dirt_b, band);
	d = mix(d, dirt_deep, smoothstep(0.8, -4.5, wpos.y) * 0.7);
	// High on the valley's walls the dirt turns to banded rock.
	vec3 r = mix(rock_a, rock_b, band);
	d = mix(d, r, smoothstep(9.0, 16.0, wpos.y));
	vec3 col = mix(d, g, grass);

	// Snow on the flatter tops of the high hills.
	float snow_line = 27.0 + 2.5 * sin(wpos.x * 0.21) + 2.0 * sin(wpos.z * 0.17);
	col = mix(col, snow, smoothstep(snow_line, snow_line + 1.5, wpos.y) * smoothstep(0.45, 0.65, slope_y));

	// Sand along the water (the beach, the river's edge, the pond), wet and darker under it.
	float sand_line = water_y + 1.9 + 0.35 * sin(wpos.x * 0.8 + wpos.z * 0.5);
	float sand = 1.0 - smoothstep(sand_line - 0.25, sand_line + 0.25, wpos.y);
	vec3 sd = mix(sand_a, sand_b, 0.5 + 0.5 * sin(wpos.x * 0.7 + wpos.z * 0.5));
	sd = mix(sd, sd * vec3(0.8, 0.82, 0.8), smoothstep(water_y + 0.1, water_y - 0.6, wpos.y));
	col = mix(col, sd, sand * smoothstep(0.35, 0.6, slope_y));

	// The farm field: crop rows along x, golden wheat and dark soil.
	float rows = square_wave(wpos.z / 0.9, fwidth(wpos.z / 0.9) * 1.2);
	vec3 crop = mix(crop_b, crop_a, rows);
	crop = mix(crop, crop * 1.08, value_noise(wpos.xz * 0.6));
	float field = smoothstep(0.45, 0.55, masks.g) * smoothstep(0.7, 0.85, slope_y);
	col = mix(col, crop, field);

	// The dirt path: a soft wobbly edge, a few darker pebbles; only on flattish ground.
	float edge_noise = value_noise(wpos.xz * 1.7) - 0.5;
	float path = smoothstep(0.4, 0.55, masks.r + edge_noise * 0.3) * smoothstep(0.75, 0.88, slope_y);
	vec3 pc = mix(path_a, path_b, value_noise(wpos.xz * 0.9));
	float pebble = step(0.86, value_noise(wpos.xz * 5.3));
	pc = mix(pc, path_b * 0.85, pebble * 0.6);
	col = mix(col, pc, path);

	ALBEDO = col;
	ROUGHNESS = 1.0;
}

void light() {
	DIFFUSE_LIGHT += world_toon_diffuse(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION);
}
