---
name: e2e-runner
description: "End-to-end test runner for browser, mobile, API, and full workflow validation. Use when running, debugging, stabilizing, or interpreting Playwright, Cypress, Selenium, or similar E2E tests."
---

## Use this skill when

- Running or fixing end-to-end tests for user workflows
- Debugging flaky Playwright, Cypress, Selenium, Detox, or browser automation failures
- Verifying a feature through the UI, network, storage, screenshots, or trace artifacts

## Do not use this skill when

- Unit or integration tests are sufficient and no full workflow validation is needed
- The task is unrelated to end-to-end behavior

## Instructions

- Identify the app start command, test command, browser requirements, environment variables, and seeded data needs.
- Run the smallest relevant E2E test first, then expand to the affected suite.
- Capture screenshots, videos, traces, console logs, network failures, and server logs when failures are unclear.
- Distinguish product bugs from test timing, selector, fixture, data, or environment issues.
- Prefer resilient user-facing selectors and accessibility roles over brittle CSS selectors.
- Keep waits event-driven where possible; avoid arbitrary sleeps unless no deterministic signal exists.
- Reset or isolate test data so repeated runs are reliable.
- Verify fixes by re-running the failing test and any nearby workflow tests.

## Runner workflow

1. Start the required app or services.
2. Run the targeted E2E command.
3. Inspect the first failing step and supporting artifacts.
4. Fix the product bug or test instability at its source.
5. Re-run the test and report the exact verification command.
