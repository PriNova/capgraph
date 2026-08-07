import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getExtensionPath(packageManifest: unknown, projectRoot: string): string {
  assert.ok(isRecord(packageManifest));
  assert.ok(isRecord(packageManifest.pi));
  assert.deepEqual(packageManifest.pi.extensions, ["./extensions/skill-graph.ts"]);

  const extensions = packageManifest.pi.extensions;
  assert.ok(Array.isArray(extensions));
  const extensionPath = extensions[0];
  if (typeof extensionPath !== "string") {
    assert.fail("package manifest extension path must be a string");
  }
  return resolve(projectRoot, extensionPath);
}

function parseTextResult(result: {
  readonly content: readonly ({ readonly type: string; readonly text?: string })[];
}): unknown {
  const content = result.content[0];
  if (content?.type !== "text" || typeof content.text !== "string") {
    assert.fail("skill_graph must return text content");
  }
  return JSON.parse(content.text);
}

test("runs the create physics object workflow through the pi extension", async () => {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const packageContents = await readFile(resolve(projectRoot, "package.json"), "utf8");
  const extensionPath = getExtensionPath(JSON.parse(packageContents), projectRoot);
  const settingsManager = SettingsManager.inMemory();
  const resourceLoader = new DefaultResourceLoader({
    cwd: projectRoot,
    agentDir: projectRoot,
    settingsManager,
    additionalExtensionPaths: [extensionPath],
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });

  await resourceLoader.reload();
  const loadedExtensions = resourceLoader.getExtensions();
  assert.deepEqual(loadedExtensions.errors, []);

  const { session, extensionsResult } = await createAgentSession({
    cwd: projectRoot,
    resourceLoader,
    settingsManager,
    sessionManager: SessionManager.inMemory(projectRoot),
    noTools: "builtin",
  });

  try {
    assert.deepEqual(extensionsResult.errors, []);
    const skillGraph = session.agent.state.tools.find((tool) => tool.name === "skill_graph");
    assert.ok(skillGraph, "pi did not register the skill_graph tool");

    const signal = new AbortController().signal;
    const inspectResult = parseTextResult(
      await skillGraph.execute(
        "inspect-physics-object",
        { operation: "inspect", skill: "physics-object-create" },
        signal,
      ),
    );
    assert.deepEqual(inspectResult, {
      skill: "physics-object-create",
      requires: ["object-create", "rigid-body-add", "collision-add"],
      verify_with: ["physics-object-verify"],
      recover_with: [],
    });

    const expandResult = parseTextResult(
      await skillGraph.execute(
        "expand-physics-object",
        { operation: "expand", skill: "physics-object-create" },
        signal,
      ),
    );
    assert.ok(isRecord(expandResult));
    assert.equal(expandResult.root, "physics-object-create");
    assert.ok(Array.isArray(expandResult.skills));
    assert.deepEqual(
      expandResult.skills.map((skill) => {
        assert.ok(isRecord(skill));
        if (typeof skill.content !== "string") {
          assert.fail("expanded skill content must be a string");
        }
        assert.doesNotMatch(skill.content, /^---/);
        return { skill: skill.skill, depth: skill.depth };
      }),
      [
        { skill: "object-create", depth: 1 },
        { skill: "rigid-body-add", depth: 1 },
        { skill: "collision-add", depth: 1 },
        { skill: "physics-object-create", depth: 0 },
        { skill: "physics-object-verify", depth: 1 },
      ],
    );
    assert.deepEqual(expandResult.edges, [
      { from: "physics-object-create", to: "object-create", relation: "requires" },
      { from: "physics-object-create", to: "rigid-body-add", relation: "requires" },
      { from: "physics-object-create", to: "collision-add", relation: "requires" },
      {
        from: "physics-object-create",
        to: "physics-object-verify",
        relation: "verify_with",
      },
      { from: "rigid-body-add", to: "object-create", relation: "requires" },
      { from: "collision-add", to: "object-create", relation: "requires" },
    ]);
  } finally {
    session.dispose();
  }
});
