shader_type spatial;
// Blocks drawn procedurally in object space, one shared material:
//   kind 0 = ? block, 1 = used block, 2 = brick, 3 = coloured block, 4 = castle stone,
//   5 = lift (chevrons toward +X on top), 6 = slider (chevrons both ways along Z on top)
// `half_extent` is the block's half size (object space) so the face patterns stay square on any box.
render_mode diffuse_lambert;

#include "res://shaders/world_lighting.gdshaderinc"

#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
// Web build (WebGL2): instance uniforms only fit ~64 instances there, so plain uniforms set per material
// (scripts/game/render_compat.gd).
uniform int kind = 0;
uniform vec4 tint : source_color = vec4(0.3, 0.6, 1.0, 1.0);
uniform vec3 half_extent = vec3(0.55);
uniform float glow = 0.0;
#else
instance uniform int kind = 0;
instance uniform vec4 tint : source_color = vec4(0.3, 0.6, 1.0, 1.0);
instance uniform vec3 half_extent = vec3(0.55);
instance uniform float glow = 0.0;
#endif

uniform vec3 q_body : source_color = vec3(1.0, 0.7, 0.06);
uniform vec3 q_edge : source_color = vec3(0.86, 0.43, 0.04);
uniform vec3 q_mark : source_color = vec3(1.0, 0.97, 0.88);
uniform vec3 q_shadow : source_color = vec3(0.55, 0.25, 0.04);
uniform vec3 used_body : source_color = vec3(0.62, 0.4, 0.24);
uniform vec3 brick_body : source_color = vec3(0.86, 0.43, 0.17);
uniform vec3 brick_mortar : source_color = vec3(0.45, 0.2, 0.1);
uniform vec3 stone_body : source_color = vec3(0.86, 0.82, 0.74);
uniform vec3 stone_mortar : source_color = vec3(0.6, 0.55, 0.5);

varying vec3 lpos;
varying vec3 lnrm;

void vertex() {
	lpos = VERTEX;
	lnrm = NORMAL;
}

float sd_segment(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h);
}

// Signed distance to a "?" glyph in a [-1, 1] face (y up).
float sd_question(vec2 p) {
	vec2 c = vec2(0.0, 0.3);
	float r = 0.3;
	vec2 d = p - c;
	float ang = atan(d.y, d.x);
	// Hook: ring arc from lower-right (-55 deg) counter-clockwise over the top to the left (200 deg).
	float arc = abs(length(d) - r);
	float a0 = radians(-55.0);
	float a1 = radians(200.0);
	float aw = ang < a0 - 0.3 ? ang + 2.0 * PI : ang;
	if (aw < a0 || aw > a1) {
		vec2 e0 = c + r * vec2(cos(a0), sin(a0));
		vec2 e1 = c + r * vec2(cos(a1), sin(a1));
		arc = min(length(p - e0), length(p - e1));
	}
	vec2 e0 = c + r * vec2(cos(a0), sin(a0));
	float stem = sd_segment(p, e0, vec2(0.0, -0.1));
	stem = min(stem, sd_segment(p, vec2(0.0, -0.1), vec2(0.0, -0.2)));
	float glyph = min(arc, stem) - 0.12;
	float dot_d = length(p - vec2(0.0, -0.52)) - 0.13;
	return min(glyph, dot_d);
}

float aa_fill(float sd) {
	float w = max(fwidth(sd), 1e-4);
	return 1.0 - smoothstep(-w, w, sd);
}

