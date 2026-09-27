shader_type spatial;
// The castle's paintings (world_props.gd Painting, spec §5.3): the world behind the canvas, painted. The picture is
// the `portrait` texture (art/paintings/<id>.png, a --portrait shot of the world) or, while there is none, a scene
// painted right here (`style`: 0 Drift Isles, a bright sky over toy islands and the sea; 1 Gale Gorge, a warm canyon
// under a late sky; 2 wet paint, smeared colour). Either way it is made to look painted: the lookup wobbles along
// brush strokes, the colour is posterized to 6 levels (dithered by the strokes), the canvas weave shows through and a
// vignette darkens the edges.
// The canvas is a 48 x 36 grid (PlaneMesh facing +Z) so it can ripple like a pond: A sin(k r - w t) e^(-3t) e^(-2r)
// from `ripple_center` (uv) as `ripple_age` (s, driven by the Painting while it runs) grows, masked to the ring that
// has left the centre. `swirl` (0..1) twists the picture round its middle as he dives in.
// Unshaded (a painting must read in the moonlit castle), fog on.
render_mode unshaded, cull_back, shadows_disabled;

uniform sampler2D portrait : source_color, filter_linear_mipmap, repeat_disable;
uniform bool has_portrait = false;
uniform int style = 0;
uniform vec2 canvas_size = vec2(3.2, 2.4);
uniform vec2 ripple_center = vec2(0.5);
uniform float ripple_age = 100.0;
uniform float ripple_amp = 0.0;
uniform float swirl = 0.0;
uniform float brightness = 0.92;

const float RIPPLE_K = 7.0;   // rad/m
const float RIPPLE_W = 11.0;  // rad/s

varying vec2 uv;
varying float wave;

float ripple_at(vec2 p) {
	float r = length((p - ripple_center) * canvas_size);
	float t = ripple_age;
	float front = smoothstep(RIPPLE_W * t / RIPPLE_K + 0.25, RIPPLE_W * t / RIPPLE_K - 0.1, r);
	return ripple_amp * sin(RIPPLE_K * r - RIPPLE_W * t) * exp(-t * 3.0) * exp(-r * 2.0) * front;
}

