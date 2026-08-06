import { readFile } from "node:fs/promises";

import {
  GRAPH_RELATIONS,
  type CapabilityGraph,
  type CapabilityId,
  type CapabilityNode,
  type GraphRelation,
} from "./types/graph.ts";

const CAPABILITY_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)*$/;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NODE_FIELDS = new Set<string>(["skill", ...GRAPH_RELATIONS]);

export class GraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function parseRelation(
  rawNode: Readonly<Record<string, unknown>>,
  nodeId: CapabilityId,
  relation: GraphRelation,
): readonly CapabilityId[] {
  const value = rawNode[relation];
  if (value === undefined) {
    return [];
  }
  if (!isUnknownArray(value)) {
    throw new GraphValidationError(`Node "${nodeId}" field "${relation}" must be an array.`);
  }

  const targets: CapabilityId[] = [];
  const seen = new Set<CapabilityId>();
  for (const target of value) {
    if (typeof target !== "string" || !CAPABILITY_ID_PATTERN.test(target)) {
      throw new GraphValidationError(
        `Node "${nodeId}" field "${relation}" contains an invalid capability ID.`,
      );
    }
    if (target === nodeId) {
      throw new GraphValidationError(
        `Node "${nodeId}" field "${relation}" must not reference itself.`,
      );
    }
    if (seen.has(target)) {
      throw new GraphValidationError(
        `Node "${nodeId}" field "${relation}" contains duplicate reference "${target}".`,
      );
    }
    seen.add(target);
    targets.push(target);
  }

  return targets;
}

function parseNode(nodeId: CapabilityId, value: unknown): CapabilityNode {
  if (!isRecord(value)) {
    throw new GraphValidationError(`Node "${nodeId}" must be an object.`);
  }

  for (const field of Object.keys(value)) {
    if (!NODE_FIELDS.has(field)) {
      throw new GraphValidationError(`Node "${nodeId}" contains unknown field "${field}".`);
    }
  }

  const skill = value.skill;
  if (typeof skill !== "string" || skill.length > 64 || !SKILL_NAME_PATTERN.test(skill)) {
    throw new GraphValidationError(`Node "${nodeId}" has invalid skill name.`);
  }

  return {
    skill,
    requires: parseRelation(value, nodeId, "requires"),
    verify_with: parseRelation(value, nodeId, "verify_with"),
    recover_with: parseRelation(value, nodeId, "recover_with"),
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

function validateAcyclic(graph: CapabilityGraph): void {
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
      throw new GraphValidationError(`Cycle detected: ${cycle.join(" -> ")}.`);
    }

    states.set(nodeId, "visiting");
    path.push(nodeId);

    const node = graph[nodeId];
    if (node === undefined) {
      throw new GraphValidationError(`Unknown node "${nodeId}" during cycle validation.`);
    }
    for (const relation of GRAPH_RELATIONS) {
      for (const target of node[relation]) {
        visit(target);
      }
    }

    path.pop();
    states.set(nodeId, "visited");
  }

  for (const nodeId of Object.keys(graph)) {
    visit(nodeId);
  }
}

export function parseGraph(value: unknown): CapabilityGraph {
  if (!isRecord(value)) {
    throw new GraphValidationError("Graph root must be an object.");
  }

  const graph: Record<CapabilityId, CapabilityNode> = {};
  const skillOwners = new Map<string, CapabilityId>();

  for (const [nodeId, rawNode] of Object.entries(value)) {
    if (!CAPABILITY_ID_PATTERN.test(nodeId)) {
      throw new GraphValidationError(`Invalid capability ID "${nodeId}".`);
    }

    const node = parseNode(nodeId, rawNode);
    const owner = skillOwners.get(node.skill);
    if (owner !== undefined) {
      throw new GraphValidationError(
        `Skill "${node.skill}" is assigned to both "${owner}" and "${nodeId}".`,
      );
    }

    skillOwners.set(node.skill, nodeId);
    graph[nodeId] = node;
  }

  validateReferences(graph);
  validateAcyclic(graph);
  return graph;
}

export async function loadGraph(filePath: string): Promise<CapabilityGraph> {
  const contents = await readFile(filePath, "utf8");

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GraphValidationError(`Invalid JSON in "${filePath}": ${message}`);
  }

  return parseGraph(value);
}
