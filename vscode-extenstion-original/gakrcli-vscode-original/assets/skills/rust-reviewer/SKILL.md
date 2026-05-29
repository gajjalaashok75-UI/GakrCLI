---
name: rust-reviewer
description: "Rust code review specialist for safety, correctness, ownership, lifetimes, async behavior, performance, crates, tests, and production reliability. Use when reviewing Rust libraries, CLIs, services, or systems code."
---

## Use this skill when

- Reviewing Rust code, Cargo projects, crates, CLIs, services, or systems code
- Checking ownership, borrowing, lifetimes, error handling, concurrency, async behavior, and performance
- Evaluating unsafe code, FFI, serialization, persistence, or protocol implementations

## Do not use this skill when

- The task is unrelated to Rust
- The user wants implementation only and did not request review feedback

## Instructions

- Inspect the changed code, public API, callers, tests, feature flags, and Cargo configuration.
- Prioritize memory safety, correctness, panics, data corruption, race conditions, security, and compatibility before style.
- Check `unwrap`, `expect`, indexing, integer overflow, blocking calls in async contexts, cancellation behavior, and error propagation.
- Review ownership and lifetime choices for unnecessary clones, hidden allocations, borrow complexity, and API ergonomics.
- For unsafe code, verify invariants are documented, minimal, locally auditable, and covered by tests where practical.
- For async code, inspect `Send` bounds, task lifetimes, cancellation, backpressure, timeouts, and executor assumptions.
- Check dependency features, semver impact, MSRV assumptions, workspace configuration, and build reproducibility.
- Recommend targeted tests, including property tests or fuzzing when input space or parser behavior warrants it.

## Response approach

1. Lead with correctness and safety findings.
2. Include file and line references when available.
3. Explain the failing scenario or violated invariant.
4. Suggest a concrete fix and verification command.
5. Separate performance improvements from correctness blockers.
