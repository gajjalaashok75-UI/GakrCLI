---
name: bash
description: "Comprehensive Bash scripting and Linux command orchestrator. Covers defensive patterns, Linux commands, professional scripting, and automation. Use when working with shell scripts or Linux/macOS commands."
---

## PRIMACY ZONE — Identity and Purpose

**What this atlas contains**

bash is your comprehensive guide for Bash scripting and Linux/macOS command-line operations. It orchestrates specialized skills covering defensive programming patterns, Linux command patterns, professional scripting practices, and automation workflows.

**Use this atlas when**

- Writing production-ready Bash scripts
- Executing Linux/macOS terminal commands
- Building CI/CD pipeline scripts
- Creating system administration utilities
- Automating deployment and backup tasks
- Implementing error-resilient shell scripts
- Working with file operations and text processing
- Managing processes and system resources

**Do not use this atlas when**

- You need Windows-native scripting (use PowerShell)
- The task requires POSIX-only shell without Bash features
- Complex logic better suited for higher-level languages (Python, Node.js)

---

## MIDDLE ZONE — Available Skills and Resources

### Defensive Programming

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **bash-defensive-patterns** | Production-grade defensive programming techniques | Writing robust scripts with fault tolerance and safety |

### Linux Commands & Operations

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **bash-linux** | Essential Linux/macOS terminal patterns and commands | Executing file operations, text processing, process management |

### Professional Scripting

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **bash-pro** | Master-level Bash scripting with testing and CI/CD | Production automation, comprehensive error handling, testing |

### Automation Workflows

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **bash-scripting** | Complete workflow for creating production-ready scripts | Building automation scripts from design to deployment |

---

## Instructions

- Clarify script requirements, inputs, outputs, and error scenarios.
- Apply strict mode (`set -euo pipefail`) and defensive patterns.
- Implement comprehensive error handling with traps and cleanup.
- Add structured logging with timestamps and log levels.
- Validate inputs and quote all variable expansions.
- Test scripts with ShellCheck and Bats framework.
- Document usage, options, and examples.

---

## RECENCY ZONE — Usage Patterns

### Decision Tree

```
What type of Bash task are you working on?

├── Quick Command Execution
│   ├── bash-linux (file operations, text processing)
│   └── bash-linux (process management, network commands)
│
├── Writing New Script
│   ├── bash-scripting (complete workflow)
│   ├── bash-defensive-patterns (strict mode, error handling)
│   ├── bash-pro (professional patterns)
│   └── bash-linux (command implementation)
│
├── Production Automation
│   ├── bash-pro (production-grade scripting)
│   ├── bash-defensive-patterns (safety patterns)
│   └── bash-scripting (testing and CI/CD)
│
├── CI/CD Pipeline Scripts
│   ├── bash-defensive-patterns (fault tolerance)
│   ├── bash-pro (testing with Bats)
│   └── bash-scripting (deployment automation)
│
├── System Administration
│   ├── bash-linux (system commands)
│   ├── bash-defensive-patterns (safe operations)
│   └── bash-pro (logging and monitoring)
│
└── Script Hardening/Review
    ├── bash-pro (ShellCheck, shfmt)
    ├── bash-defensive-patterns (security patterns)
    └── bash-scripting (testing)
```

### Typical Workflows

**Writing a production automation script:**
1. bash-scripting (design script structure)
2. bash-defensive-patterns (add strict mode and error handling)
3. bash-linux (implement system commands)
4. bash-pro (add logging and testing)
5. bash-scripting (CI/CD integration)

**Quick command execution:**
1. bash-linux (find appropriate command pattern)
2. bash-linux (execute with proper error handling)

**Hardening existing script:**
1. bash-pro (run ShellCheck analysis)
2. bash-defensive-patterns (add safety patterns)
3. bash-pro (add Bats tests)
4. bash-scripting (document and deploy)

**Building CI/CD pipeline:**
1. bash-scripting (design pipeline structure)
2. bash-defensive-patterns (implement fault tolerance)
3. bash-pro (add comprehensive testing)
4. bash-linux (implement deployment commands)

---

## Related External Skills

These skills complement bash and should be invoked when needed:

### System Administration

- **linux-shell-scripting** — Advanced shell scripting
- **docker-expert** — Container operations
- **devops-engineer** — Infrastructure automation

