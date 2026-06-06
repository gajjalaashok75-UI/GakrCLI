# GakrCLI Self-Improvement System Architecture

**Status**: This document describes a planned architecture for the self-improvement system. Some components may not be fully implemented yet.

## Overview

The Self-Improvement System enables GakrCLI to learn from every interaction, optimize its performance, and autonomously enhance its capabilities. This is a meta-system that observes, analyzes, recommends, and (safely) acts on its own behavior.

## Core Principles

1. **Safe by default** - All auto-improvements require explicit opt-in or must pass strict safety gates
2. **Observable** - All learning and decisions are logged and explainable
3. **User-controlled** - Users can review, approve, or reject suggested improvements
4. **Progressive** - Improvements are incremental and reversible
5. **Privacy-preserving** - No sensitive data leaves the local system without consent

## System Components

### 1. Metrics Collector

Collects runtime metrics during every session.

**Collected Metrics:**
- **Performance**: API latency, token usage per turn, tool execution time, memory heap usage
- **Quality**: Success rate, retry count, error rates by tool/model, user corrections
- **Efficiency**: Context window utilization, token waste, redundant operations
- **User Experience**: Time-to-first-token, time-to-completion, interruption frequency
- **Cost**: API spend, token efficiency (output/input ratio)

**Implementation:**
- Hook into existing telemetry (OpenTelemetry already used)
- Minimal overhead (<1% performance impact)
- Aggregated in-session and persisted for long-term analysis

### 2. Pattern Recognition Engine

Analyzes collected metrics to identify:
- **Effective tool sequences**: Which tools work well together
- **Optimal model settings**: Which models perform best for which task types
- **Prompt engineering insights**: Which system prompt variants yield better results
- **Common failure modes**: Repeated errors and their root causes
- **Resource hot spots**: Tools or operations that are slow or expensive

**Techniques:**
- Clustering for task categorization
- Correlation analysis (e.g., "when X tool is used, success rate drops 20%")
- Temporal pattern detection (e.g., "failure rate increases after 50 turns")
- Anomaly detection for unusual behavior

### 3. Recommendation System

Generates actionable improvement suggestions:

**Categories:**
- **Configuration tweaks**: "Enable fast mode for coding tasks reduces latency by 30%"
- **Tool optimizations**: "Use GrepTool before ReadTool to minimize file reads"
- **Model recommendations**: "Use Claude-3.7-Sonnet for this task type (25% faster)"
- **Prompt improvements**: "Add 'think step by step' for reasoning tasks"
- **Code quality**: "Add error handling to BashTool calls (observed 5% failure rate)"
- **Documentation updates**: "Update README with new provider setup steps"

**Delivery Mechanisms:**
- `/improve` command - shows all available suggestions
- Proactive hints during slow operations
- End-of-session summary report
- GitHub PR generation for code improvements

### 4. Diagnostic Engine

Runs health checks and identifies issues:

**Checks:**
- Configuration validity (missing API keys, deprecated settings)
- Resource usage (memory leaks, runaway processes)
- Network connectivity (high latency, timeouts)
- File system health (disk space, permission errors)
- Version staleness (outdated dependencies, unsupported models)
- Security vulnerabilities (hardcoded secrets, insecure permissions)

**Outputs:**
- `/diagnose` command with comprehensive report
- Auto-fix suggestions for non-breaking issues
- Critical alerts for security or stability problems

### 5. Feedback Processor

Incorporates explicit and implicit feedback:

**Explicit Feedback:**
- User corrections ("that was wrong")
- Thumbs up/down on responses
- Bug reports and issue descriptions

**Implicit Feedback:**
- Tool use patterns (retries, cancellations, timeouts)
- Success signals (task completion, no corrections)
- Abandonment (user interrupts, switches tasks)
- Edit patterns (user rewrites assistant output)

**Processing:**
- Sentiment analysis on user corrections
- Reinforcement learning from successful trajectories
- Negative reinforcement from failures and retractions

### 6. Knowledge Base

Persistent storage of learned patterns and improvements:

**Structure:**
```typescript
interface LearnedPattern {
  id: string
  category: 'tool_succession' | 'prompt_optimization' | 'error_reduction'
  taskType: string  // e.g., "code_review", "debugging", "refactoring"
  conditions: Condition[]
  recommendation: Recommendation
  confidence: number  // 0-1 based on evidence volume
  evidenceCount: number
  createdAt: Date
  lastValidated: Date
}
```

**Storage:**
- Local: `~/.gakrcli/learning/knowledge.json`
- Optional sync to cloud (with privacy controls)
- Versioned with schema migrations

### 7. Auto-Improvement Pipeline

For approved, low-risk improvements:

**Capabilities:**
- Dependency updates (minor version bumps)
- Configuration optimizations (enabling beneficial flags)
- Cache warm-up strategies
- Telemetry tuning
- Documentation typos and clarifications

**Safety Gates:**
- All changes require user approval (configurable auto-approve for low-risk types)
- Changes are reversible with `/undo-improve`
- Each change is tagged with learning source
- Comprehensive testing before application

## User Interaction

### `/improve` Command

Shows interactive menu:
1. View current recommendations (with confidence scores)
2. Apply selected improvements
3. Configure auto-apply rules
4. View learning history
5. Provide feedback on suggestions

### End-of-Session Report

