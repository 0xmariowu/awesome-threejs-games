// The screen transitions (shell/transition.gd, SHELL-FLOW): one full-screen rect on canvas layer 5, under the HUD.
//   mode 0  iris: black outside a circle round `center` (UV), `radius` in screen heights (the Mario circle)
//   mode 1  painting swirl: the screen twirled round `center` by progress * 8 * (1 - r), dissolving into `tint` (the
//           painting's palette colour) with slow turning bands, so a long cover never looks frozen
//   mode 2  fade to `tint`
//   mode 3  star wipe: a white-gold five-point star grows from `center` until it fills the screen
// `progress` runs 0 (open) .. 1 (covered) for modes 1-3. `busy` fades in a small turning gold arc in the bottom-right
// corner while an area builds under the cover. The rect is hidden whenever nothing is covered (transition.gd), so the
// screen copy this shader asks for only happens during a transition.
shader_type canvas_item;

uniform int mode = 0;
uniform vec2 center = vec2(0.5);
uniform float radius = 2.0;
uniform float progress = 0.0;
uniform vec4 tint : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float busy = 0.0;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear;

vec2 rot(vec2 p, float a) {
	float c = cos(a);
	float s = sin(a);
	return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

void fragment() {
	float aspect = SCREEN_PIXEL_SIZE.y / SCREEN_PIXEL_SIZE.x;
	vec2 p = (UV - center) * vec2(aspect, 1.0);
	float d = length(p);
	vec4 col = vec4(0.0);
	if (mode == 0) {
		float edge = max(fwidth(d) * 1.5, 0.002);
		col = vec4(0.0, 0.0, 0.0, smoothstep(radius, radius + edge, d));
	} else if (mode == 1) {
		float k = clamp(progress, 0.0, 1.0);
		vec2 q = rot(p, k * 8.0 * max(1.0 - d, 0.0));
		vec2 uv = center + q / vec2(aspect, 1.0);
		vec3 screen = texture(screen_tex, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
		float a = atan(p.y, p.x);
		float bands = 0.5 + 0.5 * sin(a * 3.0 + d * 12.0 - TIME * 1.6);
		vec3 paint = tint.rgb * (0.82 + 0.28 * bands);
		col = vec4(mix(screen, paint, smoothstep(0.3, 1.0, k)), 1.0);
	} else if (mode == 2) {
		col = vec4(tint.rgb, clamp(progress, 0.0, 1.0));
	} else {
		float a = atan(p.y, p.x) + TIME * 0.6;
		float star = mix(0.55, 1.0, 0.5 + 0.5 * cos(5.0 * a));
		float size = progress * 3.2 * star;
		float edge = max(fwidth(d) * 1.5, 0.002);
		float inside = 1.0 - smoothstep(size, size + edge, d);
		float glow = 0.5 + 0.5 * sin(d * 18.0 - TIME * 3.0);
		vec3 gold = vec3(1.0, 0.82, 0.25);
		col = vec4(mix(gold, vec3(1.0, 0.97, 0.86), 0.35 + 0.35 * glow), inside);
	}
	if (busy > 0.0) {
		// A turning arc, 3 % of the screen height, 6 % in from the bottom-right corner.
		vec2 corner = vec2(aspect - 0.06 * 1.0, 1.0 - 0.06);
		vec2 s = UV * vec2(aspect, 1.0) - corner;
		float ring = abs(length(s) - 0.03);
		float arc = fract((atan(s.y, s.x) / 6.2831853) - TIME * 0.8);
		float on = (1.0 - smoothstep(0.003, 0.006, ring)) * smoothstep(0.35, 1.0, arc) * busy;
		col = vec4(mix(col.rgb, vec3(1.0, 0.82, 0.25), on), max(col.a, on));
	}
	COLOR = col;
}
