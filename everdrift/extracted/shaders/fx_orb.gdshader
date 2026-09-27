shader_type spatial;
// The element orb (element_orb.gd): a spinning platform of air (mode 0, wind: the sphere squashed to a disc by the
// node's scale) or a wobbling bubble (mode 1, water). A fresnel rim, spiral bands turning in object space, a soft
// bright core and a slow pulse, all from TIME: the CPU never touches the material while the orb flies or hovers.
// Emissive only (the orb has no light). Two pooled materials (one per mode, element_orb.gd), no instance uniforms:
// the orb fades by scale.
render_mode unshaded, blend_mix, depth_draw_never, cull_back, shadows_disabled, fog_disabled;

uniform int mode = 0; // 0 wind, 1 water
uniform vec3 tint : source_color = vec3(0.78, 0.97, 1.0);
uniform vec3 deep : source_color = vec3(0.16, 0.72, 0.86);
uniform float hdr = 1.8;

varying vec3 local;

void vertex() {
	local = VERTEX;
	if (mode == 1) {
		// The bubble wobbles: two slow lobes travelling round it.
		float w = sin(VERTEX.y * 4.0 + TIME * 5.0) * 0.05 + sin(atan(VERTEX.z, VERTEX.x) * 3.0 - TIME * 3.0) * 0.04;
		VERTEX *= 1.0 + w;
	}
}

void fragment() {
	vec3 p = normalize(local);
	float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.2);
	float pulse = 0.5 + 0.5 * sin(TIME * 6.0);
	float a = atan(p.z, p.x);
	vec3 col;
	float alpha;
	if (mode == 0) {
		// Wind: a flat platform (the unit sphere squashed to a disc by the node's scale, element_orb.gd DISC_*), like
		// Cappy's brim: three spiral arms winding into the centre and turning, a fainter fast set between them, a
		// pulsing inner ring, a bright brim, a lit top surface to land on and a paler, clearer underside.
		float r = clamp(length(local.xz), 0.0, 1.0); // 0 at the centre, 1 at the brim
		float up = (INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).y; // the world normal's y: +1 on top, -1 underneath
		float top = smoothstep(-0.3, 0.5, up);
		float arms = smoothstep(0.35, 0.95, sin(a * 3.0 + r * 7.0 - TIME * 9.0)) * smoothstep(0.06, 0.3, r);
		float wisp = smoothstep(0.75, 1.0, sin(a * 5.0 - r * 11.0 - TIME * 13.0)) * 0.5;
		float swirl = max(arms, wisp);
		float brim = smoothstep(0.8, 0.97, r);
		float ring = smoothstep(0.06, 0.0, abs(r - 0.5 - 0.04 * pulse)) * 0.6;
		float core = smoothstep(0.18, 0.0, r) * top;
		// The body is kept under the HDR push (x 0.7) so it reads teal in daylight; the arms, ring, brim and eye glow.
		col = mix(deep * 0.7, tint, swirl * 0.9);
		col = mix(col, vec3(1.0), clamp(brim * 0.75 + ring * 0.45 + core * 0.6, 0.0, 1.0));
		alpha = clamp(0.62 + swirl * 0.4 + brim * 0.4 + ring * 0.3 + core * 0.3 + fresnel * 0.15, 0.0, 1.0);
		alpha *= mix(0.6, 1.0, top);
	} else {
		// Water: a clear bubble, caustic bands drifting over it, a bright rim and one highlight.
		float caustic = sin(p.x * 9.0 + TIME * 2.0) * sin(p.y * 8.0 - TIME * 2.6) * sin(p.z * 7.0 + TIME * 1.7);
		float c = smoothstep(0.05, 0.4, caustic);
		vec3 view_n = NORMAL;
		float spec = smoothstep(0.93, 0.98, dot(view_n, normalize(vec3(-0.4, 0.6, 0.7))));
		// Kept under the HDR push (x 0.62) so the bubble reads blue in daylight, not white; the highlight stays white.
		col = mix(deep, tint, 0.15 + 0.3 * c);
		col = mix(col, vec3(0.8, 0.92, 1.0), fresnel * 0.4) * 0.62;
		col = mix(col, vec3(0.75), spec);
		alpha = clamp(0.4 + fresnel * 0.6 + c * 0.2 + spec, 0.0, 1.0);
	}
	ALBEDO = col * hdr * (0.92 + 0.08 * pulse);
	ALPHA = alpha;
}
