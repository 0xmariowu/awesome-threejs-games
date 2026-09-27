shader_type spatial;
// Waving flags (checkpoints, goal, castle). The flag mesh is a subdivided quad from x = 0 (pole side) to
// x = 1, y in [-0.5, 0.5]; the wave grows away from the pole. An emblem (ring + star) is drawn from UVs.
render_mode cull_disabled, diffuse_lambert;

#include "res://shaders/world_lighting.gdshaderinc"

#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
// Web build (WebGL2): instance uniforms only fit ~64 instances there, so plain uniforms set per material
// (scripts/game/render_compat.gd).
uniform vec4 flag_color : source_color = vec4(0.9, 0.2, 0.2, 1.0);
uniform vec4 emblem_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float wave_speed = 6.0;
#else
instance uniform vec4 flag_color : source_color = vec4(0.9, 0.2, 0.2, 1.0);
instance uniform vec4 emblem_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
instance uniform float wave_speed = 6.0;
#endif

varying vec2 fuv;

void vertex() {
	fuv = vec2(VERTEX.x, VERTEX.y + 0.5);
	float k = VERTEX.x;
	float w = sin(VERTEX.x * 5.0 - TIME * wave_speed) * 0.12 * k + sin(VERTEX.x * 9.0 - TIME * wave_speed * 1.6) * 0.03 * k;
	VERTEX.z += w;
	VERTEX.y -= k * k * 0.06;
	float dw = cos(VERTEX.x * 5.0 - TIME * wave_speed) * 0.6 * k;
	NORMAL = normalize(vec3(-dw, 0.0, 1.0));
}

float star(vec2 p, float r) {
	// 5-point star SDF (Inigo Quilez).
	const vec2 k1 = vec2(0.809016994375, -0.587785252292);
	const vec2 k2 = vec2(-k1.x, k1.y);
	p.x = abs(p.x);
	p -= 2.0 * max(dot(k1, p), 0.0) * k1;
	p -= 2.0 * max(dot(k2, p), 0.0) * k2;
	p.x = abs(p.x);
	p.y -= r;
	vec2 ba = 0.45 * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
	float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
	return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

void fragment() {
	vec2 p = (fuv - vec2(0.45, 0.5)) * vec2(1.6, 1.0);
	float s = star(p, 0.28);
	float w = fwidth(s);
	float e = 1.0 - smoothstep(-w, w, s);
	vec3 col = mix(flag_color.rgb, emblem_color.rgb, e);
	// Darker hem along the free edge.
	col *= 1.0 - 0.15 * smoothstep(0.9, 0.97, fuv.x);
	ALBEDO = col;
	EMISSION = col * 0.08;
	ROUGHNESS = 0.8;
}

void light() {
	DIFFUSE_LIGHT += world_toon_diffuse(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION) * 0.7
		+ world_toon_diffuse(-NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION) * 0.3;
}
