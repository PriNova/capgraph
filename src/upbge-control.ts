import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9876;
const DEFAULT_TIMEOUT_MS = 300_000;
const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;
const OBJECT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const CAPABILITIES_DIRECTORY = fileURLToPath(new URL("../capabilities/", import.meta.url)).replaceAll(
  "\\",
  "/",
);

export const UPBGE_OPERATIONS = [
  "status",
  "create_cube",
  "add_rigid_body",
  "add_collision",
  "verify_physics_object",
] as const;

export type UpbgeOperation = (typeof UPBGE_OPERATIONS)[number];

export interface UpbgeControlInput {
  readonly operation: UpbgeOperation;
  readonly objectName?: string;
}

export interface UpbgeConnectionOptions {
  readonly host?: string;
  readonly port?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObjectName(input: UpbgeControlInput): string {
  if (input.objectName === undefined) {
    throw new Error(`UPBGE operation ${input.operation} requires object_name.`);
  }
  if (!OBJECT_NAME_PATTERN.test(input.objectName)) {
    throw new Error(
      "object_name must start with an ASCII letter and contain at most 64 letters, digits, underscores, or hyphens.",
    );
  }
  return input.objectName;
}

function pythonString(value: string): string {
  return JSON.stringify(value);
}

export function buildUpbgeCode(input: UpbgeControlInput): string {
  if (input.operation === "status") {
    return [
      "import bpy",
      "result = {",
      '    "version": bpy.app.version_string,',
      '    "scene": bpy.context.scene.name,',
      '    "online_access": bpy.app.online_access,',
      "}",
    ].join("\n");
  }

  const objectName = requireObjectName(input);
  const quotedName = pythonString(objectName);
  const lines = [
    "import bpy",
    "import runpy",
    `root = ${pythonString(CAPABILITIES_DIRECTORY)}`,
  ];

  if (input.operation === "create_cube") {
    lines.push(
      'create_cube = runpy.run_path(root + "object-create/scripts/create_cube.py")["create_cube"]',
      "scene = bpy.context.scene",
      `obj = create_cube(${quotedName}, scene=scene, collection=scene.collection)`,
      'result = {"object": obj.name, "scene": scene.name, "type": obj.type}',
    );
    return lines.join("\n");
  }

  lines.push(
    `obj = bpy.data.objects.get(${quotedName})`,
    `if obj is None: raise ValueError("object does not exist: " + ${quotedName})`,
  );

  if (input.operation === "add_rigid_body") {
    lines.push(
      'add_rigid_body = runpy.run_path(root + "rigid-body-add/scripts/add_rigid_body.py")["add_rigid_body"]',
      "add_rigid_body(obj)",
      'result = {"object": obj.name, "physics_type": obj.game.physics_type, "mass": obj.game.mass}',
    );
  } else if (input.operation === "add_collision") {
    lines.push(
      'add_collision = runpy.run_path(root + "collision-add/scripts/add_collision.py")["add_collision"]',
      "add_collision(obj)",
      'result = {"object": obj.name, "use_collision_bounds": obj.game.use_collision_bounds, "collision_bounds_type": obj.game.collision_bounds_type}',
    );
  } else {
    lines.push(
      'verify_physics_object = runpy.run_path(root + "physics-object-verify/scripts/verify_physics_object.py")["verify_physics_object"]',
      "scene = bpy.context.scene",
      'if scene.objects.get(obj.name) is not obj: raise ValueError("object is not linked to the active scene: " + obj.name)',
      'if len(obj.users_collection) == 0: raise ValueError("object is not linked to a collection: " + obj.name)',
      "result = verify_physics_object(obj, scene=scene, collection=obj.users_collection[0])",
    );
  }

  return lines.join("\n");
}

function parseResponse(payload: Buffer): unknown {
  let response: unknown;
  try {
    response = JSON.parse(payload.toString("utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`UPBGE bridge returned invalid JSON: ${message}`);
  }

  if (!isRecord(response) || (response.status !== "ok" && response.status !== "error")) {
    throw new Error("UPBGE bridge returned an invalid response envelope.");
  }
  if (response.status === "error") {
    const message = typeof response.message === "string" ? response.message : "Unknown UPBGE error";
    throw new Error(`UPBGE execution failed: ${message}`);
  }
  if (!("result" in response)) {
    throw new Error("UPBGE bridge response is missing result.");
  }
  return response.result;
}

export async function sendUpbgeCode(
  code: string,
  options: UpbgeConnectionOptions = {},
): Promise<unknown> {
  options.signal?.throwIfAborted();
  const request = Buffer.from(
    `${JSON.stringify({ type: "execute", code, strict_json: true })}\0`,
    "utf8",
  );
  if (request.byteLength > MAX_MESSAGE_BYTES) {
    throw new Error("UPBGE request exceeds the 10 MiB bridge limit.");
  }

  return new Promise((resolve, reject) => {
    const socket = createConnection({
      host: options.host ?? DEFAULT_HOST,
      port: options.port ?? DEFAULT_PORT,
    });
    const chunks: Buffer[] = [];
    let byteCount = 0;
    let settled = false;

    const cleanup = (): void => {
      options.signal?.removeEventListener("abort", abort);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      socket.destroy();
      reject(error);
    };
    const succeed = (result: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      socket.end();
      resolve(result);
    };
    const abort = (): void => fail(new Error("UPBGE request was aborted."));

    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) {
      abort();
      return;
    }
    socket.setTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    socket.on("connect", () => socket.write(request));
    socket.on("data", (chunk: Buffer) => {
      const terminator = chunk.indexOf(0);
      const content = terminator === -1 ? chunk : chunk.subarray(0, terminator);
      byteCount += content.byteLength;
      if (byteCount > MAX_MESSAGE_BYTES) {
        fail(new Error("UPBGE response exceeds the 10 MiB bridge limit."));
        return;
      }
      chunks.push(content);
      if (terminator !== -1) {
        try {
          succeed(parseResponse(Buffer.concat(chunks, byteCount)));
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
    socket.on("timeout", () => fail(new Error("Timed out waiting for the UPBGE bridge.")));
    socket.on("error", (error) => fail(new Error(`Cannot communicate with UPBGE: ${error.message}`)));
    socket.on("close", () => {
      if (!settled) fail(new Error("UPBGE bridge closed the connection before completing its response."));
    });
  });
}

export async function executeUpbgeOperation(
  input: UpbgeControlInput,
  options: UpbgeConnectionOptions = {},
): Promise<unknown> {
  return sendUpbgeCode(buildUpbgeCode(input), options);
}
