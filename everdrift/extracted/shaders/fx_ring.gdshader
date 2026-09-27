shader_type spatial;
// Expanding rings, shock discs, star-burst rays and the ground and wind marks of the moves. fx.gd draws them as a
// MultiMesh ring buffer:
//   instance transform   a regular transform: origin = centre, basis = plane orientation scaled by the final radius
//                        (the quad lies in its XY plane)
//   INSTANCE_CUSTOM      (spawn time, lifetime, style, thickness as a fraction of the radius)
//                        style: 0 ring, 1 ring with a soft inner fill, 2 burst rays, 3 tinted burst rays,
//                        4 dust ring (a noisy, broken, soft ring that does not glow), 5 spiral (rotating arms),
//                        6 crescent (a tapered arc whose window sweeps round), 7 implode (the ring shrinks onto the
//                        centre), 8 crack (jagged radial cracks + a thick shock ring), 9 torus wave (a soft tube
//                        profile with a bright outer lip, reads as a 3D shock);
//                        +100 = face the camera
//   COLOR                tint (rgb) and opacity (a)
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, skip_vertex_transform, shadows_disabled, fog_disabled;

uniform float now = 0.0;
uniform float hdr = 1.9;
uniform float soft_distance = 0.45; // camera-facing shapes fade out this close to the geometry behind them
uniform sampler2D depth_texture : hint_depth_texture, filter_nearest, repeat_disable;

varying vec2 quad;
varying float progress;
varying flat float style;
varying flat float thickness;
varying flat float seed;
varying flat float facing_camera;

void vertex() {
	float t = now - INSTANCE_CUSTOM.x;
	float k = t / max(INSTANCE_CUSTOM.y, 0.0001);
	float alive = step(0.0, k) * (1.0 - step(1.0, k));
	progress = clamp(k, 0.0, 1.0);
	float billboard = step(99.5, INSTANCE_CUSTOM.z);
	facing_camera = billboard;
	style = INSTANCE_CUSTOM.z - billboard * 100.0;
	thickness = INSTANCE_CUSTOM.w;
	quad = VERTEX.xy * 2.0;
	vec3 origin = MODEL_MATRIX[3].xyz;
	seed = fract(dot(origin, vec3(12.9898, 78.233, 37.719)));

	vec3 planar = (MODEL_MATRIX * vec4(quad, 0.0, 1.0)).xyz;
	float radius = length(MODEL_MATRIX[0].xyz);
	vec3 facing = origin + (INV_VIEW_MATRIX[0].xyz * quad.x + INV_VIEW_MATRIX[1].xyz * quad.y) * radius;
	vec3 world = mix(planar, facing, billboard);
	world = mix(origin, world, alive);
	VERTEX = (VIEW_MATRIX * vec4(world, 1.0)).xyz;
	NORMAL = vec3(0.0, 0.0, 1.0);
}

// Periodic in the angle (whole multiples only), so there is no seam where atan() wraps.
float wobble(float a, float s) {
	return 0.5 + 0.5 * (0.55 * sin(a * 5.0 + s * 6.283) + 0.3 * sin(a * 9.0 - s * 17.0) + 0.15 * sin(a * 17.0 + s * 3.0));
}

