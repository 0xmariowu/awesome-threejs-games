shader_type spatial;
// Dash afterimage depth pass: writes the ghost's nearest depth and no colour, so its next_pass
// (fx_ghost.gdshader) tints only the front-most surface of the ghost body.
render_mode unshaded, blend_mix, cull_back, depth_draw_always, shadows_disabled, fog_disabled;
// Like the colour pass, skip the live monk's pixels (fx.gd MONK_STENCIL), so no ghost depth lands on her
// and her flash overlay still draws where a ghost overlaps her.
stencil_mode read, compare_not_equal, 7;

void fragment() {
	ALBEDO = vec3(0.0);
	ALPHA = 0.0;
}
