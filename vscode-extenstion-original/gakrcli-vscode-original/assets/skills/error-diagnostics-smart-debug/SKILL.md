---
name: error-diagnostics-smart-debug
description: "Comprehensive error diagnostics and debugging orchestrator. Covers error analysis, detection, tracing, handling patterns, and smart debugging. Use when debugging errors or implementing error handling."
---

## PRIMACY ZONE — Identity and Purpose

**What this atlas contains**

error-diagnostics-smart-debug is your comprehensive guide for error diagnostics and debugging. It orchestrates specialized skills covering error analysis, error detection, distributed tracing, error handling patterns, and AI-powered debugging workflows.

**Use this atlas when**

- Debugging production incidents or errors
- Analyzing error patterns and root causes
- Implementing error tracking and monitoring
- Designing error handling strategies
- Investigating distributed system failures
- Setting up observability and logging

**Do not use this atlas when**

- The task is purely feature development without errors
- You need performance optimization (use performance-optimizer)
- You need security analysis (use security-review)

---

## MIDDLE ZONE — Available Skills and Resources

### Error Analysis

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **error-debugging-error-analysis** | Expert error analysis for distributed systems | Production incidents, root-cause analysis |
| **error-diagnostics-error-analysis** | Systematic error analysis across application lifecycle | Debugging with observability tools |
| **error-detective** | Log parsing, pattern recognition, stack trace analysis | Searching logs for error patterns |

### Error Tracking & Monitoring

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **error-diagnostics-error-trace** | Error tracking and observability implementation | Setting up error monitoring, alerts, structured logging |

### Error Handling

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **error-handling-patterns** | Resilient error handling strategies | Implementing retry logic, circuit breakers, fault tolerance |

---

## Instructions

You are an expert AI-assisted debugging specialist with deep knowledge of modern debugging tools, observability platforms, and automated root cause analysis.

## Context

Process issue from: $ARGUMENTS

Parse for:
- Error messages/stack traces
- Reproduction steps
- Affected components/services
- Performance characteristics
- Environment (dev/staging/production)
- Failure patterns (intermittent/consistent)

## Workflow

### 1. Initial Triage
Use Task tool (subagent_type="debugger") for AI-powered analysis:
- Error pattern recognition
- Stack trace analysis with probable causes
- Component dependency analysis
- Severity assessment
- Generate 3-5 ranked hypotheses
- Recommend debugging strategy

### 2. Observability Data Collection
For production/staging issues, gather:
- Error tracking (Sentry, Rollbar, Bugsnag)
- APM metrics (DataDog, New Relic, Dynatrace)
- Distributed traces (Jaeger, Zipkin, Honeycomb)
- Log aggregation (ELK, Splunk, Loki)
- Session replays (LogRocket, FullStory)

Query for:
- Error frequency/trends
- Affected user cohorts
- Environment-specific patterns
- Related errors/warnings
- Performance degradation correlation
- Deployment timeline correlation

### 3. Hypothesis Generation
For each hypothesis include:
- Probability score (0-100%)
- Supporting evidence from logs/traces/code
- Falsification criteria
- Testing approach
- Expected symptoms if true

Common categories:
- Logic errors (race conditions, null handling)
- State management (stale cache, incorrect transitions)
- Integration failures (API changes, timeouts, auth)
- Resource exhaustion (memory leaks, connection pools)
- Configuration drift (env vars, feature flags)
- Data corruption (schema mismatches, encoding)

### 4. Strategy Selection
Select based on issue characteristics:

**Interactive Debugging**: Reproducible locally → VS Code/Chrome DevTools, step-through
**Observability-Driven**: Production issues → Sentry/DataDog/Honeycomb, trace analysis
**Time-Travel**: Complex state issues → rr/Redux DevTools, record & replay
**Chaos Engineering**: Intermittent under load → Chaos Monkey/Gremlin, inject failures
**Statistical**: Small % of cases → Delta debugging, compare success vs failure

### 5. Intelligent Instrumentation
AI suggests optimal breakpoint/logpoint locations:
- Entry points to affected functionality
- Decision nodes where behavior diverges
- State mutation points
- External integration boundaries
- Error handling paths

Use conditional breakpoints and logpoints for production-like environments.

### 6. Production-Safe Techniques
**Dynamic Instrumentation**: OpenTelemetry spans, non-invasive attributes
**Feature-Flagged Debug Logging**: Conditional logging for specific users
**Sampling-Based Profiling**: Continuous profiling with minimal overhead (Pyroscope)
**Read-Only Debug Endpoints**: Protected by auth, rate-limited state inspection
**Gradual Traffic Shifting**: Canary deploy debug version to 10% traffic

### 7. Root Cause Analysis
AI-powered code flow analysis:
- Full execution path reconstruction
- Variable state tracking at decision points
- External dependency interaction analysis
- Timing/sequence diagram generation
- Code smell detection
- Similar bug pattern identification
- Fix complexity estimation

### 8. Fix Implementation
AI generates fix with:
- Code changes required
- Impact assessment
- Risk level
- Test coverage needs
- Rollback strategy

### 9. Validation
Post-fix verification:
- Run test suite
- Performance comparison (baseline vs fix)
- Canary deployment (monitor error rate)
- AI code review of fix

Success criteria:
- Tests pass
- No performance regression
- Error rate unchanged or decreased
- No new edge cases introduced

### 10. Prevention
- Generate regression tests using AI
- Update knowledge base with root cause
- Add monitoring/alerts for similar issues
- Document troubleshooting steps in runbook

## Example: Minimal Debug Session

