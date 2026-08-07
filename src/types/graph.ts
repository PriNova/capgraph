export const GRAPH_RELATIONS = [
  "requires",
  "verify_with",
  "recover_with",
] as const;

export type GraphRelation = (typeof GRAPH_RELATIONS)[number];
export type SkillName = string;

export interface SkillNode {
  readonly skill: SkillName;
  readonly filePath: string;
  readonly requires: readonly SkillName[];
  readonly verify_with: readonly SkillName[];
  readonly recover_with: readonly SkillName[];
}

export type SkillGraph = Readonly<Record<SkillName, SkillNode>>;

export interface InspectResult {
  readonly skill: SkillName;
  readonly requires: readonly SkillName[];
  readonly verify_with: readonly SkillName[];
  readonly recover_with: readonly SkillName[];
}

export interface ExpandedSkill {
  readonly skill: SkillName;
  readonly depth: number;
}

export interface ExpansionEdge {
  readonly from: SkillName;
  readonly to: SkillName;
  readonly relation: GraphRelation;
}

export interface ExpandResult {
  readonly root: SkillName;
  readonly skills: readonly ExpandedSkill[];
  readonly edges: readonly ExpansionEdge[];
}

export interface LoadResult {
  readonly skill: SkillName;
  readonly content: string;
}
