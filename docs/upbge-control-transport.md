# UPBGE Control Transport

## Status

This document records the control-transport research for Capgraph.

Current conclusion:

> Use the official Blender Lab MCP add-on as a TCP bridge to the running UPBGE editor. Capgraph does not need an MCP client or the separate MCP server process.

This approach is not yet fully validated. The official add-on has not yet been installed in UPBGE or tested through TCP. UPBGE support is not officially documented by Blender.

## Required Add-on

Install this add-on:

- **Name:** MCP
- **Publisher:** Blender Lab / Blender Authors
- **Version evaluated:** 1.0.0
- **Official project:** <https://projects.blender.org/lab/blender_mcp>
- **Official information:** <https://www.blender.org/lab/mcp-server/>
- **Official add-on download:** <https://projects.blender.org/lab/blender_mcp/releases/download/v1.0.0/mcp-1.0.0.zip>

Do not install the unrelated third-party `ahujasid/blender-mcp` add-on for this experiment. Do not install `blender-remote` unless a later comparison explicitly requires it.

The official manifest requires Blender 5.1 or newer and requests network permission for a local TCP server. The installed UPBGE build is based on Blender 5.3.0 Alpha.

## Installation in UPBGE

1. Download `mcp-1.0.0.zip` from the official link above.
2. Open UPBGE.
3. Open **Edit → Preferences**.
4. Open **Add-ons** or **Extensions**.
5. Select **Install from Disk**.
6. Select `mcp-1.0.0.zip` without extracting it.
7. Enable the add-on named **MCP**.
8. Allow its declared network permission.
9. Ensure Blender/UPBGE online access is enabled in system preferences. The add-on refuses to start when `bpy.app.online_access` is false.
10. Keep the configured host as `localhost` and the port as `9876`.
11. Enable **Auto Start**, or start the bridge from the add-on preferences.
12. Confirm that the preferences report **Server is running**.

Do not bind the bridge to `0.0.0.0` or a LAN address for this experiment.

## Architecture

The complete official architecture is:

```text
MCP client
    ↓ MCP over stdio or HTTP
official blender-mcp process
    ↓ TCP with null-delimited JSON
official Blender MCP add-on
    ↓ Python exec in Blender
bpy
```

Capgraph can bypass the MCP-specific layers:

```text
Pi Capgraph extension
    ↓ direct TCP with null-delimited JSON
official Blender MCP add-on running in UPBGE
    ↓ controlled Python code
Capgraph capability scripts
    ↓
bpy and UPBGE Object.game settings
```

Pi does not support MCP. This is not a blocker because the add-on's TCP protocol is small and independent of MCP.

## Add-on TCP Protocol

Default endpoint:

```text
localhost:9876
```

Each connection sends one UTF-8 JSON request followed by a null byte (`\0`).

Request:

```json
{
  "type": "execute",
  "code": "import bpy\nresult = {'version': bpy.app.version_string}",
  "strict_json": true
}
```

The add-on accepts only the `execute` request type. All official MCP tools ultimately generate Python code and send this request.

Successful response:

```json
{
  "status": "ok",
  "result": {
    "version": "5.3.0 Alpha"
  }
}
```

Error response:

```json
{
  "status": "error",
  "message": "Python traceback"
}
```

Responses are also UTF-8 JSON followed by `\0`. They may include captured `stdout` and `stderr` fields.

Protocol limits and behavior:

- Maximum request size: 10 MiB.
- Incomplete client timeout: 10 seconds.
- The official Python client uses a 300-second response timeout.
- Interactive execution is polled on Blender's main thread through `bpy.app.timers`.
- Interactive mode supports deferred completion through a global `check_is_finished` callable.
- Background mode rejects deferred completion.

## Direct Client Options

### TypeScript

The Capgraph pi extension can implement the protocol with Node's built-in `node:net` module. No MCP or third-party networking dependency is required.

### Python

The official MCP package contains `blmcp.tools_helpers.connection.send_code()`. It is only a small socket client. Capgraph can reproduce the protocol without installing the complete MCP package.

The official add-on does not expose an external command-line client for individual requests. Its `blender_mcp` CLI command starts the bridge in Blender background mode:

```text
blender --background file.blend --command blender_mcp
```

The separate `blender-mcp` executable is an MCP server with stdio and HTTP transports. Capgraph does not need it.

## Capability Script Execution

The TCP request contains Python code, not a script-path operation. Capgraph should send controlled wrapper code that loads only known capability scripts.