When enabled:
```
Session Summary:
  Tasks completed: 12
  Success rate: 92% (+5% vs average)
  Tools used: Bash (8), Read (15), Edit (12)
  Cost: $0.04 (within budget)
  
Performance Insights:
  ✓ GrepTool usage decreased file reads by 23%
  ⚠ BashTool had 2 permission errors - consider adding to always-allow
  💡 Enable fast mode for similar future tasks (est. 30% faster)
  
Recent Learning:
  - Identified optimal model for Python debugging: claude-3.7-sonnet
  - Detected pattern: Grep before Read improves efficiency 23%
```

### Proactive Hints

During long-running operations:
```
[Optimization] This task reads many files. Add more directories to toolPermissionContext.alwaysAllowRules to skip prompts.
```

## Implementation Phases

### Phase 1: Foundation (Current)
- ✅ Basic metrics collection (existing telemetry)
- ✅ Performance monitoring infrastructure
- ⏳ Simple rule-based recommendations
- ⏳ Diagnostic engine prototype

### Phase 2: Learning (Next)
- Pattern recognition on tool sequences
- Task type classification
- Basic recommendation generation
- Knowledge base storage

### Phase 3: Automation (Future)
- Smart auto-apply with safety gates
- Cross-session learning
- Collaborative filtering (opt-in anonymous sharing)
- Self-healing for common misconfigurations

### Phase 4: Advanced (Optional)
- Reinforcement learning from outcomes
- Predictive prefetching based on task patterns
- Automatic prompt optimization
- Code generation for new tools/features

## Safety and Privacy

### Data Collection Boundaries
- Never collect: file contents, API responses, user code (except metadata like file size, language)
- Always anonymized: no PII in knowledge base
- Local-first: raw metrics stay on user's machine
- Opt-in sharing for collaborative improvements

### Rollback Mechanism
- All applied improvements are logged with reversal instructions
- `/undo-improve <id>` restores previous state
- Automatic rollback on threshold of failures

### Rate Limiting
- At most 1 auto-improvement per hour (configurable)
- No changes in critical sessions (first 5 minutes, or during important tasks)
- Respects user's "do not disturb" settings

## Measurement and Evaluation

**Success Metrics:**
- Improvement adoption rate (>60% of suggestions accepted)
- Performance gains (latency reduction, cost savings)
- Error rate decrease
- User satisfaction (explicit feedback)
- Knowledge base growth (patterns learned)

**A/B Testing:**
- Compare sessions with and without improvements
- Control for task difficulty and type
- Statistical significance testing (p < 0.05)

## Integration Points

**Existing Systems:**
- Telemetry (OpenTelemetry) → Metrics Collector
- Configuration (settings.js) → Recommendation storage
- Command system (`/improve`, `/diagnose`, `/undo-improve`)
- Hooks system → Diagnostic checks
- Cost tracker → Efficiency analysis

**New Dependencies:**
- Lightweight ML library (e.g., ml-js) for pattern recognition (optional)
- Statistical analysis utilities (could use simple JS)
- Knowledge base storage (JSON + migrations)

## Technical Design

### Metrics Schema

```typescript
interface Metric {
  sessionId: string
  timestamp: Date
  type: MetricType
  value: number
  tags: Record<string, string>  // task_type, tool_name, model, etc.
}

enum MetricType {
  API_LATENCY_MS = 'api_latency_ms',
  TOKEN_COUNT = 'token_count',
  TOOL_DURATION_MS = 'tool_duration_ms',
  SUCCESS = 'success',
  ERROR = 'error',
  COST_USD = 'cost_usd',
  CONTEXT_TOKENS_USED = 'context_tokens_used',
  CONTEXT_TOKENS_WASTED = 'context_tokens_wasted',
}
```

### Recommendation Schema

```typescript
interface Recommendation {
  id: string
  type: RecommendationType
  title: string
  description: string
  rationale: string[]  // evidence points
  confidence: number  // 0-1
  impact: 'high' | 'medium' | 'low'
  effort: 'zero' | 'low' | 'medium' | 'high'
  actions: RecommendationAction[]
  estimatedImprovement: {
    timeMs?: number
    costUsd?: number
    successRatePp?: number
  }
}

enum RecommendationAction {
  UPDATE_CONFIG = 'update_config',
  ENABLE_FEATURE = 'enable_feature',
  ADD_ALWAY_ALLOW_RULE = 'add_always_allow_rule',
  CHANGE_MODEL = 'change_model',
  UPDATE_PROMPT = 'update_prompt',
  INSTALL_PLUGIN = 'install_plugin',
  RUN_DIAGNOSTIC = 'run_diagnostic',
}
```

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bad recommendation degrades performance | Low | Medium | Safety gates, user approval required, easy rollback |
| Privacy leak through stored patterns | Very Low | High | Strict data minimization, local-only by default, PII scrubbing |
| Performance overhead >5% | Medium | Medium | Careful instrumentation, sampling, async processing |
| User annoyance from too many suggestions | Medium | Low | Rate limiting, configurable thresholds, feedback-driven tuning |
| Learning bias toward specific use cases | Medium | Medium | Diversified recommendation portfolio, confidence thresholds |

## Future Enhancements

- **Collaborative learning**: Opt-in sharing of anonymized patterns to benefit all users
- **Cross-project insights**: Learn from patterns across all your repositories
- **Predictive optimization**: Pre-warm caches based on task prediction
- **Self-modification**: Propose code changes to GakrCLI itself (with extreme caution!)

---

*This architecture is designed to evolve as the system learns. Expect iterative refinements based on real-world usage.*
