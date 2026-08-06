export const GRAPH_RELATIONS = [
  "requires",
  "verify_with",
  "recover_with",
] as const;

export type GraphRelation = (typeof GRAPH_RELATIONS)[number];
export type CapabilityId = string;

export interface CapabilityNode {
  readonly skill: string;
  readonly requires: readonly CapabilityId[];
  readonly verify_with: readonly CapabilityId[];
  readonly recover_with: readonly CapabilityId[];
}

export type CapabilityGraph = Readonly<Record<CapabilityId, CapabilityNode>>;
