shader_type canvas_item;
// Screen-space anime speed lines for the dash: radial streaks around `focus` that flicker every few
// frames and creep in from the screen edges as `intensity` rises. Drawn on a full-screen ColorRect.

uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform vec2 focus = vec2(0.5, 0.5); // UV of the point the lines converge on
uniform float aspect = 1.7778;
uniform vec3 line_color : source_color = vec3(1.0, 1.0, 1.0);
uniform vec3 edge_tint : source_color = vec3(0.55, 0.95, 1.0);
uniform float line_count = 110.0;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void fragment() {
	vec2 p = (UV - focus) * vec2(aspect, 1.0);
	float r = length(p);
	float a = atan(p.y, p.x) / TAU + 0.5;
	float cell = floor(a * line_count);
	float local = fract(a * line_count) - 0.5;
	float tick = floor(TIME * 20.0);
	float h = hash(vec2(cell, tick));
	float h2 = hash(vec2(cell + 17.0, tick));
	// Each cell shows a line some of the time; lines are wedges, thin near the centre.
	float on = step(0.5, h);
	float width = mix(0.08, 0.34, h2) * smoothstep(0.1, 1.2, r);
	float line = 1.0 - smoothstep(width * 0.5, width * 0.5 + 0.08, abs(local));
	// Lines start at a radius that shrinks as the intensity grows (they rush in from the edges).
	float start = mix(1.25, 0.5, intensity) + h2 * 0.2;
	float radial = smoothstep(start, start + 0.22, r);
	float lines = on * line * radial;
	// A soft coloured vignette under the lines.
	float vignette = smoothstep(0.6, 1.4, r) * 0.28;
	vec3 col = mix(edge_tint, line_color, clamp(lines, 0.0, 1.0));
	float alpha = clamp(lines * 0.5 + vignette, 0.0, 1.0) * intensity;
	COLOR = vec4(col, alpha);
}
