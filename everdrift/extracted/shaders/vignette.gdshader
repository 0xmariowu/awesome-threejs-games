shader_type canvas_item;

uniform float strength = 0.5;

void fragment() {
	vec2 uv = (UV - 0.5) * vec2(1.25, 1.0);
	COLOR = vec4(0.02, 0.01, 0.05, smoothstep(0.3, 0.85, length(uv)) * strength);
}
