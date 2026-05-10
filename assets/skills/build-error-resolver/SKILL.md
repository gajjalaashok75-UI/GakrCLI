---
name: build-error-resolver
description: "Build failure resolver for compile errors, bundler failures, dependency conflicts, CI build breaks, missing tooling, and environment mismatches. Use when a project fails to build or package."
---

## Use this skill when

- A build, compile, bundle, package, or CI build step fails
- Errors involve missing dependencies, incompatible versions, bad config, generated files, or environment assumptions
- The user wants the build fixed and verified

## Do not use this skill when

- The issue is a runtime bug unrelated to building
- The task is only code review or documentation

## Instructions

- Capture the exact command, working directory, environment, and first meaningful error.
- Prefer fixing the root cause over masking warnings or weakening checks.
- Inspect project manifests, lockfiles, build scripts, tool versions, config files, and recent changes.
- Check for platform-specific paths, case sensitivity, generated artifacts, stale caches, missing env vars, and dependency version conflicts.
- Keep lockfile changes only when dependency resolution truly requires them.
- Avoid deleting caches or generated files unless necessary and explain why.
- Re-run the smallest failing build command after each fix, then run the broader build if practical.
- Record any environment assumptions that could affect CI or another developer machine.

## Resolution workflow

1. Reproduce the failure with the user-provided or project-standard build command.
2. Identify the earliest causal error, not the longest stack trace.
3. Inspect the owning config or source file.
4. Apply the smallest fix that preserves project intent.
5. Verify with the relevant build command and note remaining risk.
