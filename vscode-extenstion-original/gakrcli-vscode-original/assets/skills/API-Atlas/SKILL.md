---
name: API-Atlas
description: Comprehensive API development orchestrator. Covers API design, documentation, security, patterns, and endpoint building. Use when designing or building APIs.
---

## PRIMACY ZONE — Identity and Purpose

**What this atlas contains**

API-Atlas is your comprehensive guide for API development. It orchestrates specialized skills covering API design principles, documentation, security testing, common patterns, and endpoint implementation.

**Use this atlas when**

- Designing RESTful, GraphQL, or gRPC APIs
- Documenting APIs with OpenAPI/Swagger
- Building API endpoints
- Implementing API security
- Testing API security
- Solving common API problems

**Do not use this atlas when**

- Backend service architecture (use backend-atlas first)
- Database design (use database-atlas first)
- Frontend API consumption (use frontend-atlas)

---

## MIDDLE ZONE — Available Skills and Resources

### API Design

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **api-design-principles** | RESTful, GraphQL, gRPC design principles | Designing new APIs, API architecture |
| **api-patterns** | Common API patterns and solutions | Solving API design problems |

### API Implementation

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **api-endpoint-builder** | Building API endpoints | Implementing API routes and handlers |

### API Documentation

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **api-documentation** | OpenAPI/Swagger, API docs | Documenting APIs |
| **api-documenter** | API documentation generation | Generating API documentation |

### API Security

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **api-security-testing** | API security testing, penetration testing | Testing API security |

---

## Related External Skills

These skills complement API-Atlas and should be invoked when needed:

### Backend Architecture (backend-atlas)

- **backend-architect** — Service architecture, API contracts
- **backend-patterns** — Backend design patterns
- **backend-security-coder** — Backend security implementation

**When to use:** For overall backend architecture before API design.

### Database Layer (database-atlas)

- **database-architect** — Database design
- **database-design** — Data modeling
- **database-optimizer** — Query optimization

**When to use:** Database design informs API design. Use BEFORE API design.

### Framework-Specific Implementation

- **fastapi-pro** — FastAPI API patterns
- **python-fastapi-development** — Python FastAPI development
- **nodejs-backend-patterns** — Node.js API patterns

**When to use:** For framework-specific API implementation.

### Authentication & Authorization

- **auth-implementation-patterns** — Auth strategies
- **backend-security-coder** — Secure implementation

**When to use:** For API authentication and authorization.

### Testing

- **tdd-workflow** — Test-driven API development
- **e2e-testing** — End-to-end API testing
- **code-reviewer** — API code review

**When to use:** For API testing strategies.

### Security

- **security-review** — Security audits
- **ethical-hacking-methodology** — Security testing

**When to use:** For comprehensive security review.

---

## RECENCY ZONE — Usage Patterns

### Decision Tree

```
What type of API are you building?

├── RESTful API
│   ├── database-atlas (data model FIRST)
│   ├── backend-architect (service design)
│   ├── api-design-principles (REST design)
│   ├── api-endpoint-builder (implementation)
│   ├── api-documentation (OpenAPI docs)
│   └── api-security-testing (security)
│
├── GraphQL API
│   ├── database-atlas (data model FIRST)
│   ├── backend-architect (service design)
│   ├── api-design-principles (GraphQL schema)
│   ├── api-endpoint-builder (resolvers)
│   ├── api-documentation (schema docs)
│   └── api-security-testing (security)
│
├── gRPC API
│   ├── database-atlas (data model FIRST)
│   ├── backend-architect (service design)
│   ├── api-design-principles (protobuf design)
│   ├── api-endpoint-builder (service implementation)
│   └── api-security-testing (security)
│
├── API documentation
│   ├── api-documentation (documentation strategy)
│   └── api-documenter (generate docs)
│
└── API security testing
    ├── api-security-testing (security tests)
    ├── security-review (audit)
    └── ethical-hacking-methodology (penetration testing)
```

### Typical Workflows

**Building a new RESTful API:**
1. database-atlas (design data model FIRST)
2. backend-architect (service architecture and API contracts)
3. api-design-principles (REST API design)
4. api-patterns (apply common patterns)
5. api-endpoint-builder (implement endpoints)
6. api-documentation (OpenAPI documentation)
7. api-security-testing (security testing)

