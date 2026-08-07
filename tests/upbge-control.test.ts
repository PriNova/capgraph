import assert from "node:assert/strict";
import { createServer, type Server } from "node:net";
import test from "node:test";

import {
  buildUpbgeCode,
  executeUpbgeOperation,
  sendUpbgeCode,
} from "../src/upbge-control.ts";

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    assert.fail("test server did not expose a TCP address");
  }
  return address.port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

test("builds only fixed wrappers for allowed operations", () => {
  const status = buildUpbgeCode({ operation: "status" });
  assert.match(status, /bpy\.app\.version_string/);
  assert.doesNotMatch(status, /runpy/);

  const create = buildUpbgeCode({ operation: "create_cube", objectName: "PhysicsCube" });
  assert.match(create, /object-create\/scripts\/create_cube\.py/);
  assert.match(create, /create_cube\("PhysicsCube"/);

  const rigidBody = buildUpbgeCode({ operation: "add_rigid_body", objectName: "PhysicsCube" });
  assert.match(rigidBody, /rigid-body-add\/scripts\/add_rigid_body\.py/);

  const collision = buildUpbgeCode({ operation: "add_collision", objectName: "PhysicsCube" });
  assert.match(collision, /collision-add\/scripts\/add_collision\.py/);

  const verify = buildUpbgeCode({
    operation: "verify_physics_object",
    objectName: "PhysicsCube",
  });
  assert.match(verify, /physics-object-verify\/scripts\/verify_physics_object\.py/);
  assert.throws(
    () => buildUpbgeCode({ operation: "create_cube", objectName: 'Cube"); import os' }),
    /object_name must start/,
  );
});

test("requires an object name for object operations", () => {
  assert.throws(
    () => buildUpbgeCode({ operation: "add_collision" }),
    /add_collision requires object_name/,
  );
});

test("sends and receives null-delimited bridge JSON", async () => {
  let received: unknown;
  const server = createServer((socket) => {
    let request = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      request = Buffer.concat([request, chunk]);
      const end = request.indexOf(0);
      if (end === -1) return;
      received = JSON.parse(request.subarray(0, end).toString("utf8"));
      socket.write('{"status":"ok","result":{"version":"5.3.0 Alpha"}}');
      socket.end("\0");
    });
  });
  const port = await listen(server);

  try {
    const result = await sendUpbgeCode("result = {}", { port, timeoutMs: 1_000 });
    assert.deepEqual(result, { version: "5.3.0 Alpha" });
    assert.deepEqual(received, {
      type: "execute",
      code: "result = {}",
      strict_json: true,
    });
  } finally {
    await close(server);
  }
});

test("surfaces bridge execution errors", async () => {
  const server = createServer((socket) => {
    socket.once("data", () => {
      socket.end('{"status":"error","message":"Python traceback"}\0');
    });
  });
  const port = await listen(server);

  try {
    await assert.rejects(
      executeUpbgeOperation(
        { operation: "status" },
        { port, timeoutMs: 1_000 },
      ),
      /UPBGE execution failed: Python traceback/,
    );
  } finally {
    await close(server);
  }
});
