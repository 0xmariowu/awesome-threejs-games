shader_type spatial;
// Spirit Star body (LevelMesh.star_mesh(): a puffy five-point star, faces along +-Z): toy-lacquer gold, lighter on
// the puffed faces and warmer toward the tips, two little eyes on each face, a teal Fresnel rim and enough emission
// to bloom, so it reads as a treasure from across the archipelago.
render_mode diffuse_lambert;

#include "res://shaders/world_lighting.gdshaderinc"

uniform vec3 gold_light : source_color = vec3(1.0, 0.9, 0.36);
uniform vec3 gold_mid : source_color = vec3(1.0, 0.74, 0.12);
uniform vec3 gold_deep : source_color = vec3(0.93, 0.5, 0.06);
uniform vec3 eye_color : source_color = vec3(0.16, 0.09, 0.05);
uniform vec3 glow_color : source_color = vec3(0.35, 1.0, 0.9);
uniform float emission = 0.38;
uniform float rim_glow = 1.3;
uniform float outer_radius = 0.62;  // LevelMesh.STAR_OUTER
// 0 = resting; the pickup raises it so the star flares white-gold as it zips away.
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
// Web build (WebGL2): instance uniforms only fit ~64 instances there, so plain uniforms set per material
// (scripts/game/render_compat.gd).
uniform float flare = 0.0;
#else
instance uniform float flare = 0.0;
#endif

varying vec3 obj;
varying vec3 onrm;

void vertex() {
	obj = VERTEX;
	onrm = NORMAL;
}

// One eye: a vertical oval at `c` (object xy), with a small highlight near its top.
float eye(vec2 p, vec2 c) {
	vec2 d = (p - c) / vec2(0.04, 0.093);
	return 1.0 - smoothstep(0.85, 1.0, length(d));
}

float eye_glint(vec2 p, vec2 c) {
	vec2 d = (p - c - vec2(0.01, 0.036)) / vec2(0.014, 0.021);
	return 1.0 - smoothstep(0.7, 1.0, length(d));
}

void fragment() {
	float r = length(obj.xy) / outer_radius;
	float face = abs(onrm.z);
	vec3 col = mix(gold_mid, gold_light, smoothstep(0.35, 0.95, face) * (1.0 - smoothstep(0.35, 0.9, r)));
	col = mix(col, gold_deep, smoothstep(0.55, 1.0, r) * 0.55 + (1.0 - face) * 0.25);
	// Eyes on both faces (only where the surface faces front or back).
	float on_face = smoothstep(0.55, 0.8, face);
	float e = max(eye(obj.xy, vec2(-0.1, 0.042)), eye(obj.xy, vec2(0.1, 0.042))) * on_face;
	float g = max(eye_glint(obj.xy, vec2(-0.1, 0.042)), eye_glint(obj.xy, vec2(0.1, 0.042))) * on_face;
	col = mix(col, eye_color, e);
	col = mix(col, vec3(1.0), g * e);
	ALBEDO = col;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.2);
	EMISSION = col * (emission + flare * 1.5) * (1.0 - e * 0.85) + glow_color * fres * rim_glow * (1.0 + flare);
	ROUGHNESS = 0.3;
}

void light() {
	DIFFUSE_LIGHT += world_toon_diffuse(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION);
	SPECULAR_LIGHT += world_toon_specular(NORMAL, LIGHT, VIEW, LIGHT_COLOR, ATTENUATION, 0.93, 1.1);
}
