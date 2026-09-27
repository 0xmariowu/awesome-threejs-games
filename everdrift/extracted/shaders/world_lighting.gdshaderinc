// Shared toon lighting for the world shaders (ground, blocks, coins, water).
// A soft two-band ramp: surfaces facing the sun are evenly lit (the flat "painted" look of Mario 3D World),
// the terminator is a short smooth step, and shadows come in through ATTENUATION.

// Diffuse contribution of one light. LIGHT_COLOR already carries energy * PI, so divide by PI.
vec3 world_toon_diffuse(vec3 normal, vec3 light, vec3 light_color, float attenuation) {
	float ndl = dot(normal, light);
	float ramp = smoothstep(-0.04, 0.24, ndl);
	// Keep a hint of the Lambert falloff so big rounded shapes still read as round.
	float body = mix(ramp, clamp(ndl * 1.3, 0.0, 1.0), 0.22);
	return light_color * body * attenuation / PI;
}

// A small, hard-edged toy highlight (plastic / lacquer look).
vec3 world_toon_specular(vec3 normal, vec3 light, vec3 view, vec3 light_color, float attenuation, float size, float strength) {
	vec3 h = normalize(light + view);
	float s = smoothstep(size, size + 0.03, dot(normal, h));
	return light_color * s * strength * attenuation / PI;
}
