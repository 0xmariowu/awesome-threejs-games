shader_type spatial;
// Stylised toon sea: turquoise shallows to deep blue by true water depth (from the depth buffer),
// white foam hugging every shore, drifting wave-crest lines, gentle vertex swell.
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_lambert;

#include "res://shaders/world_lighting.gdshaderinc"

uniform vec3 shallow : source_color = vec3(0.16, 0.86, 0.84);
uniform vec3 mid : source_color = vec3(0.07, 0.62, 0.86);
uniform vec3 deep : source_color = vec3(0.08, 0.38, 0.82);
uniform vec3 far_color : source_color = vec3(0.55, 0.82, 0.98);
uniform vec3 foam_color : source_color = vec3(1.0, 1.0, 1.0);
uniform float foam_width = 0.55;
uniform float swell = 0.07;
uniform sampler2D depth_tex : hint_depth_texture, repeat_disable, filter_nearest;

varying vec3 wpos;

float wave_height(vec2 p, float t) {
	return sin(p.x * 0.42 + t * 1.1) * 0.6 + sin(p.y * 0.55 - t * 0.9) * 0.4 + sin((p.x + p.y) * 0.9 + t * 1.7) * 0.25;
}

vec2 hash22(vec2 p) {
	p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
	return fract(sin(p) * 43758.5453);
}

// Distance to the nearest Voronoi edge: animated cells make the wave-crest lines.
float voronoi_edge(vec2 p, float t) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	float d1 = 8.0;
	float d2 = 8.0;
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 g = vec2(float(x), float(y));
			vec2 o = hash22(i + g);
			o = 0.5 + 0.4 * sin(t + 6.2831 * o);
			float d = length(g + o - f);
			if (d < d1) {
				d2 = d1;
				d1 = d;
			} else if (d < d2) {
				d2 = d;
			}
		}
	}
	return d2 - d1;
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
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float h = wave_height(wpos.xz, TIME);
	VERTEX.y += h * swell;
	float e = 0.5;
	float hx = wave_height(wpos.xz + vec2(e, 0.0), TIME);
	float hz = wave_height(wpos.xz + vec2(0.0, e), TIME);
	NORMAL = normalize(vec3(-(hx - h) * swell / e * 2.0, 1.0, -(hz - h) * swell / e * 2.0));
}

void fragment() {
	// Water depth below this point, straight down: reconstruct the scene point behind the surface.
	float raw = texture(depth_tex, SCREEN_UV).r;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
	raw = raw * 2.0 - 1.0; // OpenGL NDC depth is -1..1 (the web build)
#endif
	vec4 view = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, raw, 1.0);
	view.xyz /= view.w;
	vec3 behind = (INV_VIEW_MATRIX * vec4(view.xyz, 1.0)).xyz;
	float along_ray = length(view.xyz) - length(VERTEX);
	float depth = max(min(wpos.y - behind.y, along_ray), 0.0);

	vec3 col = mix(shallow, mid, smoothstep(0.5, 2.4, depth));
	col = mix(col, deep, smoothstep(2.3, 4.0, depth));

	// Caustic ripples over the shallows (a warped, animated cell pattern), fading with depth and distance.
	float dist = length(VERTEX);
	vec2 cp = wpos.xz * 0.42;
	cp += 0.3 * vec2(sin(cp.y * 1.7 + TIME * 0.9), cos(cp.x * 1.5 - TIME * 0.8));
	float ce = voronoi_edge(cp, TIME * 0.7);
	float caustic = 1.0 - smoothstep(0.0, fwidth(ce) + 0.07, ce);
	caustic *= (1.0 - smoothstep(0.6, 2.6, depth)) * (1.0 - smoothstep(18.0, 45.0, dist)) * 0.22;
	// Sun glitter on open water: one short dash per cell that swells and fades, each on its own clock.
	vec2 gs = wpos.xz / vec2(2.6, 1.8);
	vec2 gcell = floor(gs);
	vec2 gf = gs - gcell;
	vec2 rnd = hash22(gcell + vec2(17.0, 3.0));
	float life = fract(TIME * 0.3 + rnd.x);
	float size = sin(life * PI) * 0.1 * step(0.55, rnd.y);
	vec2 d = (gf - (0.25 + 0.5 * rnd.yx)) * vec2(1.0, 3.2);
	float dl = length(d);
	float glint = 1.0 - smoothstep(size * 0.55, size + fwidth(dl), dl);
	glint *= smoothstep(1.0, 2.2, depth) * (1.0 - smoothstep(16.0, 38.0, dist)) * 0.85;
	float crest = max(caustic, glint);

	// Shore foam: a solid wobbly band plus a second thin ring pulsing outwards.
	float wob = 0.12 * sin(wpos.x * 2.3 + TIME * 1.3) + 0.1 * sin(wpos.z * 2.9 - TIME * 1.1);
	float fw = foam_width + wob;
	float fa = max(fwidth(depth), 0.01);
	float foam = 1.0 - smoothstep(fw - fa, fw + fa, depth);
	float ring_pos = fract(TIME * 0.35) * 1.1 + foam_width + 0.15;
	float ring = (1.0 - smoothstep(0.0, 0.05 + fa, abs(depth - ring_pos))) * (1.0 - fract(TIME * 0.35));
	foam = max(foam, ring * 0.8);

	// Towards the horizon the sea takes the sky's colour.
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 4.0);
	col = mix(col, far_color, clamp(fres * 0.6 + smoothstep(50.0, 160.0, dist) * 0.45, 0.0, 1.0));
	col = mix(col, vec3(0.85, 1.0, 1.0), crest);
	col = mix(col, foam_color, foam);

	ALBEDO = col;
	ALPHA = mix(0.8, 0.97, smoothstep(0.0, 2.0, depth));
	ALPHA = max(ALPHA, foam);
	ROUGHNESS = 0.2;
	EMISSION = col * 0.08 + foam_color * foam * 0.15;
}

void light() {
	if (LIGHT_IS_DIRECTIONAL) {
		// The sun: softer shadows on the water than on land.
		float shade = mix(0.55, 1.0, ATTENUATION);
		DIFFUSE_LIGHT += LIGHT_COLOR * shade * (0.75 + 0.25 * clamp(dot(NORMAL, LIGHT), 0.0, 1.0)) / PI;
	} else {
		// Local lights (the Spirit Stars' glow): ATTENUATION carries their falloff, so it must scale everything,
		// or the whole light cluster tile would brighten.
		DIFFUSE_LIGHT += LIGHT_COLOR * ATTENUATION * clamp(dot(NORMAL, LIGHT), 0.0, 1.0) / PI;
	}
	SPECULAR_LIGHT += world_toon_specular(NORMAL, LIGHT, VIEW, LIGHT_COLOR, ATTENUATION, 0.985, 0.8);
}
