shader_type spatial;
// Additive light for the Spirit Stars, three looks picked per instance by `mode`:
//   0 halo    camera-facing quad (QuadMesh 1 x 1): a gold core in a soft teal glow
//   1 beam    open cylinder (LevelMesh.beam_mesh(), UV.y 0 at the foot, 1 at the top): a soft pillar of light,
//             brightest where it faces the camera, fading out toward its top and its foot
//   2 twinkle camera-facing quad: a four-point sparkle
// Fog does not touch it (fog_disabled), so a star far across the sea still reads; `strength` fades or flares it.
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;

uniform vec3 core_color : source_color = vec3(1.0, 0.9, 0.5);
uniform vec3 glow_color : source_color = vec3(0.3, 1.0, 0.86);
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
// Web build (WebGL2): instance uniforms only fit ~64 instances there, so plain uniforms set per material
// (scripts/game/render_compat.gd).
uniform int mode = 0;
uniform float strength = 1.0;
#else
instance uniform int mode = 0;
instance uniform float strength = 1.0;
#endif

varying vec2 quad;

void vertex() {
	quad = UV * 2.0 - 1.0;
	if (mode != 1) {
		// Billboard, keeping the node's scale.
		MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
		MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(
				vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0),
				vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0),
				vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0),
				vec4(0.0, 0.0, 0.0, 1.0));
		MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
	}
}

void fragment() {
	vec3 col = vec3(0.0);
	if (mode == 0) {
		float r = length(quad);
		float outer = pow(clamp(1.0 - r, 0.0, 1.0), 2.4);
		float core = pow(clamp(1.0 - r * 2.6, 0.0, 1.0), 2.0);
		col = glow_color * outer * 0.55 + core_color * core * 0.9;
	} else if (mode == 1) {
		float facing = pow(abs(dot(NORMAL, VIEW)), 2.0);
		float h = UV.y;
		float along = smoothstep(0.0, 0.06, h) * pow(1.0 - h, 1.6);
		// A slow shimmer rising up the pillar.
		float shimmer = 0.8 + 0.2 * sin(h * 26.0 - TIME * 3.0);
		col = mix(glow_color, core_color, 0.25) * facing * along * shimmer * 0.42;
	} else {
		vec2 p = abs(quad);
		float cross_arm = max(1.0 - smoothstep(0.0, 0.16, p.x) - p.y, 1.0 - smoothstep(0.0, 0.16, p.y) - p.x);
		float dot_core = 1.0 - smoothstep(0.0, 0.35, length(quad));
		col = mix(glow_color, vec3(1.0), 0.6) * clamp(max(cross_arm, dot_core), 0.0, 1.0) * 1.3;
	}
	ALBEDO = col * strength;
}
