shader_type spatial;
// Butterflies and birds (valley_props.gd Critters): one MultiMesh of a pair of wings (the mesh: two quads hinged on
// the local Z axis, x < 0 the left wing), moved entirely in here. Each instance's transform is the centre of its
// flight; INSTANCE_CUSTOM carries (phase 0..1, speed, path radius, kind: 0 butterfly, 1 bird). A butterfly flutters on
// a wobbly loop a metre or two round a flower patch; a bird glides on a wide circle, flapping now and then.
// COLOR.rgb (the instance colour) tints the wings; COLOR.a is the instance's scale, so the path is in metres.
render_mode cull_disabled, specular_disabled;

#include "res://shaders/world_lighting.gdshaderinc"

varying vec3 tint;

vec3 path(float t, float r, float kind) {
	if (kind > 0.5) {
		return vec3(cos(t) * r, sin(t * 0.7) * 1.5, sin(t) * r);
	}
	return vec3(cos(t) * r + 0.35 * sin(t * 3.1), 0.45 * sin(t * 2.3) + 0.25 * sin(t * 5.7), sin(t * 1.3) * r * 0.8);
}

void vertex() {
	float phase = INSTANCE_CUSTOM.r * 6.2832;
	float speed = INSTANCE_CUSTOM.g;
	float r = INSTANCE_CUSTOM.b * 10.0;
	float kind = INSTANCE_CUSTOM.a;
	float t = TIME * speed + phase;
	vec3 p = path(t, r, kind);
	vec3 ahead = path(t + 0.05, r, kind) - p;
	float heading = atan(ahead.x, ahead.z);
	// Flap: each wing turns about the body axis (Z); birds glide with their wings up a little between bursts.
	float side = VERTEX.x < 0.0 ? -1.0 : 1.0;
	float flap;
	if (kind > 0.5) {
		float burst = smoothstep(0.2, 0.6, sin(TIME * 0.9 + phase * 3.0));
		flap = 0.15 + burst * 0.55 * sin(TIME * 9.0 + phase);
	} else {
		flap = 0.25 + 0.95 * (0.5 + 0.5 * sin(TIME * 17.0 + phase * 5.0));
	}
	float ang = side * flap;
	vec3 v = VERTEX;
	v = vec3(v.x * cos(ang) - v.y * sin(ang), v.x * sin(ang) + v.y * cos(ang), v.z);
	// Bank into the turn a little.
	float bank = kind > 0.5 ? -0.35 : 0.0;
	v = vec3(v.x * cos(bank) - v.y * sin(bank), v.x * sin(bank) + v.y * cos(bank), v.z);
	v = vec3(v.x * cos(heading) + v.z * sin(heading), v.y, -v.x * sin(heading) + v.z * cos(heading));
	VERTEX = v + p / max(COLOR.a, 0.01);
	NORMAL = vec3(0.0, 1.0, 0.0);
	tint = COLOR.rgb;
}

void fragment() {
	ALBEDO = tint;
	ROUGHNESS = 1.0;
}

void light() {
	DIFFUSE_LIGHT += world_toon_diffuse(vec3(0.0, 1.0, 0.0), LIGHT, LIGHT_COLOR, ATTENUATION) * 0.8 + LIGHT_COLOR * 0.06;
}
