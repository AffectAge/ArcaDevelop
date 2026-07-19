# AGENTS.md

# ArcaDevelop Project Constitution

## Purpose

This document defines the permanent engineering principles of the ArcaDevelop repository.

It intentionally describes long-term development philosophy rather than implementation details. Gameplay mechanics, folder layouts, APIs, and technical implementations belong in project documentation, architecture documents, or nested `AGENTS.md` files.

When multiple solutions are possible, prefer the one that best follows these principles.

---

# Project Mission

ArcaDevelop is a long-term strategy game platform built with modern web technologies.

The project prioritizes:

- maintainability;
- correctness;
- deterministic behavior where applicable;
- modular architecture;
- scalability;
- data-driven design;
- production-quality code.

Every contribution should improve the project without reducing these qualities.

---

# Rule Definitions

Throughout this document:

- **MUST** / **MUST NOT** define mandatory rules.
- **SHOULD** / **SHOULD NOT** define recommended defaults.
- **MAY** defines acceptable alternatives.

When repository conventions conflict with this document, inspect the existing architecture before making changes. Prefer established repository patterns unless they violate these principles.

---

# Core Principles

## Build Systems, Not Features

Prefer reusable systems over one-off implementations.

Avoid writing code that solves only a single immediate use case when a reusable abstraction naturally exists.

---

## Simplicity Over Cleverness

Code should be easy to understand.

Prefer straightforward implementations over clever optimizations.

If two approaches are equally capable, choose the simpler one.

---

## Composition Over Duplication

Avoid duplicate logic.

Extract reusable abstractions when behavior naturally repeats.

Every responsibility should have one authoritative implementation.

---

## Explicit Over Implicit

Avoid hidden behavior.

Avoid magic values.

Avoid undocumented assumptions.

Code should communicate intent clearly.

---

## Production Quality

Write code intended for long-term maintenance.

Do not introduce:

- temporary implementations;
- prototype-only code;
- placeholder systems;
- unnecessary technical debt;
- quick hacks.

Every implementation should be suitable for production.

---

# Architecture

Architecture SHOULD encourage:

- clear module boundaries;
- separation of responsibilities;
- deterministic behavior where appropriate;
- scalability;
- testability;
- extensibility.

Business logic, presentation, rendering, networking, persistence, and tooling should remain independent whenever practical.

---

# TypeScript Standards

Use strict TypeScript.

Avoid:

- `any`
- `@ts-ignore`
- unnecessary type assertions
- implicit any

Prefer:

- explicit types
- discriminated unions
- readonly data where appropriate
- type guards
- runtime validation for external data

Type safety is part of the architecture.

---

# React Principles

Components should focus on presentation.

Business logic should remain outside UI whenever practical.

Prefer:

- reusable components;
- composition;
- custom hooks for reusable behavior;
- predictable state flow.

Avoid deeply coupled UI.

---

# Phaser Principles

Phaser is responsible for rendering, animation, camera, input, and visual presentation.

Gameplay rules should not depend on Phaser implementation details.

Rendering should consume prepared state rather than own game logic.

---

# Data-Driven Design

Game content should be data-driven whenever practical.

Avoid hardcoding content that naturally belongs in external data.

External data must be validated before use.

Invalid required data should fail explicitly rather than silently continuing.

---

# Deterministic Behavior

Whenever gameplay, networking, multiplayer, replay, AI, or simulation depends on deterministic execution:

- avoid hidden randomness;
- use stable ordering;
- avoid wall-clock time;
- ensure reproducible execution.

Presentation systems may use non-deterministic behavior when it does not affect authoritative state.

---

# Repository Hygiene

Keep the repository clean.

Remove:

- dead code;
- obsolete implementations;
- unused assets;
- unused localization;
- obsolete documentation;
- duplicate systems.

Version control preserves history.

The repository should contain only maintained implementations.

---

# Single Source of Truth

Every responsibility should have one authoritative implementation.

Avoid duplicate logic, duplicate configuration, and competing implementations.

---

# Documentation

Documentation is part of the implementation.

Important architectural decisions should be documented.

Code explains how.

Documentation explains why.

Keep documentation synchronized with implementation.

---

# Error Handling

Fail explicitly.

Never silently ignore invalid data.

Validate external input.

Provide actionable error messages whenever practical.

---

# Performance

Performance is a feature.

Optimize only after understanding the problem.

Prefer measurable improvements over speculative optimization.

Avoid unnecessary complexity introduced solely for performance.

---

# Security

Never trust external input.

Validate data at system boundaries.

Protect sensitive information.

Avoid exposing internal implementation details through public interfaces.

---

# Testing

Testing should be proportional to implementation risk.

Meaningful behavior should be verifiable.

When practical:

- update existing tests;
- add regression tests;
- validate new functionality.

Do not remove tests to hide failures.

---

# Dependencies

Introduce new dependencies only when they provide clear long-term value.

Prefer existing project infrastructure whenever practical.

Avoid unnecessary framework proliferation.

---

# Agent Workflow

Before making changes:

1. Understand the request.
2. Inspect existing architecture.
3. Reuse existing patterns.
4. Keep changes focused.
5. Avoid unrelated refactoring.
6. Update documentation when necessary.
7. Validate the result.

When uncertain:

- inspect first;
- ask if necessary;
- avoid assumptions.

---

# Definition of Done

A task is complete when:

- implementation satisfies the request;
- code remains maintainable;
- architecture remains consistent;
- validation appropriate for the change has been performed;
- documentation is updated when necessary;
- no unnecessary technical debt has been introduced.

---

# Final Principle

Leave the repository in a better state than you found it.

Every change should improve at least one of:

- correctness;
- maintainability;
- readability;
- consistency;
- scalability;
- reliability.