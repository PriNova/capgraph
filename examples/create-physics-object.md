# Create Physics Object Workflow

## Purpose

Validate the first Skill Graph workflow through pi without installing the package or connecting UPBGE.

## Task

```text
Create a physics-enabled cube in UPBGE.
```

Known root skill:

```text
physics-object-create
```

## Expected Inspection

The `skill_graph` tool must return these direct relations:

```text
physics-object-create
├─ requires → object-create
├─ requires → rigid-body-add
├─ requires → collision-add
└─ verify_with → physics-object-verify
```

## Expected Expansion

Dependency-first skill order:

1. `object-create`, depth 1
2. `rigid-body-add`, depth 1
3. `collision-add`, depth 1
4. `physics-object-create`, depth 0
5. `physics-object-verify`, depth 1

The expansion must contain six explicit edges. Each skill body must exclude YAML frontmatter.

## Automated Validation

Run:

```bash
npm run test:workflow
```

The test uses pi's public SDK to load the extension path declared by the package manifest. It creates an in-memory session, registers only extension tools, and calls `inspect` and `expand` directly. It does not use a model, access the network, persist a session, install the package, or run UPBGE.

## Deferred UPBGE Validation

A later execution test must verify that:

- the cube exists and is linked to the expected scene,
- rigid-body simulation is configured,
- collision is configured,
- the object transform and physics properties are valid.

This workflow currently validates capability selection and pi integration only.
