shader_type spatial;
// Dash afterimage colour pass: a silhouette in the dash colour with a brighter fresnel rim of the same hue (a rim
// pushed to white made teal and pink dashes both read white from the behind camera). fx.gd freezes the monk's
// current pose on a ghost rig (skeleton copy + the shared skinned mesh) and fades each ghost out with the
// per-instance `fade` uniform. `tint` is the dash colour at the dash's start (spec §3.6: teal, mist white when the last
// air dash is spent, pink with Twin Gale), in linear colour; the rim is the tint pushed toward white.
// It runs as the next_pass of fx_ghost_depth.gdshader, which lays down the ghost's nearest depth first,
// so only the front-most layer of the body is tinted (no busy see-through insides).
render_mode unshaded, blend_mix, cull_back, depth_draw_never, shadows_disabled, fog_disabled;
// Skip the live monk's pixels (her materials write 7, fx.gd MONK_STENCIL): a ghost left in front of her
// never covers her.
stencil_mode read, compare_not_equal, 7;

#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
// Web build (WebGL2): instance uniforms only fit ~64 instances there, so plain uniforms set per material
// (scripts/game/render_compat.gd).
uniform float fade = 1.0;
uniform vec3 tint = vec3(0.07, 0.69, 1.0);
#else
instance uniform float fade = 1.0;
instance uniform vec3 tint = vec3(0.07, 0.69, 1.0);
#endif
uniform float rim_white = 0.12;
uniform float core_alpha = 0.7;
uniform float hdr = 1.05; // more washes the tint out toward white through the tonemap and glow

void fragment() {
	float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
	// A little lighter toward the top of the screen-facing surfaces: reads as a glassy volume.
	float sheen = smoothstep(-0.2, 0.9, (INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).y) * 0.25;
	vec3 rim_color = mix(tint, vec3(1.0), rim_white);
	ALBEDO = mix(tint, rim_color, clamp(fresnel + sheen, 0.0, 1.0)) * hdr;
	ALPHA = clamp(mix(core_alpha, 1.0, fresnel) * fade, 0.0, 1.0);
}
