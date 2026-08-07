import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import {
  GRAPH_RELATIONS,
  type CapabilityGraph,
  type CapabilityId,
  type CapabilityNode,
  type GraphRelation,
} from "./types/graph.ts";

const CAPABILITY_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)*$/;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_FRONTMATTER_FIELDS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);
const RELATION_METADATA_KEYS = {
  requires: "capgraph-requires",
  verify_with: "capgraph-verify-with",
  recover_with: "capgraph-recover-with",
} as const satisfies Readonly<Record<GraphRelation, string>>;
const CAPGRAPH_METADATA_KEYS = new Set(["capgraph-id", ...Object.values(RELATION_METADATA_KEYS)]);

export interface CapabilityDefinition {
  readonly id: CapabilityId;
  readonly node: CapabilityNode;
}

export class GraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractFrontmatter(contents: string, filePath: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(contents);
  if (match?.[1] === undefined) {
    throw new GraphValidationError(`Skill "${filePath}" must contain YAML frontmatter.`);
  }

  try {
    return parseYaml(match[1]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GraphValidationError(`Skill "${filePath}" has invalid YAML: ${message}`);
  }
}

function readStringField(
  frontmatter: Readonly<Record<string, unknown>>,
  field: string,
  filePath: string,
): string {
  const value = frontmatter[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new GraphValidationError(`Skill "${filePath}" field "${field}" must be a non-empty string.`);
  }
  return value.trim();
}

function validateStandardFrontmatter(
  frontmatter: Readonly<Record<string, unknown>>,
  skillDirectoryName: string,
  filePath: string,
): { readonly name: string; readonly metadata: Readonly<Record<string, string>> } {
  for (const field of Object.keys(frontmatter)) {
    if (!ALLOWED_FRONTMATTER_FIELDS.has(field)) {
      throw new GraphValidationError(`Skill "${filePath}" contains unsupported frontmatter field "${field}".`);
    }
  }

  const name = readStringField(frontmatter, "name", filePath);
  if (name.length > 64 || !SKILL_NAME_PATTERN.test(name)) {
    throw new GraphValidationError(`Skill "${filePath}" has invalid name "${name}".`);
  }
  if (name !== skillDirectoryName) {
    throw new GraphValidationError(
      `Skill "${filePath}" name "${name}" must match directory "${skillDirectoryName}".`,
    );
  }

  const description = readStringField(frontmatter, "description", filePath);
  if (description.length > 1024) {
    throw new GraphValidationError(`Skill "${filePath}" description exceeds 1024 characters.`);
  }

  if (frontmatter.license !== undefined && typeof frontmatter.license !== "string") {
    throw new GraphValidationError(`Skill "${filePath}" field "license" must be a string.`);
  }
  if (frontmatter.compatibility !== undefined) {
    const compatibility = readStringField(frontmatter, "compatibility", filePath);
    if (compatibility.length > 500) {
      throw new GraphValidationError(`Skill "${filePath}" compatibility exceeds 500 characters.`);
    }
  }
  if (frontmatter["allowed-tools"] !== undefined && typeof frontmatter["allowed-tools"] !== "string") {
    throw new GraphValidationError(`Skill "${filePath}" field "allowed-tools" must be a string.`);
  }

  const rawMetadata = frontmatter.metadata;
  if (!isRecord(rawMetadata)) {
    throw new GraphValidationError(`Skill "${filePath}" field "metadata" must be a string map.`);
  }

  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawMetadata)) {
    if (typeof value !== "string") {
      throw new GraphValidationError(
        `Skill "${filePath}" metadata value "${key}" must be a string.`,
      );
    }
    if (key.startsWith("capgraph-") && !CAPGRAPH_METADATA_KEYS.has(key)) {
      throw new GraphValidationError(`Skill "${filePath}" contains unknown graph metadata "${key}".`);
    }
    metadata[key] = value;
  }

  return { name, metadata };
}