Example:

```python
import runpy

create_cube = runpy.run_path(
    "C:/CodeProjects/capgraph/capabilities/object-create/scripts/create_cube.py"
)["create_cube"]

obj = create_cube("PhysicsCube")
result = {"object": obj.name}
```

The model should not generate arbitrary transmitted code. A Capgraph tool should map validated structured operations to fixed wrapper templates.

Initial operations:

```text
status
create_cube
add_rigid_body
add_collision
verify_physics_object
```

The object must be resolved between requests by a stable validated object name because Python object references cannot cross TCP requests.

## UPBGE Compatibility

Official Blender documentation does not claim UPBGE support. Compatibility must therefore be treated as experimentally verified, not assumed.

The installed development build is:

```text
UPBGE with Blender 5.3.0 Alpha
Build hash: 9a92b08bb47b
```

Checks already completed in the UPBGE executable:

```text
bpy.app.timers: available
bpy.app.online_access: available
bpy.utils.register_cli_command: available
Object instance .game: available
Object.game type: GameObjectSettings
Object.game.physics_type: available
```

These checks cover the main APIs used by the official add-on and the first Capgraph workflow. The existing Capgraph scripts have also completed a real headless UPBGE editor test successfully.

Still unverified:

- installing and enabling the official add-on in UPBGE;
- starting its interactive TCP server;
- sending a direct request from outside UPBGE;
- executing Capgraph scripts through that request;
- receiving verifier results through TCP;
- screenshots and other optional official MCP tool code.

## Editor and Runtime API Boundary

UPBGE exposes two relevant API families.

### Editor state

Use `bpy` and UPBGE additions such as:

```python
obj.game.physics_type = "RIGID_BODY"
obj.game.use_collision_bounds = True
obj.game.collision_bounds_type = "BOX"
```

The official add-on runs in the editor and should support this API because transmitted code executes inside UPBGE's Python environment.

### Running game state

Use `bge` while the game engine is running:

```python
import bge
scene = bge.logic.getCurrentScene()
```

A test in the normal UPBGE editor process produced:

```text
ModuleNotFoundError: No module named 'bge'
```

The official editor bridge does not by itself solve control of a running game. Runtime `bge` control is deferred. The first Capgraph vertical slice requires only editor-time `bpy` and `Object.game` configuration.

## Security

The bridge provides arbitrary Python execution with the current user's permissions. The official project explicitly warns that its sandbox is weak.

Required controls for Capgraph:

- Bind only to `localhost`.
- Do not expose the port to the LAN.
- Do not send model-authored arbitrary Python.
- Accept only known operation names and validated parameters.
- Resolve scripts only inside the Capgraph package root.
- Return only JSON-compatible results.
- Reject unknown object names and escaping paths.
- Use clean test scenes until the execution path is trusted.
- Save important work before enabling agent control.

The official protocol has no authentication token. Any local process that can connect to port 9876 can request Python execution while the bridge is running.

## Next Validation

Run one narrow compatibility test:

1. Install the official MCP 1.0.0 add-on in UPBGE.
2. Start its bridge on `localhost:9876`.
3. Send a direct TCP `execute` request without running the MCP server.
4. Read `bpy.app.version_string` and one existing object's `game.physics_type`.
5. Create a cube through `create_cube.py`.
6. Apply `add_rigid_body.py` and `add_collision.py`.
7. Run `verify_physics_object.py`.
8. Confirm that the returned JSON contains `{"ok": true, "failures": []}`.

Only after this succeeds should Capgraph add a persistent TypeScript control tool.

## Sources

- Official project: <https://projects.blender.org/lab/blender_mcp>
- Official installation page: <https://www.blender.org/lab/mcp-server/>
- Add-on server implementation: <https://projects.blender.org/lab/blender_mcp/src/branch/main/addon/blender_mcp_addon/mcp_to_blender_server.py>
- Official socket client: <https://projects.blender.org/lab/blender_mcp/src/branch/main/mcp/blmcp/tools_helpers/connection.py>
- Execute-code tool: <https://projects.blender.org/lab/blender_mcp/src/branch/main/mcp/blmcp/tools/execute_blender_code.py>
- Add-on manifest: <https://projects.blender.org/lab/blender_mcp/src/branch/main/addon/blender_mcp_addon/blender_manifest.toml>
- UPBGE Python API: <https://upbge.org/docs/latest/api/index.html>