**When to use:** For infrastructure and deployment automation.

### Testing & Quality

- **tdd-workflow** — Test-driven development
- **code-reviewer** — Script review

**When to use:** For comprehensive testing and code quality.

### Error Handling

- **error-diagnostics-smart-debug** — Error analysis and debugging
- **error-handling-patterns** — Resilient error handling

**When to use:** For debugging scripts and implementing robust error handling.

### Documentation

- **documentation** — Documentation generation
- **docs-architect** — Documentation architecture

**When to use:** For comprehensive script documentation.

---

## Common Command Patterns

### File Operations

| Task | Command | Use Skill |
|------|---------|-----------|
| List files | `ls -la` | bash-linux |
| Find files | `find . -name "*.sh" -type f` | bash-linux |
| Search in files | `grep -r "pattern" --include="*.js"` | bash-linux |
| File content | `cat file.txt` | bash-linux |
| Text processing | `sed`, `awk`, `cut` | bash-linux |

### Process Management

| Task | Command | Use Skill |
|------|---------|-----------|
| List processes | `ps aux` | bash-linux |
| Kill process | `kill -9 <PID>` | bash-linux |
| Find port user | `lsof -i :3000` | bash-linux |
| Background job | `command &` | bash-linux |

### Script Patterns

| Pattern | Use Skill |
|---------|-----------|
| Strict mode | bash-defensive-patterns |
| Error traps | bash-defensive-patterns |
| Argument parsing | bash-pro |
| Logging | bash-pro |
| Testing | bash-pro |
| CI/CD integration | bash-scripting |

---

## Script Template

```bash
#!/usr/bin/env bash
set -euo pipefail  # Strict mode

readonly SCRIPT_NAME=$(basename "$0")
readonly SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

# Logging functions
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
error() { log "ERROR: $*" >&2; exit 1; }

# Cleanup trap
cleanup() {
    log "Cleaning up..."
    # Add cleanup logic
}
trap cleanup EXIT

# Usage function
usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]
Options:
    -h, --help      Show help
    -v, --verbose   Verbose output
EOF
}

# Main function
main() {
    log "Script started"
    # Implementation here
    log "Script completed"
}

main "$@"
```

---

## Quality Checklist

- [ ] ShellCheck passes with no errors
- [ ] All variables properly quoted
- [ ] Strict mode enabled (`set -euo pipefail`)
- [ ] Error handling with traps
- [ ] Cleanup handlers implemented
- [ ] Input validation added
- [ ] Logging functional
- [ ] Usage/help documentation
- [ ] Bats tests written
- [ ] CI/CD integration configured

---

## Quick Reference

**Most commonly used skills:**
- bash-linux (everyday commands and operations)
- bash-defensive-patterns (safe scripting practices)
- bash-pro (professional production scripts)
- bash-scripting (complete automation workflows)

**When to invoke external skills:**
- Error debugging → error-diagnostics-smart-debug
- Testing → tdd-workflow
- Docker operations → docker-expert
- Infrastructure → devops-engineer
- Documentation → documentation

**Common combinations:**
- Quick commands: bash-linux
- New script: bash-scripting + bash-defensive-patterns + bash-pro
- Production automation: bash-pro + bash-defensive-patterns
- CI/CD: bash-scripting + bash-pro

**Critical workflow order:**
1. Design (bash-scripting) — FIRST
2. Structure (bash-defensive-patterns) — SECOND
3. Implementation (bash-linux + bash-pro) — THIRD
4. Testing (bash-pro) — FOURTH
5. Documentation (bash-scripting) — FIFTH
6. Deployment (bash-scripting) — SIXTH

**Remember:** Always use strict mode, quote variables, handle errors with traps, and test with ShellCheck before deployment.

---

## Bash vs PowerShell Quick Reference

| Task | Bash | PowerShell |
|------|------|------------|
| List files | `ls -la` | `Get-ChildItem` |
| Find files | `find . -type f` | `Get-ChildItem -Recurse` |
| Environment | `$VAR` | `$env:VAR` |
| Pipeline | Text-based | Object-based |
| Success chain | `cmd1 && cmd2` | `cmd1; cmd2` |

---

Script requirements: $ARGUMENTS
