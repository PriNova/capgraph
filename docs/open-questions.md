# Open Questions

Record unresolved problems here instead of adding unproven architecture.

## Capability Dependency and Model Context

- **Question:** Should Capgraph distinguish capability dependencies from model-context dependencies?
- **Why it matters:** `requires` currently controls both dependency composition and Graph Batch prose loading. A capability or execution dependency is not necessarily a model-context dependency.
- **Current evidence:** V1 Graph Batch loaded the full declared `requires` prose closure. Flat sometimes omitted declared low-level prose such as `mesh-object-create` or `object-resolve` and still completed and independently verified the task. This does not establish that any current edge is incorrect.
- **Evidence needed:** Repeated controlled tasks that isolate whether omitted dependency prose changes execution, verification, or recovery outcomes.
- **Status:** Open. Do not add `context_requires`, `load_if_needed`, or another relation until evidence supports changing the relation model.

## Stable Capability Identity and Namespaces

- **Question:** Does a later ecosystem need stable, namespace-aware capability identity?
- **Why it matters:** V1 uses the Agent Skills `name` as the graph node identifier. Renaming a skill changes its identifier and can break incoming references. Cross-package names can also collide.
- **Current evidence:** Name identity was sufficient for the local V0 through V1 experiments. Stable namespace-aware capability identity, rename compatibility, and cross-package references remain outside the tested scope.
- **Evidence needed:** Real package composition and rename cases from the evolving Agent Skills/plugin ecosystem.
- **Status:** Open. Do not add UUIDs, aliases, migration machinery, or a proprietary namespace format now.

## Flat Batch Ablation

- **Question:** How much of the V1 interaction advantage remains if Flat capability selection is preserved but selected bodies can be batch-loaded?
- **Why it matters:** V1 compared Graph Batch with individual Flat reads. Much of Graph's tool-call reduction can come from batch interaction rather than graph-guided composition.
- **Evidence needed:** A frozen `Flat / Graph Batch / Flat Batch` benchmark where Flat still selects capabilities without graph structure and only its loading operation changes.
- **Status:** Deferred until publication hardening is complete. Do not implement Flat Batch in the current project stage.
