shader_type spatial;
// Wind shapes on an open tube (fx.gd wind batch: a 24x8 tube mesh, u round, v up, radius 1, height 1): the double-jump
// helix, the gust-jump geyser, the spin gust's tornado band and the dive's cone. Drawn by fx.gd as a MultiMesh ring
// buffer and animated entirely here from spawn data, like the other fx batches:
//   instance transform   origin = the base centre; basis = orientation (local Y along the axis) scaled by
//                        (radius, height, radius)
//   INSTANCE_CUSTOM      (spawn time, lifetime, twist (radians of strand turn from the bottom to the top), style)
//                        style: 0 helix (3 strands climbing round him), 1 geyser (a flaring column that erupts up),
//                        2 tornado band (a low, wide band whirling round him), 3 cone (opens along its axis)
//   COLOR                tint (rgb) and opacity (a)
// Strands are alpha from sin(u * TAU * strands + v * twist - t * spin), streaked by scrolling value noise. Unshaded,
// no fog, no depth writes; both faces drawn, so the far side of the tube shows through the gaps.
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, skip_vertex_transform, shadows_disabled, fog_disabled;

uniform float now = 0.0;
uniform float hdr = 1.7;

varying vec2 tube;
varying float progress;
varying float age;
varying flat float style;
varying flat float twist;
varying flat float seed;

void vertex() {
	float t = now - INSTANCE_CUSTOM.x;
	float k = t / max(INSTANCE_CUSTOM.y, 0.0001);
	float alive = step(0.0, k) * (1.0 - step(1.0, k));
	progress = clamp(k, 0.0, 1.0);
	age = max(t, 0.0);
	twist = INSTANCE_CUSTOM.z;
	style = INSTANCE_CUSTOM.w;
	vec3 origin = MODEL_MATRIX[3].xyz;
	seed = fract(dot(origin, vec3(12.9898, 78.233, 37.719)));
	float u = UV.x;
	float v = UV.y;
	tube = vec2(u, v);
	float ease = 1.0 - pow(1.0 - progress, 3.0);
	float radius = 1.0;
	float height = v;
	if (style < 0.5) {
		// Helix: widens a little as it climbs, narrower at the top.
		radius = mix(0.75, 1.0, ease) * mix(1.0, 0.7, v);
	} else if (style < 1.5) {
		// Geyser: shoots up in the first third of its life, flaring out at the top.
		float shoot = 1.0 - pow(1.0 - clamp(progress / 0.3, 0.0, 1.0), 3.0);
		height = v * shoot;
		radius = mix(0.35, 1.0, v * v) * mix(0.7, 1.0, ease);
	} else if (style < 2.5) {
		// Tornado band: bulges at mid-height, flung out as it spins.
		radius = mix(0.55, 1.0, ease) * (1.0 + 0.12 * sin(v * 3.14159));
	} else {
		// Cone: a point at the base opening along the axis, stretching out as it goes.
		radius = mix(0.08, 1.0, v) * mix(0.5, 1.0, ease);
		height = v * mix(0.4, 1.0, ease);
	}
	float a = u * 6.28318;
	vec3 local = vec3(cos(a) * radius, height, sin(a) * radius);
	vec3 world = (MODEL_MATRIX * vec4(local, 1.0)).xyz;
	world = mix(origin, world, alive);
	VERTEX = (VIEW_MATRIX * vec4(world, 1.0)).xyz;
	NORMAL = vec3(0.0, 0.0, 1.0);
}

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Value noise that wraps every `period` cells along x (the tube's u), so the strands have no seam.
float noise(vec2 p, float period) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash(vec2(mod(i.x, period), i.y));
	float b = hash(vec2(mod(i.x + 1.0, period), i.y));
	float c = hash(vec2(mod(i.x, period), i.y + 1.0));
	float d = hash(vec2(mod(i.x + 1.0, period), i.y + 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void fragment() {
	float u = tube.x;
	float v = tube.y;
	float k = progress;
	float strands = 3.0;
	float spin = 9.0;
	float sharp_lo = 0.35;
	float scroll = 2.5;
	float window = 1.0;
	float fade = 1.0 - smoothstep(0.6, 1.0, k);
	if (style < 0.5) {
		// Helix: a band of the tube that climbs as it lives: the strands seem to spiral up round him.
		float head = mix(0.35, 1.25, 1.0 - pow(1.0 - k, 2.0));
		float tail = head - 0.7;
		window = smoothstep(tail, tail + 0.25, v) * (1.0 - smoothstep(head - 0.2, head, v));
		spin = 11.0;
	} else if (style < 1.5) {
		// Geyser: many tight strands, fast; bright at the base while it erupts, then it thins out from the bottom.
		strands = 5.0;
		spin = 16.0;
		scroll = 6.0;
		sharp_lo = 0.1;
		window = smoothstep(k * 0.8 - 0.05, k * 0.8 + 0.2, v) * (1.0 - smoothstep(0.85, 1.0, v));
	} else if (style < 2.5) {
		// Tornado band: many strands whirling fast, faded at the top and bottom edges.
		strands = 6.0;
		spin = 20.0;
		scroll = 1.0;
		window = smoothstep(0.0, 0.3, v) * (1.0 - smoothstep(0.7, 1.0, v));
	} else {
		// Cone: 4 strands streaming back from the point to the open rim.
		strands = 4.0;
		spin = 7.0;
		scroll = 5.0;
		window = smoothstep(0.02, 0.2, v) * (1.0 - smoothstep(0.75, 1.0, v));
	}
	float s = sin(u * 6.28318 * strands + v * twist - age * spin + seed * 6.28318);
	float strand = smoothstep(sharp_lo, 0.95, s);
	float streak = noise(vec2(u * strands * 4.0, v * 3.0 - age * scroll + seed * 7.0), strands * 4.0);
	float alpha = strand * mix(0.45, 1.0, streak) * window * fade;
	vec3 col = mix(COLOR.rgb, vec3(1.0), smoothstep(0.75, 1.0, s) * 0.55);
	ALBEDO = col * hdr;
	ALPHA = clamp(alpha * COLOR.a, 0.0, 1.0);
}
