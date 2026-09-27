shader_type spatial;
// An updraft column (valley_props.gd Updraft): wind streaks spiralling up an open cylinder (LevelMesh.beam_mesh: UV.x
// round it, UV.y from the foot 0 to the top 1), broken into dashes that race upward, brightest on the column's
// silhouette, fading in at the foot and out at the top. mode 1 is the soft inner core: a pale glow, no streaks.
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled;

uniform vec3 tint : source_color = vec3(0.86, 0.97, 1.0);
uniform vec3 core_tint : source_color = vec3(0.7, 0.93, 1.0);
// Per-instance on Forward+; plain uniforms on Compatibility (the web build: RenderCompat gives each column its own
// material copy, see render_compat.gd).
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
uniform float height_m = 16.0;
uniform float spin = 1.0;
uniform float mode = 0.0;
uniform float strength = 1.0;
#else
instance uniform float height_m = 16.0;
instance uniform float spin = 1.0;
instance uniform float mode = 0.0;
instance uniform float strength = 1.0;
#endif

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void fragment() {
	float y = UV.y * height_m;
	float ends = smoothstep(0.0, 1.2, y) * (1.0 - smoothstep(height_m - 3.0, height_m, y));
	float facing = abs(dot(normalize(NORMAL), normalize(VIEW)));
	float rim = 1.0 - facing;
	if (mode > 0.5) {
		// The core: a faint column of light, stronger at the edges so it reads as a volume.
		float breathe = 0.85 + 0.15 * sin(TIME * 2.0 + y * 0.4);
		ALBEDO = core_tint;
		ALPHA = (0.05 + 0.2 * rim * rim) * ends * breathe * strength;
	} else {
		// Three helical bands (UV.x wraps once round), dashes racing up along them.
		float a = UV.x * 3.0 + y * 0.09 * spin - TIME * 0.55 * spin;
		float band = fract(a);
		float streak = smoothstep(0.0, 0.05, band) * (1.0 - smoothstep(0.1, 0.24, band));
		float dash = smoothstep(0.35, 0.7, noise(vec2(floor(a) * 7.3 + UV.x * 2.0, y * 0.35 - TIME * 2.6)));
		float wisps = smoothstep(0.62, 0.85, noise(vec2(UV.x * 18.0, y * 0.8 - TIME * 4.0)));
		float v = max(streak * dash, wisps * 0.4);
		ALBEDO = tint;
		ALPHA = v * (0.18 + 0.55 * rim) * ends * strength;
	}
}