void fragment() {
	float d = length(quad);
	float a = atan(quad.y, quad.x);
	float k = progress;
	float ease = 1.0 - pow(1.0 - k, 3.0);
	float r = mix(0.12, 0.94, ease);
	float w = thickness * mix(1.0, 0.25, k);
	float aa = fwidth(d) * 1.5;
	float band = abs(d - r);
	float ring = 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, band);
	// White-hot centre line inside the coloured band.
	float core = 1.0 - smoothstep(w * 0.12 - aa, w * 0.12 + aa, band);
	vec3 col = mix(COLOR.rgb, vec3(1.0), core * 0.7);
	float alpha = ring;
	float fade = 1.0 - k * k;
	float glow = hdr;
	if (style > 0.5 && style < 1.5) {
		float fill = smoothstep(r * 0.2, r, d) * (1.0 - step(r, d)) * 0.35;
		alpha = max(alpha, fill);
	} else if (style > 1.5 && style < 3.5) {
		// Style 3: broader rays that keep their tint, white only near the root.
		float tinted = step(2.5, style);
		float sharp = mix(24.0, 12.0, tinted);
		float rays = pow(abs(cos(a * 4.0 + seed * 6.28)), sharp) + 0.6 * pow(abs(cos(a * 4.0 + 0.3927 + seed * 6.28)), sharp * 1.67);
		float reach = smoothstep(r, r * 0.55, d) * smoothstep(0.05, 0.25, d);
		alpha = clamp(rays * reach * 1.4, 0.0, 1.0);
		col = mix(COLOR.rgb, vec3(1.0), mix(0.6, 0.55 * (1.0 - smoothstep(0.08, 0.4, d)), tinted));
	} else if (style > 3.5 && style < 4.5) {
		// Dust ring: slows as it spreads, a lumpy radius, broken into clumps, grainy and soft-edged, never white.
		float rd = mix(0.15, 0.95, 1.0 - pow(1.0 - k, 2.2));
		float lump = wobble(a, seed);
		float rr = rd * (0.9 + 0.2 * lump);
		float wd = thickness * mix(1.3, 0.7, k) * (0.6 + 0.8 * wobble(a + 1.7, seed + 0.3));
		float body = 1.0 - smoothstep(0.0, wd * 0.5, abs(d - rr));
		// The inner side trails off (dust left behind the front).
		body = max(body, 0.45 * smoothstep(rr - wd * 1.6, rr, d) * step(d, rr));
		float clumps = smoothstep(0.28, 0.55, wobble(a * 2.0 + 0.4, seed + 0.61));
		float grain = 0.75 + 0.25 * sin(quad.x * 41.0 + seed * 9.0) * sin(quad.y * 37.0 - seed * 5.0);
		alpha = body * mix(0.25, 1.0, clumps) * grain;
		// A darker core along the band, so the ring reads on pale sand too.
		float band_core = 1.0 - smoothstep(0.0, wd * 0.35, abs(d - rr));
		col = COLOR.rgb * mix(0.92, 1.05, lump) * mix(1.0, 0.68, band_core);
		glow = 1.0; // dust is matte: no bloom
		fade = 1.0 - smoothstep(0.35, 1.0, k);
	} else if (style > 4.5 && style < 5.5) {
		// Spiral: 3 arms twisting out from the centre and turning, inside a disc that widens.
		float arms = sin(a * 3.0 + d * 9.0 - k * 9.0 + seed * 6.28);
		float arm = smoothstep(0.25, 0.85, arms);
		float disc = smoothstep(0.08, 0.3, d) * (1.0 - smoothstep(r - 0.12, r + aa, d));
		alpha = arm * disc * (0.6 + 0.4 * smoothstep(r * 0.4, r, d));
		col = mix(COLOR.rgb, vec3(1.0), arm * smoothstep(r * 0.6, r, d) * 0.6);
	} else if (style > 5.5 && style < 6.5) {
		// Crescent: a thick arc (130 degrees) whose middle sweeps from +X (fx.gd puts his facing there) over +Y (up) to
		// -X (behind him), tapered at both tips.
		float centre = mix(0.15, 1.0, ease) * 3.14159;
		float off = abs(atan(sin(a - centre), cos(a - centre)));
		float span = 1.13;
		float taper = 1.0 - smoothstep(span * 0.35, span, off);
		float rc = mix(0.7, 0.95, ease);
		float wc = thickness * taper;
		alpha = (1.0 - smoothstep(wc * 0.5 - aa, wc * 0.5 + aa, abs(d - rc))) * step(off, span);
		col = mix(COLOR.rgb, vec3(1.0), (1.0 - smoothstep(0.0, wc * 0.25 + aa, abs(d - rc))) * 0.6);
	} else if (style > 6.5 && style < 7.5) {
		// Implode: the ring starts wide and closes onto the centre, brightening as it goes.
		float ri = mix(0.95, 0.06, ease);
		float wi = thickness * mix(0.5, 1.2, k);
		float bi = abs(d - ri);
		alpha = 1.0 - smoothstep(wi * 0.5 - aa, wi * 0.5 + aa, bi);
		col = mix(COLOR.rgb, vec3(1.0), (1.0 - smoothstep(0.0, wi * 0.2 + aa, bi)) * 0.8);
		fade = smoothstep(0.0, 0.25, k) * (1.0 - smoothstep(0.8, 1.0, k));
	} else if (style > 7.5 && style < 8.5) {
		// Crack: 7 jagged radial cracks that shoot out fast, and a thick shock ring behind them.
		float reach = mix(0.2, 1.0, 1.0 - pow(1.0 - clamp(k / 0.35, 0.0, 1.0), 3.0));
		float ca = a * 7.0 / 6.28318 + seed * 11.0;
		float jag = 0.07 * sin(d * 23.0 + floor(ca) * 5.3) + 0.04 * sin(d * 51.0 - floor(ca) * 2.1);
		float line = abs(fract(ca + jag) - 0.5);
		float width = 0.05 * (1.0 - d * 0.7) + fwidth(ca) * 1.2;
		float crack = (1.0 - smoothstep(width * 0.4, width, line)) * (1.0 - smoothstep(reach - 0.1, reach, d)) * smoothstep(0.06, 0.14, d);
		float rs = mix(0.1, 0.8, ease);
		float ws = thickness * mix(1.4, 0.4, k);
		float shock = 1.0 - smoothstep(ws * 0.5 - aa, ws * 0.5 + aa, abs(d - rs));
		alpha = max(crack * (1.0 - smoothstep(0.55, 1.0, k)), shock * 0.9);
		col = mix(COLOR.rgb, vec3(1.0), max(crack * 0.5, (1.0 - smoothstep(0.0, ws * 0.15 + aa, abs(d - rs))) * 0.7));
	} else if (style > 8.5) {
		// Torus wave: a tube cross-section (soft inside, a bright lip outside) that expands and thins.
		float rt = mix(0.1, 0.92, ease);
		float wt = thickness * mix(1.2, 0.5, k);
		float x = (d - rt) / max(wt, 0.001);
		float tube = exp(-x * x * 3.0);
		float lip = exp(-(x - 0.35) * (x - 0.35) * 30.0);
		alpha = clamp(tube * 0.65 + lip, 0.0, 1.0);
		col = mix(COLOR.rgb * 0.8, vec3(1.0), clamp(lip * 0.8, 0.0, 1.0));
	}
	if (facing_camera > 0.5) {
		// Soft intersection: no hard cut where a camera-facing burst pierces the ground.
		float depth = textureLod(depth_texture, SCREEN_UV, 0.0).r;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
		depth = depth * 2.0 - 1.0; // OpenGL NDC depth is -1..1 (the web build)
#endif
		vec4 scene = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, depth, 1.0);
		float scene_distance = -scene.z / scene.w;
		fade *= clamp((scene_distance + VERTEX.z) / soft_distance, 0.0, 1.0);
	}
	ALBEDO = col * glow;
	ALPHA = clamp(alpha * fade * COLOR.a, 0.0, 1.0);
}
