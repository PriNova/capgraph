"""Create and configure the frozen V1 third-person camera."""

import bpy


def create_vehicle_camera(target: bpy.types.Object) -> bpy.types.Object:
    if bpy.data.objects.get("CapgraphVehicleCamera") is not None:
        raise ValueError("camera already exists: CapgraphVehicleCamera")
    collection = bpy.data.collections.get("CapgraphVehicleCollection")
    if collection is None:
        raise ValueError("vehicle collection does not exist")
    data = bpy.data.cameras.new("CapgraphVehicleCameraData")
    camera = bpy.data.objects.new("CapgraphVehicleCamera", data)
    collection.objects.link(camera)
    camera.location = (target.location.x, target.location.y - 8.0, target.location.z + 4.0)
    camera["target_object"] = target.name
    camera["offset"] = [0.0, -8.0, 4.0]
    bpy.context.scene.camera = camera
    return camera