function parseRelation(
  metadata: Readonly<Record<string, string>>,
  nodeId: CapabilityId,
  relation: GraphRelation,
  filePath: string,
): readonly CapabilityId[] {
  const key = RELATION_METADATA_KEYS[relation];
  const value = metadata[key];
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  const targets = value.trim().split(/\s+/);
  const seen = new Set<CapabilityId>();
  for (const target of targets) {
    if (!CAPABILITY_ID_PATTERN.test(target)) {
      throw new GraphValidationError(
        `Skill "${filePath}" metadata "${key}" contains invalid capability ID "${target}".`,
      );
    }
    if (target === nodeId) {
      throw new GraphValidationError(`Node "${nodeId}" field "${relation}" must not reference itself.`);
    }
    if (seen.has(target)) {
      throw new GraphValidationError(
        `Node "${nodeId}" field "${relation}" contains duplicate reference "${target}".`,
      );
    }
    seen.add(target);
  }

  return targets;
}

export function parseCapabilitySkill(
  contents: string,
  skillDirectoryName: string,
  filePath: string,
): CapabilityDefinition {
  const rawFrontmatter = extractFrontmatter(contents, filePath);
  if (!isRecord(rawFrontmatter)) {
    throw new GraphValidationError(`Skill "${filePath}" frontmatter must be a mapping.`);
  }

  const { name, metadata } = validateStandardFrontmatter(
    rawFrontmatter,
    skillDirectoryName,
    filePath,
  );
  const id = metadata["capgraph-id"];
  if (id === undefined || !CAPABILITY_ID_PATTERN.test(id)) {
    throw new GraphValidationError(`Skill "${filePath}" must define a valid metadata "capgraph-id".`);
  }

  return {
    id,
    node: {
      skill: name,
      filePath,
      requires: parseRelation(metadata, id, "requires", filePath),
      verify_with: parseRelation(metadata, id, "verify_with", filePath),
      recover_with: parseRelation(metadata, id, "recover_with", filePath),
    },
  };
}

function validateReferences(graph: CapabilityGraph): void {
  for (const [nodeId, node] of Object.entries(graph)) {
    for (const relation of GRAPH_RELATIONS) {
      for (const target of node[relation]) {
        if (graph[target] === undefined) {
          throw new GraphValidationError(
            `Node "${nodeId}" field "${relation}" references unknown node "${target}".`,
          );
        }
      }
    }
  }
}

export function validateRequiresAcyclic(
  graph: CapabilityGraph,
  rootId: CapabilityId,
): void {
  const states = new Map<CapabilityId, "visiting" | "visited">();
  const path: CapabilityId[] = [];

  function visit(nodeId: CapabilityId): void {
    const state = states.get(nodeId);
    if (state === "visited") {
      return;
    }
    if (state === "visiting") {
      const cycleStart = path.indexOf(nodeId);
      const cycle = [...path.slice(cycleStart), nodeId];
      throw new GraphValidationError(`Requires cycle detected: ${cycle.join(" -> ")}.`);
    }

    const node = graph[nodeId];
    if (node === undefined) {
      throw new GraphValidationError(`Unknown node "${nodeId}" during requires cycle validation.`);
    }

    states.set(nodeId, "visiting");
    path.push(nodeId);
    for (const target of node.requires) {
      visit(target);
    }
    path.pop();
    states.set(nodeId, "visited");
  }

  visit(rootId);
}

export function buildGraph(definitions: readonly CapabilityDefinition[]): CapabilityGraph {
  const graph: Record<CapabilityId, CapabilityNode> = {};

  for (const definition of definitions) {
    if (graph[definition.id] !== undefined) {
      throw new GraphValidationError(`Duplicate capability ID "${definition.id}".`);
    }
    graph[definition.id] = definition.node;
  }

  validateReferences(graph);
  return graph;
}

export async function loadGraph(capabilitiesDirectory: string): Promise<CapabilityGraph> {
  const entries = await readdir(capabilitiesDirectory, { withFileTypes: true });
  const skillDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const definitions = await Promise.all(
    skillDirectories.map(async (skillDirectoryName) => {
      const filePath = join(capabilitiesDirectory, skillDirectoryName, "SKILL.md");
      let contents: string;
      try {
        contents = await readFile(filePath, "utf8");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new GraphValidationError(`Cannot read capability skill "${filePath}": ${message}`);
      }
      return parseCapabilitySkill(contents, skillDirectoryName, filePath);
    }),
  );

  return buildGraph(definitions);
}
