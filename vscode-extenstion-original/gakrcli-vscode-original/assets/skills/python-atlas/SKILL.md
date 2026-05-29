---
name: python-atlas
description: Comprehensive Python development orchestrator. Covers Python patterns, FastAPI, testing, performance, packaging, and Python best practices. Use when building Python applications.
---

## PRIMACY ZONE — Identity and Purpose

**What this atlas contains**

Python-atlas is your comprehensive guide for Python development. It orchestrates specialized skills covering Python patterns, FastAPI development, testing strategies, performance optimization, and packaging.

**Use this atlas when**

- Building Python applications or services
- Implementing Python APIs with FastAPI
- Optimizing Python performance
- Writing Python tests
- Packaging Python projects
- Following Python best practices

**Do not use this atlas when**

- General backend architecture (use backend-atlas first)
- Database design (use database-atlas first)
- Frontend development (use frontend-atlas)
- Data science workflows (use data-scientist, ml-engineer)

---

## MIDDLE ZONE — Available Skills and Resources

### Core Python Development

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **python-patterns** | Python idioms, PEP 8, type hints, best practices | Writing idiomatic Python code |
| **python-pro** | Advanced Python patterns and techniques | Complex Python implementations |

### FastAPI Development

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **python-fastapi-development** | FastAPI patterns, async, Pydantic | Building Python APIs with FastAPI |

### Testing

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **python-testing** | Testing strategies, pytest, fixtures | Writing Python tests |
| **python-testing-patterns** | Advanced testing patterns | Complex testing scenarios |

### Performance

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **python-performance-optimization** | Performance tuning, profiling, optimization | Optimizing slow Python code |

### Packaging

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **python-packaging** | Package structure, pyproject.toml, distribution | Creating Python packages |

---

## Related External Skills

These skills complement python-atlas and should be invoked when needed:

### Backend Architecture (backend-atlas)

- **backend-architect** — Service architecture and API design
- **backend-patterns** — Backend design patterns
- **backend-security-coder** — Backend security
- **fastapi-pro** — FastAPI-specific patterns

**When to use:** For backend architecture decisions before Python implementation.

### Database Integration (database-atlas)

- **database-architect** — Database design
- **database-design** — Schema design
- **database-optimizer** — Query optimization

**When to use:** For database design and integration with Python services.

### API Development (API-Atlas)

- **api-design-principles** — API design patterns
- **api-patterns** — Common API patterns
- **api-documentation** — API documentation

**When to use:** For API-specific design and documentation.

### Data Science & ML

- **data-scientist** — Data science workflows
- **ml-engineer** — Machine learning engineering
- **mlops-engineer** — MLOps and model deployment
- **data-engineer** — Data pipelines

**When to use:** For data science and ML projects.

### AI Integration

- **ai-engineer** — LLM integration, RAG systems
- **langchain-architecture** — LangChain patterns
- **langgraph** — Agent workflows

**When to use:** For AI-powered Python applications.

### Testing & Quality

- **tdd-workflow** — Test-driven development
- **code-reviewer** — Code review
- **debugger** — Debugging strategies

**When to use:** For testing and quality assurance.

### Deployment

- **docker-expert** — Containerization
- **cloudflare-workers-expert** — Edge deployment

**When to use:** For deployment and infrastructure.

---

## RECENCY ZONE — Usage Patterns

### Decision Tree

```
What are you building?

├── FastAPI service
│   ├── backend-architect (service design)
│   ├── database-atlas (database design)
│   ├── python-fastapi-development (FastAPI implementation)
│   ├── python-patterns (Python best practices)
│   └── python-testing (testing strategy)
│
├── Python package/library
│   ├── python-patterns (code structure)
│   ├── python-packaging (package setup)
│   ├── python-testing (test suite)
│   └── python-pro (advanced patterns)
│
├── Data science project
│   ├── data-scientist (analysis workflow)
│   ├── python-patterns (code quality)
│   └── python-testing (testing)
│
├── ML service
│   ├── ml-engineer (model serving)
│   ├── python-fastapi-development (API)
│   ├── python-performance-optimization (optimization)
│   └── mlops-engineer (deployment)
│
├── Python performance optimization
│   ├── python-performance-optimization (profiling)
│   ├── python-patterns (efficient patterns)
│   └── database-optimizer (if database-related)
│
└── Legacy Python modernization
    ├── python-patterns (modern patterns)
    ├── python-testing (add tests)
    └── python-packaging (modernize structure)
```

### Typical Workflows

**Building a FastAPI service:**
1. backend-architect (service architecture)
2. database-atlas (database design)
3. python-fastapi-development (FastAPI setup and patterns)
4. python-patterns (Python best practices)
5. python-testing (test suite)
6. backend-security-coder (security review)

**Creating a Python package:**
1. python-packaging (package structure)
2. python-patterns (code implementation)
3. python-testing (test suite)
4. python-pro (advanced features)
5. code-reviewer (code review)

**Optimizing Python performance:**
1. python-performance-optimization (identify bottlenecks)
2. python-patterns (efficient patterns)
3. database-optimizer (if database queries)
4. python-testing (performance tests)

**Building ML API:**
1. ml-engineer (model serving strategy)
2. python-fastapi-development (API implementation)
3. python-performance-optimization (optimization)
4. python-testing (testing)
5. mlops-engineer (deployment)

---

## Python Framework Selection

### Web Frameworks

| Framework | Best For | Use Skill |
|-----------|----------|-----------|
| **FastAPI** | APIs, microservices, async | python-fastapi-development |
| **Django** | Full-stack, CMS, admin | backend-patterns |
| **Flask** | Simple apps, learning | python-patterns |

### Async vs Sync

| Use Case | Recommendation | Skills |
|----------|----------------|--------|
| **I/O-bound** (APIs, databases) | FastAPI (async) | python-fastapi-development |
| **CPU-bound** (computation) | Sync + multiprocessing | python-performance-optimization |
| **Mixed** | FastAPI with sync endpoints | python-fastapi-development + python-patterns |

---

## Python Version Guidance

### Python 3.12+ (Recommended)

- **python-patterns** — Modern type hints, match statements
- **python-performance-optimization** — Latest performance features

### Python 3.9-3.11

- **python-patterns** — Type hints, dataclasses
- **python-fastapi-development** — FastAPI compatibility

### Python 3.8 and earlier

- **python-patterns** — Migration to modern Python
- Consider upgrading to 3.12+

---

## Quick Reference

**Most commonly used skills:**
- python-patterns (Python best practices and idioms)
- python-fastapi-development (FastAPI development)
- python-testing (testing strategies)
- python-performance-optimization (performance tuning)

**When to invoke external skills:**
- Backend architecture → backend-atlas (BEFORE Python implementation)
- Database design → database-atlas (BEFORE Python implementation)
- API design → API-Atlas
- Data science → data-scientist, ml-engineer
- AI features → ai-engineer, langchain-architecture
- Testing → tdd-workflow, code-reviewer
- Deployment → docker-expert

**Common combinations:**
- FastAPI + PostgreSQL: python-fastapi-development + database-atlas
- Python package: python-packaging + python-patterns + python-testing
- ML API: ml-engineer + python-fastapi-development + mlops-engineer
- Data pipeline: data-engineer + python-patterns + python-testing

**Critical workflow order:**
1. Backend architecture (backend-atlas)
2. Database design (database-atlas)
3. Python implementation (python-atlas)
4. Testing (python-testing)
5. Deployment (docker-expert)

**Remember:** Python-atlas focuses on Python-specific implementation. Always design architecture and database first, then implement with Python. For backend architecture, use backend-atlas. For database design, use database-atlas.