void fragment() {
	vec3 an = abs(lnrm);
	vec3 fn;
	vec2 uv;
	vec2 half2;
	bool is_top = false;
	if (an.y >= an.x && an.y >= an.z) {
		fn = vec3(0.0, sign(lnrm.y), 0.0);
		uv = vec2(lpos.x, -lpos.z);
		half2 = half_extent.xz;
		is_top = lnrm.y > 0.0;
	} else {
		fn = an.x > an.z ? vec3(sign(lnrm.x), 0.0, 0.0) : vec3(0.0, 0.0, sign(lnrm.z));
		vec3 right = cross(vec3(0.0, 1.0, 0.0), fn);
		uv = vec2(dot(lpos, right), lpos.y);
		half2 = vec2(abs(dot(half_extent, right)), half_extent.y);
	}
	vec2 f = uv / half2;                 // face coords in [-1, 1]
	vec2 m = uv;                          // metres across the face
	float edge = max(abs(f.x), abs(f.y));
	vec3 col;
	vec3 emit = vec3(0.0);

	if (kind == 0 || kind == 1) {
		vec3 body = kind == 0 ? q_body : used_body;
		vec3 edge_col = kind == 0 ? q_edge : used_body * 0.72;
		col = mix(body, edge_col, smoothstep(0.8, 0.86, edge));
		// Rivets in the four corners.
		vec2 rv = abs(f) - vec2(0.66);
		float rivet = aa_fill(length(rv) - 0.075);
		col = mix(col, edge_col * 0.8, rivet);
		col = mix(col, body * 1.15, aa_fill(length(rv + vec2(0.02, -0.02)) - 0.03) * rivet);
		if (kind == 0 && !is_top && fn.y == 0.0) {
			vec2 g = f * vec2(1.25, 1.1);
			float shadow = aa_fill(sd_question(g - vec2(0.07, -0.07)));
			float mark = aa_fill(sd_question(g));
			col = mix(col, q_shadow, shadow * 0.9);
			col = mix(col, q_mark, mark);
			emit = q_mark * mark * 0.12;
		}
		if (kind == 0) {
			emit += q_body * 0.12;
		}
	} else if (kind == 2 || kind == 4) {
		// Bricks: rows of offset bricks, measured in metres so every block agrees.
		float row_h = kind == 2 ? 0.275 : 0.5;
		float brick_w = kind == 2 ? 0.55 : 0.9;
		vec2 b = m;
		if (is_top || fn.y < 0.0) {
			b = vec2(m.x, m.y);
		}
		float row = floor(b.y / row_h);
		float bx = b.x / brick_w + (mod(row, 2.0) == 0.0 ? 0.0 : 0.5);
		float fy = fract(b.y / row_h);
		float fx = fract(bx);
		float mortar_w = kind == 2 ? 0.07 : 0.05;
		float wy = fwidth(b.y / row_h) + mortar_w;
		float wx = fwidth(bx) + mortar_w * row_h / brick_w;
		float mort = max(1.0 - smoothstep(0.0, wy, min(fy, 1.0 - fy)), 1.0 - smoothstep(0.0, wx, min(fx, 1.0 - fx)));
		vec3 body = kind == 2 ? brick_body : stone_body * tint.rgb;
		vec3 mortar = kind == 2 ? brick_mortar : stone_mortar * tint.rgb;
		// A lighter bevel on the upper edge of each brick.
		float bevel = smoothstep(0.75, 0.9, fy) * (1.0 - mort);
		col = mix(body, mortar, mort);
		col = mix(col, body * 1.15, bevel * 0.6);
	} else {
		// Coloured toy block: lighter inset panel, darker rim, a glossy tick in the corner.
		vec3 body = tint.rgb;
		float panel = aa_fill(max(abs(f.x), abs(f.y)) - 0.7);
		col = mix(body * 0.78, body, smoothstep(0.84, 0.78, edge));
		col = mix(col, mix(body, vec3(1.0), 0.18), panel);
		float tick = aa_fill(sd_segment(f, vec2(-0.55, 0.4), vec2(-0.3, 0.55)) - 0.06);
		col = mix(col, vec3(1.0), tick * 0.7);
		if (kind == 5 && is_top) {
			// Chevrons pointing +X: which way the lift will carry you.
			vec2 p = vec2(f.x, abs(f.y));
			float chev = 1e3;
			for (int i = -1; i <= 1; i++) {
				float x0 = float(i) * 0.5;
				chev = min(chev, sd_segment(p, vec2(x0 - 0.12, 0.28), vec2(x0 + 0.12, 0.0)) - 0.07);
			}
			col = mix(col, vec3(1.0, 0.95, 0.6), aa_fill(chev));
		}
		if (kind == 6 && is_top) {
			// Chevrons pointing out along Z (face y): this one slides in and out of the screen.
			vec2 p = vec2(abs(f.y), abs(f.x));
			float chev = min(sd_segment(p, vec2(0.3, 0.3), vec2(0.62, 0.0)) - 0.08, sd_segment(p, vec2(0.0, 0.3), vec2(0.32, 0.0)) - 0.08);
			col = mix(col, vec3(1.0, 1.0, 0.92), aa_fill(chev));
		}
	}
	if (fn.y < 0.0) {
		col *= 0.8;
	}
	ALBEDO = col;
	EMISSION = emit + col * glow;
	ROUGHNESS = 0.6;
}

void light() {
	DIFFUSE_LIGHT += world_toon_diffuse(NORMAL, LIGHT, LIGHT_COLOR, ATTENUATION);
	SPECULAR_LIGHT += world_toon_specular(NORMAL, LIGHT, VIEW, LIGHT_COLOR, ATTENUATION, 0.94, 0.35);
}
