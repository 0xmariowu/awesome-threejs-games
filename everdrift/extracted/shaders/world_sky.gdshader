shader_type sky;
// Clear storybook sky: deep blue zenith to pale cyan horizon, a warm sun with a soft halo,
// and a faint band of haze on the horizon so the sea and fog meet it seamlessly.

uniform vec3 zenith : source_color = vec3(0.13, 0.42, 0.93);
uniform vec3 horizon : source_color = vec3(0.56, 0.82, 1.0);
uniform vec3 haze : source_color = vec3(0.78, 0.92, 1.0);
uniform vec3 below : source_color = vec3(0.45, 0.72, 0.95);
uniform vec3 sun_tint : source_color = vec3(1.0, 0.92, 0.72);
uniform float sun_size = 0.035;

void sky() {
	vec3 d = normalize(EYEDIR);
	float y = d.y;
	vec3 col = mix(horizon, zenith, pow(smoothstep(0.0, 0.85, y), 0.7));
	col = mix(col, haze, (1.0 - smoothstep(0.0, 0.12, abs(y))) * 0.8);
	col = mix(col, below, smoothstep(0.0, -0.35, y));
	if (LIGHT0_ENABLED) {
		float c = dot(d, LIGHT0_DIRECTION);
		float disk = smoothstep(cos(sun_size), cos(sun_size * 0.8), c);
		float halo = pow(max(c, 0.0), 24.0) * 0.35 + pow(max(c, 0.0), 4.0) * 0.12;
		col += sun_tint * (disk * 6.0 + halo);
	}
	COLOR = col;
}
