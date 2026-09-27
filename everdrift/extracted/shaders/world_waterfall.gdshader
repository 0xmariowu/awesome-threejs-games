shader_type spatial;
// Cartoon waterfall: bands of white and pale blue streaks racing down, a bright lip at the top,
// soft side edges. UV.x runs across the fall (0..1), UV.y from the lip (0) down to the sea (1).
render_mode blend_mix, cull_disabled, depth_draw_opaque, unshaded;

uniform vec3 water_light : source_color = vec3(0.82, 0.96, 1.0);
uniform vec3 water_mid : source_color = vec3(0.38, 0.78, 0.98);
uniform vec3 water_deep : source_color = vec3(0.2, 0.58, 0.92);
uniform float speed = 1.6;
uniform float brightness = 1.2;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
// Web build (WebGL2): instance uniforms only fit ~64 instances there, so plain uniforms set per material
// (scripts/game/render_compat.gd).
uniform float length_m = 6.0;
#else
instance uniform float length_m = 6.0;
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
	vec2 uv = UV;
	float y = uv.y * length_m;
	// Streaks: noise stretched along the fall, scrolling down; faster further down.
	float scroll = TIME * speed * (1.0 + uv.y * 0.6);
	float n1 = noise(vec2(uv.x * 9.0, y * 0.7 - scroll * 1.2));
	float n2 = noise(vec2(uv.x * 17.0 + 3.1, y * 1.3 - scroll * 1.9));
	float streak = smoothstep(0.55, 0.62, n1 * 0.6 + n2 * 0.4);
	vec3 col = mix(water_mid, water_deep, smoothstep(0.35, 0.65, noise(vec2(uv.x * 5.0, y * 0.4 - scroll))));
	col = mix(col, water_light, streak);
	// Bright lip at the top, frothy white near the bottom.
	col = mix(col, water_light, 1.0 - smoothstep(0.0, 0.08, uv.y));
	col = mix(col, vec3(1.0), smoothstep(0.82, 1.0, uv.y) * 0.8);
	float edge = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x);
	ALBEDO = col * brightness;
	ALPHA = edge * 0.95;
}
