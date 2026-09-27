shader_type spatial;
// Cartoon dust puff: a lumpy toon ball that pops out, drifts and shrinks away (opaque, no sorting issues).
// Drawn by fx.gd as a MultiMesh ring buffer; each instance is animated entirely here from its spawn data,
// so the CPU writes an instance once and never touches it again.
//   instance origin      spawn position (world; the MultiMeshInstance3D sits at the world origin)
//   instance basis.x     initial velocity (m/s)
//   instance basis.y     (drag 1/s, rise m/s^2, radius m)
//   instance basis.z     (squash y, unused, unused)
//   INSTANCE_CUSTOM      (spawn time, lifetime, seed 0..1, unused)
//   COLOR                lit tint
// Lit with the scene's own lights (toon diffuse), so puffs match the monk's white cloth under any exposure.
render_mode cull_back, skip_vertex_transform, shadows_disabled, diffuse_toon, specular_disabled;

uniform float now = 0.0;
uniform float lift = 0.05; // emission share of the tint: keeps the shaded side soft and light

varying vec3 world_normal;

void vertex() {
	vec3 origin = MODEL_MATRIX[3].xyz;
	vec3 velocity = MODEL_MATRIX[0].xyz;
	vec3 params = MODEL_MATRIX[1].xyz;
	float squash = MODEL_MATRIX[2].x;
	float t = now - INSTANCE_CUSTOM.x;
	float k = t / max(INSTANCE_CUSTOM.y, 0.0001);
	float alive = step(0.0, k) * (1.0 - step(1.0, k));
	float seed = INSTANCE_CUSTOM.z;
	t = max(t, 0.0);

	float drag = max(params.x, 0.001);
	vec3 offset = velocity * (1.0 - exp(-drag * t)) / drag + vec3(0.0, 0.5 * params.y * t * t, 0.0);

	// Pop in fast with a little overshoot, hold, then shrink away.
	float grow = 1.0 - pow(1.0 - clamp(k / 0.16, 0.0, 1.0), 3.0);
	float overshoot = 1.0 + 0.22 * sin(clamp(k / 0.34, 0.0, 1.0) * PI);
	float shrink = 1.0 - smoothstep(0.3, 1.0, k);
	float radius = params.z * grow * overshoot * shrink * alive;

	// Lumpy cloud silhouette, different per puff, slowly churning.
	vec3 n = normalize(VERTEX);
	float lump = sin(dot(n, vec3(5.3, 3.1, 4.7)) + seed * 37.0 + t * 3.0) * 0.5
		+ sin(dot(n, vec3(-3.7, 6.1, 2.3)) + seed * 91.0 - t * 2.0) * 0.5;
	vec3 local = n * (1.0 + 0.13 * lump) * radius;
	local.y *= squash;

	vec3 world = origin + offset + local;
	world_normal = n;
	VERTEX = (VIEW_MATRIX * vec4(world, 1.0)).xyz;
	NORMAL = normalize(mat3(VIEW_MATRIX) * n);
}

void fragment() {
	vec3 n = normalize(world_normal);
	// Soft underside, so a puff reads as a ball even when the sun is behind the camera.
	vec3 base = COLOR.rgb * mix(0.86, 1.0, smoothstep(-0.7, 0.35, n.y));
	ALBEDO = base;
	EMISSION = base * lift;
	RIM = 0.25;
	RIM_TINT = 0.6;
	ROUGHNESS = 1.0;
}
