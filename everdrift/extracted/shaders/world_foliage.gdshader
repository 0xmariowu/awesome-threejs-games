shader_type spatial;
// Grass tufts and flowers (MultiMesh). Vertex colour = base shading of the mesh; its alpha marks the
// parts tinted per instance (INSTANCE_CUSTOM.rgb, e.g. petal colours). Everything sways in the breeze
// and is lit with an up normal, so it blends into the grass it grows from.
render_mode cull_disabled, diffuse_lambert;

#include "res://shaders/world_lighting.gdshaderinc"

uniform float sway = 0.07;
uniform vec3 grass_tint : source_color = vec3(0.47, 0.84, 0.19);

varying vec3 tint;
varying float mask;

void vertex() {
	vec3 origin = MODEL_MATRIX[3].xyz;
	float phase = TIME * 1.8 + origin.x * 0.6 + origin.z * 0.45;
	float bend = VERTEX.y * VERTEX.y * 4.0;
	VERTEX.x += sin(phase) * sway * bend;
	VERTEX.z += cos(phase * 0.8) * sway * 0.6 * bend;
	tint = COLOR.rgb * mix(grass_tint, INSTANCE_CUSTOM.rgb, COLOR.a);
	mask = COLOR.a;
	NORMAL = mix(vec3(0.0, 1.0, 0.0), NORMAL, 0.3);
}

void fragment() {
	ALBEDO = tint;
	EMISSION = tint * 0.06 * mask;
	ROUGHNESS = 1.0;
}

void light() {
	DIFFUSE_LIGHT += world_toon_diffuse(vec3(0.0, 1.0, 0.0), LIGHT, LIGHT_COLOR, ATTENUATION);
}