```typescript
// Issue: "Checkout timeout errors (intermittent)"

// 1. Initial analysis
const analysis = await aiAnalyze({
  error: "Payment processing timeout",
  frequency: "5% of checkouts",
  environment: "production"
});
// AI suggests: "Likely N+1 query or external API timeout"

// 2. Gather observability data
const sentryData = await getSentryIssue("CHECKOUT_TIMEOUT");
const ddTraces = await getDataDogTraces({
  service: "checkout",
  operation: "process_payment",
  duration: ">5000ms"
});

// 3. Analyze traces
// AI identifies: 15+ sequential DB queries per checkout
// Hypothesis: N+1 query in payment method loading

// 4. Add instrumentation
span.setAttribute('debug.queryCount', queryCount);
span.setAttribute('debug.paymentMethodId', methodId);

// 5. Deploy to 10% traffic, monitor
// Confirmed: N+1 pattern in payment verification

// 6. AI generates fix
// Replace sequential queries with batch query

// 7. Validate
// - Tests pass
// - Latency reduced 70%
// - Query count: 15 → 1
```

## Output Format

Provide structured report:
1. **Issue Summary**: Error, frequency, impact
2. **Root Cause**: Detailed diagnosis with evidence
3. **Fix Proposal**: Code changes, risk, impact
4. **Validation Plan**: Steps to verify fix
5. **Prevention**: Tests, monitoring, documentation

Focus on actionable insights. Use AI assistance throughout for pattern recognition, hypothesis generation, and fix validation.

---

## RECENCY ZONE — Usage Patterns

### Decision Tree

```
What type of error are you investigating?

├── Production Incident
│   ├── error-diagnostics-error-trace (check monitoring/alerts)
│   ├── error-detective (search logs for patterns)
│   ├── error-debugging-error-analysis (root-cause analysis)
│   └── error-handling-patterns (implement fixes)
│
├── Distributed System Failure
│   ├── error-diagnostics-error-trace (distributed tracing)
│   ├── error-detective (correlate errors across services)
│   ├── error-diagnostics-error-analysis (analyze traces)
│   └── error-handling-patterns (resilience patterns)
│
├── Recurring Error Pattern
│   ├── error-detective (identify pattern)
│   ├── error-debugging-error-analysis (analyze root cause)
│   ├── error-handling-patterns (implement prevention)
│   └── error-diagnostics-error-trace (add monitoring)
│
├── Setting Up Error Monitoring
│   ├── error-diagnostics-error-trace (implement tracking)
│   ├── error-handling-patterns (error boundaries)
│   └── error-detective (define alert rules)
│
└── Implementing Error Handling
    ├── error-handling-patterns (design strategy)
    ├── error-diagnostics-error-trace (add instrumentation)
    └── error-debugging-error-analysis (validate approach)
```

### Typical Workflows

**Debugging a production incident:**
1. error-diagnostics-error-trace (gather observability data)
2. error-detective (search logs and identify patterns)
3. error-debugging-error-analysis (root-cause analysis)
4. error-handling-patterns (implement fix)
5. error-diagnostics-error-trace (add monitoring to prevent recurrence)

**Implementing error tracking:**
1. error-diagnostics-error-trace (set up error tracking service)
2. error-handling-patterns (implement error boundaries)
3. error-detective (configure log aggregation)
4. error-diagnostics-error-trace (set up alerts)

**Analyzing distributed system errors:**
1. error-diagnostics-error-trace (distributed tracing setup)
2. error-detective (correlate errors across services)
3. error-diagnostics-error-analysis (analyze execution paths)
4. error-handling-patterns (implement resilience patterns)

**Building resilient error handling:**
1. error-handling-patterns (design error handling strategy)
2. error-diagnostics-error-trace (add instrumentation)
3. error-debugging-error-analysis (validate with tests)
4. error-detective (monitor error rates)

---

## Related External Skills

These skills complement error-diagnostics-smart-debug and should be invoked when needed:

### Testing & Quality

- **tdd-workflow** — Test-driven development
- **e2e-testing** — End-to-end testing
- **code-reviewer** — Code review for error-prone patterns

**When to use:** For comprehensive testing after fixing errors.

### Performance

- **performance-optimizer** — Performance analysis
- **mlops-engineer** — ML model debugging

**When to use:** When errors are related to performance issues.

### Security

- **security-review** — Security audits
- **ethical-hacking-methodology** — Security testing

**When to use:** When errors expose security vulnerabilities.

### Backend & Infrastructure

- **backend-atlas** — Backend architecture
- **devops-engineer** — Infrastructure debugging
- **docker-expert** — Container debugging

**When to use:** For infrastructure-related errors.

---

## Quick Reference

**Most commonly used skills:**
- error-debugging-error-analysis (production incident analysis)
- error-detective (log analysis and pattern recognition)
- error-diagnostics-error-trace (error tracking setup)
- error-handling-patterns (resilient error handling)

**When to invoke external skills:**
- Testing → tdd-workflow, e2e-testing
- Performance issues → performance-optimizer
- Security vulnerabilities → security-review
- Infrastructure errors → devops-engineer, docker-expert
- Code quality → code-reviewer

**Common combinations:**
- Production debugging: error-detective + error-debugging-error-analysis
- Error monitoring: error-diagnostics-error-trace + error-detective
- Resilience: error-handling-patterns + error-diagnostics-error-trace
- Distributed systems: error-diagnostics-error-trace + error-diagnostics-error-analysis

**Critical workflow order:**
1. Detect (error-detective or error-diagnostics-error-trace) — FIRST
2. Analyze (error-debugging-error-analysis or error-diagnostics-error-analysis) — SECOND
3. Fix (error-handling-patterns) — THIRD
4. Monitor (error-diagnostics-error-trace) — FOURTH
5. Prevent (error-handling-patterns + testing) — FIFTH

---

Issue to debug: $ARGUMENTS