**Building a GraphQL API:**
1. database-atlas (design data model FIRST)
2. backend-architect (service architecture)
3. api-design-principles (GraphQL schema design)
4. api-endpoint-builder (implement resolvers)
5. api-documentation (schema documentation)
6. api-security-testing (security testing)

**Documenting an existing API:**
1. api-documentation (documentation strategy)
2. api-documenter (generate OpenAPI spec)
3. api-design-principles (review API design)
4. api-patterns (identify patterns)

**API security review:**
1. api-security-testing (automated security tests)
2. security-review (manual security audit)
3. ethical-hacking-methodology (penetration testing)
4. backend-security-coder (fix vulnerabilities)

---

## API Design Patterns

### RESTful API

| Pattern | Use Skill |
|---------|-----------|
| Resource modeling | api-design-principles |
| HTTP methods | api-design-principles |
| Status codes | api-design-principles |
| Versioning | api-patterns |
| Pagination | api-patterns |
| Filtering | api-patterns |
| Authentication | auth-implementation-patterns |

### GraphQL API

| Pattern | Use Skill |
|---------|-----------|
| Schema design | api-design-principles |
| Resolvers | api-endpoint-builder |
| Mutations | api-endpoint-builder |
| Subscriptions | api-patterns |
| DataLoader | api-patterns |
| Authentication | auth-implementation-patterns |

### gRPC API

| Pattern | Use Skill |
|---------|-----------|
| Protocol Buffers | api-design-principles |
| Service definition | api-design-principles |
| Streaming | api-patterns |
| Error handling | api-patterns |
| Authentication | auth-implementation-patterns |

---

## API Documentation Standards

### OpenAPI/Swagger

- **api-documentation** — OpenAPI specification
- **api-documenter** — Generate Swagger UI
- **api-design-principles** — API design best practices

### GraphQL

- **api-documentation** — GraphQL schema documentation
- **api-design-principles** — Schema design
- **api-endpoint-builder** — Resolver documentation

### gRPC

- **api-documentation** — Protocol Buffer documentation
- **api-design-principles** — Service documentation

---

## API Security Checklist

Use these skills for comprehensive API security:

1. **api-security-testing** — Automated security tests
2. **auth-implementation-patterns** — Authentication/authorization
3. **backend-security-coder** — Secure coding practices
4. **security-review** — Manual security audit
5. **ethical-hacking-methodology** — Penetration testing

**Common security concerns:**
- Authentication and authorization
- Input validation
- Rate limiting
- CORS configuration
- SQL injection prevention
- XSS prevention
- CSRF protection
- API key management
- Token security

---

## Quick Reference

**Most commonly used skills:**
- api-design-principles (API design and architecture)
- api-endpoint-builder (endpoint implementation)
- api-documentation (API documentation)
- api-security-testing (security testing)

**Critical external dependencies:**
- database-atlas (MUST use FIRST for data model)
- backend-atlas (for service architecture)
- auth-implementation-patterns (for authentication)

**When to invoke external skills:**
- Database design → database-atlas (ALWAYS FIRST)
- Backend architecture → backend-atlas (BEFORE API design)
- Python implementation → python-atlas, fastapi-pro
- Node.js implementation → nodejs-backend-patterns
- Authentication → auth-implementation-patterns
- Security → security-review, ethical-hacking-methodology
- Testing → tdd-workflow, e2e-testing

**Common combinations:**
- REST + Python: api-design-principles + fastapi-pro
- REST + Node.js: api-design-principles + nodejs-backend-patterns
- GraphQL + Python: api-design-principles + python-fastapi-development
- gRPC + Go: api-design-principles + backend-patterns

**Critical workflow order:**
1. Database design (database-atlas) — FIRST
2. Backend architecture (backend-atlas) — SECOND
3. API design (API-Atlas) — THIRD
4. Implementation (framework-specific) — FOURTH
5. Documentation (api-documentation) — FIFTH
6. Security testing (api-security-testing) — SIXTH

**Remember:** API-Atlas focuses on API-specific design and patterns. Always design database and backend architecture first, then design APIs. Database schema informs API design.
