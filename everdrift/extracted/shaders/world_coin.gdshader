shader_type spatial;
render_mode diffuse_lambert;

#include "res://shaders/world_lighting.gdshaderinc"

// Same palette as the HUD CoinIcon so the world coin and the counter read as one object.
uniform vec3 face_color : source_color = vec3(1.0, 0.812, 0.227);   // #ffcf3a
uniform vec3 rim_gold : source_color = vec3(0.878, 0.647, 0.149);   // #e0a526
uniform vec3 ring_color : source_color = vec3(0.851, 0.592, 0.110); // #d9971c
uniform vec3 slot_color : source_color = vec3(0.784, 0.529, 0.102); // #c8871a
uniform vec3 slot_light : source_color = vec3(1.0, 0.945, 0.659);   // #fff1a8
uniform vec3 edge_color : source_color = vec3(0.718, 0.475, 0.122); // #b7791f
uniform vec3 rim_color : source_color = vec3(1.0, 0.95, 0.7);
uniform float coin_radius = 0.3;  // LevelMesh.coin_mesh() r
uniform float spin_speed = 3.6;
uniform float emission = 0.42;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
// Web build (WebGL2): instance uniforms only fit ~64 instances there, so plain uniforms set per material
// (scripts/game/render_compat.gd).
uniform float spin_offset = 0.0;
#else
instance uniform float spin_offset = 0.0;
#endif

varying float face;
varying vec2 disc;      // object-space face position / radius (unrotated)
varying float side;     // +1 on the +Z face, -1 on the -Z face

void vertex() {
	float a = TIME * spin_speed + spin_offset;
	mat3 r = mat3(vec3(cos(a), 0.0, -sin(a)), vec3(0.0, 1.0, 0.0), vec3(sin(a), 0.0, cos(a)));
	face = abs(NORMAL.z);
	disc = VERTEX.xy / coin_radius;
	side = NORMAL.z >= 0.0 ? 1.0 : -1.0;
	VERTEX = r * VERTEX;
	NORMAL = r * NORMAL;
}

void fragment() {
	float rr = length(disc);
	float aa = fwidth(rr) + 0.002;
	vec3 col = face_color;
	// Inner ring (HUD: r * 0.64).
	col = mix(col, ring_color, 1.0 - smoothstep(0.035, 0.035 + aa, abs(rr - 0.64)));
	// Raised slot, 0.24 x 0.84 of r, with a light half on the viewer's left.
	vec2 sp = vec2(disc.x * side, disc.y);
	float in_slot = (1.0 - smoothstep(0.12, 0.12 + fwidth(sp.x) + 0.002, abs(sp.x)))
		* (1.0 - smoothstep(0.42, 0.42 + fwidth(sp.y) + 0.002, abs(sp.y)));
	col = mix(col, sp.x < 0.0 ? slot_light : slot_color, in_slot);
	// Outer rim band (HUD: face ends at r * 0.84).
	col = mix(col, rim_gold, smoothstep(0.84 - aa, 0.84, rr));
	// The coin's edge band and the sloped lathe steps.
	col = mix(edge_color, col, smoothstep(0.35, 0.8, face));
	ALBEDO = col;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.5);
	EMISSION = col * emission + rim_color * fres * 0.6;
	ROUGHNESS = 0.4;
}

void light() {
	DIFFUSE_LIGHT += world_toon_diffuse(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION);
	SPECULAR_LIGHT += world_toon_specular(NORMAL, LIGHT, VIEW, LIGHT_COLOR, ATTENUATION, 0.9, 0.9);
}
