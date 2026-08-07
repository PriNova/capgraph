import { readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";

import { parse as parseYaml } from "yaml";

import {
  GRAPH_RELATIONS,
  type ExpandResult,
  type ExpansionEdge,
  type GraphRelation,
  type InspectResult,
  type SkillGraph,
  type SkillName,
  type SkillNode,
} from "./types/graph.ts";

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
const CAPGRAPH_METADATA_KEYS: ReadonlySet<string> = new Set(Object.values(RELATION_METADATA_KEYS));

export interface GraphReadOptions {
  readonly signal?: AbortSignal;
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

function throwIfAborted(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted();
}

function assertPathInside(rootPath: string, candidatePath: string): void {
  const pathFromRoot = relative(rootPath, candidatePath);
  if (
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    throw new GraphValidationError(
      `Capability skill path "${candidatePath}" escapes capabilities directory "${rootPath}".`,
    );
  }
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
  if (rawMetadata !== undefined && !isRecord(rawMetadata)) {
    throw new GraphValidationError(`Skill "${filePath}" field "metadata" must be a string map.`);
  }

  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawMetadata ?? {})) {
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
  nodeId: SkillName,
  relation: GraphRelation,
  filePath: string,
): readonly SkillName[] {
  const key = RELATION_METADATA_KEYS[relation];
  const value = metadata[key];
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  const targets = value.trim().split(/\s+/);
  const seen = new Set<SkillName>();
  for (const target of targets) {
    if (target.length > 64 || !SKILL_NAME_PATTERN.test(target)) {
      throw new GraphValidationError(
        `Skill "${filePath}" metadata "${key}" contains invalid skill name "${target}".`,
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
): SkillNode {
  const rawFrontmatter = extractFrontmatter(contents, filePath);
  if (!isRecord(rawFrontmatter)) {
    throw new GraphValidationError(`Skill "${filePath}" frontmatter must be a mapping.`);
  }

  const { name, metadata } = validateStandardFrontmatter(
    rawFrontmatter,
    skillDirectoryName,
    filePath,
  );

  return {
    skill: name,
    filePath,
    requires: parseRelation(metadata, name, "requires", filePath),
    verify_with: parseRelation(metadata, name, "verify_with", filePath),
    recover_with: parseRelation(metadata, name, "recover_with", filePath),
  };
}

function validateReferences(graph: SkillGraph): void {
  for (const [skill, node] of Object.entries(graph)) {
    for (const relation of GRAPH_RELATIONS) {
      for (const target of node[relation]) {
        if (graph[target] === undefined) {
          throw new GraphValidationError(
            `Skill "${skill}" field "${relation}" references unknown skill "${target}".`,
          );
        }
      }
    }
  }
}

function getNode(graph: SkillGraph, skill: SkillName): SkillNode {
  const node = graph[skill];
  if (node === undefined) {
    throw new GraphValidationError(`Unknown skill "${skill}".`);
  }
  return node;
}

export function inspect(graph: SkillGraph, skill: SkillName): InspectResult {
  const node = getNode(graph, skill);
  return {
    skill: node.skill,
    requires: node.requires,
    verify_with: node.verify_with,
    recover_with: node.recover_with,
  };
}

export function validateRequiresAcyclic(
  graph: SkillGraph,
  root: SkillName,
): void {
  const states = new Map<SkillName, "visiting" | "visited">();
  const path: SkillName[] = [];

  function visit(skill: SkillName): void {
    const state = states.get(skill);
    if (state === "visited") {
      return;
    }
    if (state === "visiting") {
      const cycleStart = path.indexOf(skill);
      const cycle = [...path.slice(cycleStart), skill];
      throw new GraphValidationError(`Requires cycle detected: ${cycle.join(" -> ")}.`);
    }

    const node = getNode(graph, skill);
    states.set(skill, "visiting");
    path.push(skill);
    for (const target of node.requires) {
      visit(target);
    }
    path.pop();
    states.set(skill, "visited");
  }

  visit(root);
}

function extractSkillBody(contents: string, filePath: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(contents);
  if (match === null) {
    throw new GraphValidationError(`Skill "${filePath}" must contain YAML frontmatter.`);
  }
  return contents.slice(match[0].length).trim();
}

async function readSkillBody(
  node: SkillNode,
  options: GraphReadOptions,
): Promise<string> {
  try {
    throwIfAborted(options.signal);
    const contents = await readFile(node.filePath, {
      encoding: "utf8",
      signal: options.signal,
    });
    throwIfAborted(options.signal);
    return extractSkillBody(contents, node.filePath);
  } catch (error: unknown) {
    throwIfAborted(options.signal);
    if (error instanceof GraphValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new GraphValidationError(`Cannot read skill "${node.filePath}": ${message}`);
  }
}

export async function expand(
  graph: SkillGraph,
  root: SkillName,
  options: GraphReadOptions = {},
): Promise<ExpandResult> {
  throwIfAborted(options.signal);
  getNode(graph, root);
  validateRequiresAcyclic(graph, root);

  const dependencyClosure = new Set<SkillName>();
  const dependencyOrder: SkillName[] = [];

  function includeDependencies(skill: SkillName): void {
    if (dependencyClosure.has(skill)) {
      return;
    }

    dependencyClosure.add(skill);
    for (const dependency of getNode(graph, skill).requires) {
      includeDependencies(dependency);
    }
    dependencyOrder.push(skill);
  }

  includeDependencies(root);

  const selected = new Set(dependencyClosure);
  const terminalOrder: SkillName[] = [];
  for (const relation of ["verify_with", "recover_with"] as const) {
    for (const skill of dependencyClosure) {
      for (const terminal of getNode(graph, skill)[relation]) {
        if (!selected.has(terminal)) {
          selected.add(terminal);
          terminalOrder.push(terminal);
        }
      }
    }
  }

  const edges: ExpansionEdge[] = [];
  for (const skill of dependencyClosure) {
    for (const relation of GRAPH_RELATIONS) {
      for (const target of getNode(graph, skill)[relation]) {
        edges.push({ from: skill, to: target, relation });
      }
    }
  }

  const depths = new Map<SkillName, number>([[root, 0]]);
  const queue: SkillName[] = [root];
  for (let index = 0; index < queue.length; index += 1) {
    const skill = queue[index];
    if (skill === undefined) {
      continue;
    }
    const depth = depths.get(skill);
    if (depth === undefined) {
      continue;
    }
    for (const edge of edges) {
      if (edge.from !== skill) {
        continue;
      }
      const nextDepth = depth + 1;
      const currentDepth = depths.get(edge.to);
      if (currentDepth === undefined || nextDepth < currentDepth) {
        depths.set(edge.to, nextDepth);
        queue.push(edge.to);
      }
    }
  }

  const orderedSkills = [...dependencyOrder, ...terminalOrder];
  const skills = await Promise.all(
    orderedSkills.map(async (skill) => {
      const depth = depths.get(skill);
      if (depth === undefined) {
        throw new GraphValidationError(`Cannot determine expansion depth for skill "${skill}".`);
      }
      return {
        skill,
        depth,
        content: await readSkillBody(getNode(graph, skill), options),
      };
    }),
  );

  return { root, skills, edges };
}

export function buildGraph(nodes: readonly SkillNode[]): SkillGraph {
  const graph: Record<SkillName, SkillNode> = {};

  for (const node of nodes) {
    if (graph[node.skill] !== undefined) {
      throw new GraphValidationError(`Duplicate skill name "${node.skill}".`);
    }
    graph[node.skill] = node;
  }

  validateReferences(graph);
  return graph;
}

export async function loadGraph(
  capabilitiesDirectory: string,
  options: GraphReadOptions = {},
): Promise<SkillGraph> {
  throwIfAborted(options.signal);
  const rootPath = await realpath(capabilitiesDirectory);
  const entries = await readdir(rootPath, { withFileTypes: true });
  throwIfAborted(options.signal);
  const skillDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const definitions = await Promise.all(
    skillDirectories.map(async (skillDirectoryName) => {
      const requestedFilePath = join(rootPath, skillDirectoryName, "SKILL.md");
      let filePath: string;
      let contents: string;
      try {
        throwIfAborted(options.signal);
        filePath = await realpath(requestedFilePath);
        assertPathInside(rootPath, filePath);
        contents = await readFile(filePath, {
          encoding: "utf8",
          signal: options.signal,
        });
        throwIfAborted(options.signal);
      } catch (error: unknown) {
        throwIfAborted(options.signal);
        if (error instanceof GraphValidationError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new GraphValidationError(
          `Cannot read capability skill "${requestedFilePath}": ${message}`,
        );
      }
      return parseCapabilitySkill(contents, skillDirectoryName, filePath);
    }),
  );

  return buildGraph(definitions);
}
