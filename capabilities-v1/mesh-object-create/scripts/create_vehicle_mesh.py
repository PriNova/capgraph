"""Create the frozen V1 vehicle chassis mesh and collection linkage."""

import bpy


def create_vehicle_mesh(name: str) -> bpy.types.Object:
    if bpy.data.objects.get(name) is not None:
        raise ValueError(f"object already exists: {name}")
    scene = bpy.context.scene
    collection = bpy.data.collections.get("CapgraphVehicleCollection")
    if collection is None:
        collection = bpy.data.collections.new("CapgraphVehicleCollection")
        scene.collection.children.link(collection)
    elif collection.name not in {child.name for child in scene.collection.children}:
        scene.collection.children.link(collection)

    mesh = bpy.data.meshes.new("CapgraphVehicleMesh")
    vertices = [(-.5,-.5,-.5),(-.5,-.5,.5),(-.5,.5,-.5),(-.5,.5,.5),(.5,-.5,-.5),(.5,-.5,.5),(.5,.5,-.5),(.5,.5,.5)]
    faces = [(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6),(0,1,3,2),(4,6,7,5)]
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = (0.0, 0.0, 1.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (2.0, 1.0, 0.5)
    return obj
