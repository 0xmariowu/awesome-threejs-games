shader_type spatial;
// Puffy cartoon clouds (sky clouds and the bobbing cloud platforms): bright white on the sun side,
// a cool lilac-blue in the shade, flat undersides, a soft bright rim. Unshaded, so clouds never get
// muddy shadows; the sun direction is a uniform set by level.gd.
render_mode unshaded, diffuse_lambert;

uniform vec3 lit_color : source_color = vec3(1.0, 1.0, 1.0);
uniform vec3 shade_color : source_color = vec3(0.84, 0.89, 1.0);
uniform vec3 under_color : source_color = vec3(0.8, 0.85, 0.98);
uniform vec3 sun_dir = vec3(-0.35, 0.8, 0.5);
uniform float brightness = 1.3;

varying vec3 wnrm;

void vertex() {
	wnrm = normalize(mat3(MODEL_MATRIX) * NORMAL);
}

void fragment() {
	vec3 n = normalize(wnrm);
	float ndl = dot(n, normalize(sun_dir));
	float lit = smoothstep(-0.25, 0.35, ndl);
	vec3 col = mix(shade_color, lit_color, lit);
	col = mix(col, under_color, smoothstep(-0.5, -0.9, n.y));
	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	col += vec3(0.12) * rim * lit;
	ALBEDO = col * brightness;
}
