shader_type spatial;
// Camera-facing sparkles: 4-point twinkles, rounded 5-point stars, soft glow dots and streaks (a quad stretched
// along the spark's current screen-space velocity, head bright, tail fading: shards, grind sparks, gusts).
// Drawn by fx.gd as a MultiMesh ring buffer and animated entirely here from spawn data:
//   instance origin      spawn position (world)
//   instance basis.x     initial velocity (m/s)
//   instance basis.y     (gravity m/s^2, drag 1/s, spin rad/s)
//   instance basis.z     (size m, twinkle 0..1, streak stretch: extra length in sizes per m/s of speed)
//   INSTANCE_CUSTOM      (spawn time, lifetime, shape: 0 twinkle / 1 star / 2 glow / 3 streak, seed 0..1)
//   COLOR                tint (rgb) and opacity (a)
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, skip_vertex_transform, shadows_disabled, fog_disabled;

uniform float now = 0.0;
uniform float hdr = 1.6; // > 1 so the cores bloom with the scene's glow
// Sparks fade out between these view depths (m) as the camera nears them: long-lived sparkles left where
// the monk was are never blown up over the screen when the following camera passes through the spot.
uniform vec2 near_fade = vec2(1.0, 2.4);

varying vec2 quad;
varying float fade;
varying flat float shape;

// Rounded 5-point star distance (after Inigo Quilez).
float star5(vec2 p, float r, float rf) {
	const vec2 k1 = vec2(0.809016994375, -0.587785252292);
	const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
	p.x = abs(p.x);
	p -= 2.0 * max(dot(k1, p), 0.0) * k1;
	p -= 2.0 * max(dot(k2, p), 0.0) * k2;
	p.x = abs(p.x);
	p.y -= r;
	vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
	float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
	return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

void vertex() {
	vec3 origin = MODEL_MATRIX[3].xyz;
	vec3 velocity = MODEL_MATRIX[0].xyz;
	vec3 motion = MODEL_MATRIX[1].xyz;
	vec3 look = MODEL_MATRIX[2].xyz;
	float t = now - INSTANCE_CUSTOM.x;
	float k = t / max(INSTANCE_CUSTOM.y, 0.0001);
	float alive = step(0.0, k) * (1.0 - step(1.0, k));
	float seed = INSTANCE_CUSTOM.w;
	shape = INSTANCE_CUSTOM.z;
	t = max(t, 0.0);

	float drag = max(motion.y, 0.001);
	vec3 offset = velocity * (1.0 - exp(-drag * t)) / drag + vec3(0.0, -0.5 * motion.x * t * t, 0.0);

	float grow = 1.0 - pow(1.0 - clamp(k / 0.14, 0.0, 1.0), 3.0);
	float overshoot = 1.0 + 0.3 * sin(clamp(k / 0.3, 0.0, 1.0) * PI);
	float shrink = 1.0 - smoothstep(0.5, 1.0, k);
	float twinkle = 1.0 + look.y * 0.35 * sin(t * 34.0 + seed * 40.0);
	float size = look.x * grow * overshoot * shrink * twinkle * alive;

	float angle = seed * TAU + motion.z * t;
	vec2 corner = mat2(vec2(cos(angle), sin(angle)), vec2(-sin(angle), cos(angle))) * VERTEX.xy;
	if (shape > 2.5) {
		// Streak: the long axis follows the current velocity as seen on screen, and grows with the speed.
		vec3 v_now = velocity * exp(-drag * t) + vec3(0.0, -motion.x * t, 0.0);
		vec2 v_view = (mat3(VIEW_MATRIX) * v_now).xy;
		float speed = length(v_view);
		vec2 axis = speed > 0.001 ? v_view / speed : vec2(0.0, 1.0);
		vec2 across = vec2(-axis.y, axis.x);
		float stretch = 1.0 + look.z * length(v_now);
		corner = across * VERTEX.x * 0.6 + axis * (VERTEX.y - 0.25) * stretch * 2.2;
	}
	quad = VERTEX.xy * 2.0;
	fade = 1.0 - smoothstep(0.75, 1.0, k);
	fade *= smoothstep(near_fade.x, near_fade.y, -(VIEW_MATRIX * vec4(origin + offset, 1.0)).z);

	vec3 world = origin + offset + (INV_VIEW_MATRIX[0].xyz * corner.x + INV_VIEW_MATRIX[1].xyz * corner.y) * size;
	VERTEX = (VIEW_MATRIX * vec4(world, 1.0)).xyz;
	NORMAL = vec3(0.0, 0.0, 1.0);
}

void fragment() {
	vec3 col = COLOR.rgb;
	float alpha;
	float r2 = dot(quad, quad);
	if (shape < 0.5) {
		// Twinkle: concave four-point star with a white-hot core.
		vec2 p = abs(quad);
		float d = pow(p.x, 0.5) + pow(p.y, 0.5);
		float aa = fwidth(d) * 1.2;
		alpha = 1.0 - smoothstep(1.0 - aa, 1.0, d);
		float core = exp(-r2 * 22.0);
		col = mix(col, vec3(1.0), clamp(core * 1.4, 0.0, 1.0));
		alpha = max(alpha, core);
		alpha = max(alpha, exp(-r2 * 7.0) * 0.35); // faint halo
	} else if (shape < 1.5) {
		// Rounded star with a darker toon rim and a highlight.
		float d = star5(vec2(quad.x, -quad.y) * 1.08, 0.62, 0.48) - 0.16;
		float aa = fwidth(d) * 1.2;
		alpha = 1.0 - smoothstep(-aa, aa, d);
		float fill = 1.0 - smoothstep(-aa, aa, d + 0.11);
		col = mix(pow(col, vec3(2.2)) * 0.85, col, fill); // deeper shade of the tint as a toon rim
		float shine = 1.0 - smoothstep(0.0, 0.2, length(quad - vec2(-0.16, 0.2)));
		col = mix(col, vec3(1.0), shine * 0.8 * fill);
	} else if (shape < 2.5) {
		// Soft glow dot.
		alpha = exp(-r2 * 5.0);
		col = mix(col, vec3(1.0), exp(-r2 * 30.0));
	} else {
		// Streak: a soft capsule, bright at the head (+y), fading down the tail, with a white-hot spine.
		float across = abs(quad.x);
		float along = quad.y * 0.5 + 0.5;
		alpha = (1.0 - smoothstep(0.35, 1.0, across)) * smoothstep(0.0, 0.45, along) * (1.0 - smoothstep(0.88, 1.0, along));
		alpha *= mix(0.35, 1.0, along);
		col = mix(col, vec3(1.0), (1.0 - smoothstep(0.0, 0.35, across)) * along * 0.8);
	}
	ALBEDO = col * hdr;
	ALPHA = clamp(alpha, 0.0, 1.0) * fade * COLOR.a;
}