void vertex() {
	uv = UV;
	wave = ripple_at(UV);
	VERTEX.z += wave;
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

// A round island seen from the side: a grassy cap on a dirt body tapering to a point. `c` its top middle.
vec4 island(vec2 p, vec2 c, float w, float h) {
	vec2 q = (p - c) / vec2(w, h);
	float top = 1.0 - smoothstep(0.0, 0.08, abs(q.x) - 1.0 + 0.0);
	float body = step(0.0, q.y) * step(q.y, 1.0 - q.x * q.x * 0.9) * step(abs(q.x), 1.0);
	float grass = body * (1.0 - step(0.22 + 0.05 * sin(q.x * 18.0), q.y));
	vec3 col = mix(vec3(0.86, 0.55, 0.3), vec3(0.42, 0.78, 0.25), grass);
	col = mix(col, col * 0.78, smoothstep(0.4, 1.0, q.y));
	return vec4(col, body * top);
}

vec3 drift_scene(vec2 p) {
	// p: (0, 0) top left, (1, 1) bottom right.
	vec3 sky = mix(vec3(0.33, 0.62, 1.0), vec3(0.78, 0.92, 1.0), smoothstep(0.0, 0.62, p.y));
	// Puffy clouds.
	float cl = smoothstep(0.55, 0.62, vnoise(vec2(p.x * 6.0, p.y * 10.0) + vec2(3.0, 1.0)) * (1.0 - smoothstep(0.1, 0.45, p.y)) + 0.35);
	sky = mix(sky, vec3(1.0), cl * 0.85);
	vec3 col = sky;
	// The sea from the horizon down, with sparkles.
	float sea_line = 0.66 + 0.004 * sin(p.x * 40.0);
	if (p.y > sea_line) {
		col = mix(vec3(0.2, 0.62, 0.86), vec3(0.08, 0.4, 0.72), smoothstep(sea_line, 1.0, p.y));
		col += vec3(0.25) * step(0.93, vnoise(vec2(p.x * 60.0, p.y * 20.0)));
	}
	// Islands: the castle isle in the middle, the others round it, one floating high up.
	vec4 isl[4] = vec4[4](island(p, vec2(0.5, 0.56), 0.2, 0.2), island(p, vec2(0.16, 0.6), 0.1, 0.12),
		island(p, vec2(0.84, 0.5), 0.12, 0.26), island(p, vec2(0.3, 0.26), 0.09, 0.14));
	for (int i = 0; i < 4; i++) {
		col = mix(col, isl[i].rgb, isl[i].a);
	}
	// A little castle on the middle isle: white walls, red roofs.
	vec2 k = (p - vec2(0.5, 0.49)) / vec2(0.07, 0.07);
	float keep = step(abs(k.x), 0.8) * step(abs(k.y), 1.0);
	float towers = step(abs(abs(k.x) - 1.0), 0.28) * step(-1.6, k.y) * step(k.y, 1.0);
	float roofs = step(abs(abs(k.x) - 1.0), 0.45 - (k.y + 1.6) * -0.5) * step(-2.5, k.y) * step(k.y, -1.6);
	col = mix(col, vec3(0.98, 0.95, 0.9), max(keep, towers));
	col = mix(col, vec3(0.9, 0.28, 0.25), roofs);
	col = mix(col, vec3(0.22, 0.14, 0.14), step(abs(k.x), 0.2) * step(0.35, k.y) * step(k.y, 1.0));
	// A gold star shining over the high isle.
	vec2 s = (p - vec2(0.3, 0.17)) * vec2(canvas_size.x / canvas_size.y, 1.0);
	float ang = atan(s.y, s.x);
	float star = 1.0 - smoothstep(0.018, 0.024, length(s) * (0.75 + 0.35 * cos(ang * 5.0 + 1.57)));
	col = mix(col, vec3(1.0, 0.86, 0.3), star);
	return col;
}

vec3 gorge_scene(vec2 p) {
	vec3 sky = mix(vec3(0.98, 0.62, 0.38), vec3(1.0, 0.86, 0.6), smoothstep(0.0, 0.5, p.y));
	vec3 col = sky;
	// Two canyon walls stepping down toward a river in the middle distance.
	float left = 0.18 + 0.12 * p.y + 0.03 * sin(p.y * 30.0);
	float right = 0.82 - 0.12 * p.y + 0.03 * sin(p.y * 27.0 + 1.0);
	float wall_top = 0.2 + 0.05 * sin(p.x * 11.0);
	if (p.x < left || p.x > right) {
		float band = step(0.5, fract(p.y * 9.0 + 0.3 * sin(p.x * 13.0)));
		col = mix(vec3(0.82, 0.48, 0.28), vec3(0.72, 0.4, 0.24), band);
		col = mix(col, vec3(0.55, 0.3, 0.2), smoothstep(0.3, 1.0, p.y));
	}
	if (p.y > 0.72) {
		col = mix(col, vec3(0.2, 0.55, 0.62), step(abs(p.x - 0.5), 0.1 + (p.y - 0.72) * 0.9));
	}
	// Teal wind banners on poles.
	for (int i = 0; i < 3; i++) {
		vec2 b = vec2(0.34 + 0.16 * float(i), 0.42 + 0.05 * float(i));
		float pole = step(abs(p.x - b.x), 0.004) * step(b.y, p.y) * step(p.y, b.y + 0.2);
		float flag = step(0.0, p.x - b.x) * step(p.x - b.x, 0.06) * step(abs(p.y - b.y - 0.02 - 0.01 * sin(p.x * 80.0)), 0.02);
		col = mix(col, vec3(0.3, 0.2, 0.15), pole);
		col = mix(col, vec3(0.1, 0.78, 0.8), flag);
	}
	return col * (1.0 - wall_top * 0.0);
}

vec3 wet_scene(vec2 p) {
	float n = vnoise(p * vec2(4.0, 9.0)) + 0.5 * vnoise(p * vec2(11.0, 23.0));
	vec3 a = vec3(0.95, 0.62, 0.4);
	vec3 b = vec3(0.3, 0.7, 0.75);
	return mix(a, b, smoothstep(0.5, 1.0, n + p.y * 0.4));
}

void fragment() {
	vec2 p = uv;
	// The swirl: rotate round the middle, more near it.
	vec2 aspect = vec2(canvas_size.x / canvas_size.y, 1.0);
	vec2 c = (p - 0.5) * aspect;
	float r = length(c);
	float a = swirl * 8.0 * (1.0 - clamp(r * 1.4, 0.0, 1.0));
	c = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a))) * c;
	p = c / aspect + 0.5;
	// The ripple bends the picture a little (the wave's slope), and brush strokes wobble the lookup.
	float e = 0.01;
	vec2 slope = vec2(ripple_at(p + vec2(e, 0.0)) - ripple_at(p - vec2(e, 0.0)), ripple_at(p + vec2(0.0, e)) - ripple_at(p - vec2(0.0, e)));
	p += slope * 0.35;
	vec2 stroke_uv = vec2(p.x * 38.0 + p.y * 9.0, p.y * 70.0);
	float stroke = vnoise(stroke_uv);
	p += (vec2(stroke, vnoise(stroke_uv.yx + 11.0)) - 0.5) * 0.007;
	vec3 col;
	if (has_portrait) {
		col = texture(portrait, clamp(p, vec2(0.0), vec2(1.0))).rgb;
	} else if (style == 1) {
		col = gorge_scene(p);
	} else if (style == 2) {
		col = wet_scene(p);
	} else {
		col = drift_scene(p);
	}
	// Posterize to 6 levels, dithered by the strokes so the bands break up like dabs of paint.
	col = floor(col * 5.0 + 0.35 + stroke * 0.5) / 5.0;
	// Canvas weave.
	vec2 wv = uv * canvas_size * 90.0;
	col *= 1.0 + 0.045 * sin(wv.x) * sin(wv.y) - 0.03 * vnoise(uv * canvas_size * 30.0);
	// Vignette, and a pale glow as it swirls.
	col *= mix(0.68, 1.0, smoothstep(0.78, 0.28, length((uv - 0.5) * vec2(1.0, 1.15))));
	col = mix(col, vec3(0.92, 0.95, 1.0), swirl * 0.35 * (1.0 - clamp(r * 1.6, 0.0, 1.0)));
	ALBEDO = clamp(col, 0.0, 1.0) * brightness;
}
