"""Deterministic mesh-authoring and batching for Cloudkeep's Blender assets."""
import bpy
import math
from mathutils import Vector

TAU = math.tau

def linear(rgb):
    if isinstance(rgb, str):
        rgb = tuple(int(rgb.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)

def mix(a, b, t):
    return tuple(x * (1 - t) + y * t for x, y in zip(a, b))

def material(name, color='#ffffff', roughness=.55, metallic=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*linear(color), 1)
    m.use_nodes = True
    shader = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = m.diffuse_color
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if color == '#ffffff':
        tint = m.node_tree.nodes.new('ShaderNodeVertexColor')
        tint.layer_name = 'Tint'
        m.node_tree.links.new(tint.outputs['Color'], shader.inputs['Base Color'])
    if emission:
        shader.inputs['Emission Color'].default_value = m.diffuse_color
        shader.inputs['Emission Strength'].default_value = emission
    return m

def mesh(name, vertices, faces, mat, colors=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    data.materials.append(mat)
    if colors:
        attribute = data.color_attributes.new(name='Tint', type='FLOAT_COLOR', domain='POINT')
        attribute.data.foreach_set('color', [c for rgb in colors for c in (*rgb, 1)])
        data.color_attributes.active_color = attribute
    for polygon in data.polygons:
        polygon.use_smooth = smooth
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj

def sphere(name, center, radii, mat, color=None, segments=24, rings=14, tint=None):
    vertices, faces, colors = [], [], []
    for j in range(rings + 1):
        t = math.pi * j / rings
        for i in range(segments):
            a = TAU * i / segments
            u = (math.sin(t) * math.cos(a), math.sin(t) * math.sin(a), math.cos(t))
            p = tuple(center[k] + u[k] * radii[k] for k in range(3))
            vertices.append(p)
            if tint: colors.append(tint(u, p))
            elif color: colors.append(linear(color) if isinstance(color, str) else color)
    for j in range(rings):
        for i in range(segments):
            a, b = j * segments + i, j * segments + (i + 1) % segments
            faces.append((a, a + segments, b + segments, b))
    return mesh(name, vertices, faces, mat, colors)

def tube(name, points, radius, mat, color=None, sides=8, caps=True):
    vertices, faces = [], []
    for j, xyz in enumerate(points):
        tangent = (Vector(points[min(j + 1, len(points) - 1)]) - Vector(points[max(j - 1, 0)])).normalized()
        reference = Vector((0, 0, 1)) if abs(tangent.z) < .94 else Vector((0, 1, 0))
        side = tangent.cross(reference).normalized()
        up = tangent.cross(side).normalized()
        r = radius[j] if isinstance(radius, (list, tuple)) else radius
        for i in range(sides):
            a = TAU * i / sides
            vertices.append(tuple(Vector(xyz) + r * (side * math.cos(a) + up * math.sin(a))))
    for j in range(len(points) - 1):
        for i in range(sides):
            a, b = j * sides + i, j * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    if caps: faces += [tuple(reversed(range(sides))), tuple((len(points) - 1) * sides + i for i in range(sides))]
    return mesh(name, vertices, faces, mat, [linear(color)] * len(vertices) if color else None)

def ring(name, center, radius, thickness, mat, plane='XY', segments=40, color=None):
    axes = {'XY': (0, 1), 'XZ': (0, 2), 'YZ': (1, 2)}[plane]
    points = []
    for i in range(segments + 1):
        p = list(center)
        p[axes[0]] += radius * math.cos(TAU * i / segments)
        p[axes[1]] += radius * math.sin(TAU * i / segments)
        points.append(p)
    return tube(name, points, thickness, mat, color, caps=False)

def box(name, center, size, mat, color=None, bevel=.03):
    x, y, z = (v / 2 for v in size)
    v = [(center[0] + a, center[1] + b, center[2] + c) for a,b,c in [(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]]
    f = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    obj = mesh(name,v,f,mat,[linear(color)] * 8 if color else None,False)
    if bevel:
        modifier = obj.modifiers.new('Crafted edges','BEVEL'); modifier.width=bevel; modifier.segments=3
        obj.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    return obj

def parent(name, objects, origin=(0,0,0)):
    root=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(root); root.location=origin
    bpy.context.view_layer.update()
    for obj in objects:
        transform=obj.matrix_world.copy(); obj.parent=root; obj.matrix_world=transform
    return root

def batch(collection):
    """Bake modifiers and merge geometry per material and animation pivot."""
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get(); buckets={}
    originals=[obj for obj in collection.objects if obj.type=='MESH']
    for obj in originals:
        evaluated=obj.evaluated_get(graph)
        data=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
        # Evaluated meshes may contain temporary material IDs. Keep references
        # to the original datablocks before clearing the evaluated mesh.
        for index in range(len(data.materials)):
            mat = obj.data.materials[index]
            v,f,c,smooth=buckets.setdefault((obj.parent,mat),([],[],[],[])); offset=len(v)
            v.extend(tuple(obj.matrix_local @ vertex.co) for vertex in data.vertices)
            attr=data.color_attributes.get('Tint')
            c.extend([tuple(a.color[:3]) for a in attr.data] if attr and attr.domain=='POINT' else [(1,1,1)]*len(data.vertices))
            f.extend(tuple(offset+i for i in p.vertices) for p in data.polygons if p.material_index==index)
            smooth.extend(p.use_smooth for p in data.polygons if p.material_index==index)
        evaluated.to_mesh_clear()
    for obj in originals: bpy.data.objects.remove(obj,do_unlink=True)
    for (root,mat),(v,f,c,smooth) in buckets.items():
        obj=mesh(f'{collection.name}_{root.name if root else "fixed"}_{mat.name}',v,f,mat,c)
        # Keep rock fractures and cut masonry crisp after material batching.
        for polygon,flag in zip(obj.data.polygons,smooth): polygon.use_smooth=flag
        if root: obj.parent=root
        obj['asset']=collection.name
