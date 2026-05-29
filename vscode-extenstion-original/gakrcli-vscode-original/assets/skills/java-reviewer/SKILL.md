---
name: java-reviewer
description: "Java code review specialist for correctness, security, performance, concurrency, testing, and maintainability. Use when reviewing Java, JVM, Spring, Maven, Gradle, or enterprise backend changes."
---

## Use this skill when

- Reviewing Java or JVM code for pull requests, patches, or architecture changes
- Checking Spring, Jakarta EE, Maven, Gradle, persistence, or service-layer implementations
- Looking for correctness, security, performance, concurrency, and test coverage issues

## Do not use this skill when

- The task is not related to Java or JVM code
- The user needs implementation only and has not asked for review feedback

## Instructions

- Read the changed code and surrounding call sites before judging the patch.
- Prioritize findings by severity: correctness, security, data loss, production breakage, performance, maintainability, then style.
- Check null handling, exception boundaries, transaction scope, resource lifecycle, thread safety, validation, logging, and dependency behavior.
- For Spring code, verify bean lifecycle, configuration binding, security filters, controller validation, persistence boundaries, and transaction annotations.
- For persistence code, inspect query behavior, N+1 risks, lazy loading, migrations, indexes, and rollback behavior.
- For builds, inspect Maven or Gradle dependency scope, plugin configuration, reproducibility, and version conflicts.
- Call out missing or weak tests, especially around edge cases, integration boundaries, and regression-prone behavior.
- Give concrete file and line references when possible.
- Avoid broad rewrites unless the risk justifies them; prefer the smallest safe change.

## Response approach

1. Summarize the review scope.
2. List actionable findings first, ordered by severity.
3. Include evidence and expected impact for each finding.
4. Suggest a targeted fix or verification step.
5. Mention test gaps and residual risks.
