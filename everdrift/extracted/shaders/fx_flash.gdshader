shader_type spatial;
// Hit / power flash drawn as a material_overlay on the monk: an additive fresnel glow whose
// `strength` fx.gd tweens from 1 to 0.
render_mode unshaded, blend_add, cull_back, depth_draw_never, shadows_disabled, fog_disabled;

uniform vec3 flash_color : source_color = vec3(1.0);
uniform float strength = 0.0;

void fragment() {
	float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
	ALBEDO = flash_color * strength * (0.35 + 1.4 * fresnel);
}
