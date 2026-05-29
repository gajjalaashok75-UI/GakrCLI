---
name: backend-atlas
description: Comprehensive backend development orchestrator. Covers API design, microservices, backend architecture, security, and server-side patterns. Use when building or improving backend systems.
---

## PRIMACY ZONE — Identity and Purpose

**What this atlas contains**

Backend-atlas is your comprehensive guide for server-side development, API design, and backend architecture. It orchestrates specialized skills covering system design, API patterns, security, and backend best practices.

**Use this atlas when**

- Designing or building backend services and APIs
- Implementing microservices architecture
- Setting up authentication and authorization
- Optimizing backend performance
- Implementing backend security patterns
- Defining service boundaries and contracts

**Do not use this atlas when**

- Working on frontend UI/UX (use frontend-atlas)
- Database schema design (use database-atlas, then come back)
- Pure content creation (use content-atlas)
- Data science or ML pipelines (use ml-engineer, mlops-engineer)

---

## MIDDLE ZONE — Available Skills and Resources

### Architecture & Design

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **backend-architect** | System architecture, service design, API contracts | Designing new services, defining boundaries |
| **backend-patterns** | Design patterns, architectural patterns | Solving common backend problems |
| **backend-dev-guidelines** | Coding standards, conventions, workflows | Establishing team standards, code reviews |

### Framework-Specific

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **fastapi-pro** | FastAPI patterns, async Python APIs | Building Python APIs with FastAPI |

### Security

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **backend-security-coder** | Backend security patterns, auth, encryption | Implementing secure backend code |

---

## Related External Skills

These skills complement backend-atlas and should be invoked when needed:

### API Development (API-Atlas)

- **api-design-principles** — RESTful, GraphQL, gRPC design
- **api-patterns** — Common API patterns and solutions
- **api-endpoint-builder** — Building API endpoints
- **api-documentation** — API documentation strategies
- **api-security-testing** — API security testing

**When to use:** Invoke API-Atlas for detailed API design and implementation.

### Database Layer (database-atlas)

- **database-architect** — Database schema design and architecture
- **database-design** — Data modeling and relationships
- **database-optimizer** — Query optimization and performance
- **database-migration** — Schema migrations and versioning

**When to use:** ALWAYS use database-atlas BEFORE designing backend services. Backend depends on data layer.

### Python Backend (python-atlas)

- **python-patterns** — Python idioms and best practices
- **python-fastapi-development** — FastAPI development patterns
- **python-performance-optimization** — Python performance tuning
- **python-testing** — Python testing strategies

**When to use:** For Python-specific backend development.

### Node.js Backend

- **nodejs-backend-patterns** — Node.js backend patterns
- **typescript-expert** — TypeScript for backend services

**When to use:** For Node.js/TypeScript backend development.

### Authentication & Security

- **auth-implementation-patterns** — Auth patterns and strategies
- **security-review** — Security audits and reviews
- **ethical-hacking-methodology** — Security testing approaches

**When to use:** For authentication, authorization, and security implementation.

### Cloud & Infrastructure

- **docker-expert** — Containerization and Docker
- **cloudflare-workers-expert** — Edge computing with Cloudflare
- **vercel-deployment** — Serverless deployment

**When to use:** For deployment and infrastructure concerns.

### Data & Caching

- **nosql-expert** — NoSQL database patterns
- **vector-database-engineer** — Vector databases for AI/ML

**When to use:** For specific database technology expertise.

### Testing & Quality

- **tdd-workflow** — Test-driven development
- **code-reviewer** — Code review and quality
- **debugger** — Debugging strategies

**When to use:** For testing and quality assurance.

### Data Extraction & Research

- **data-extraction** — Extract data from 47+ platforms for backend development
- **data-extraction/developer-platforms** — GitHub APIs, Stack Overflow Q&A, Hacker News
- **data-extraction/data-apis** — Weather, crypto, economic data APIs
- **data-extraction/ecommerce-shopping** — Amazon, eBay product data
- **data-extraction/academic-research** — arXiv papers, PubMed research

**When to use:**
- **API Research** — Study existing APIs (GitHub, Stack Overflow) for design patterns
- **Real Data Integration** — Integrate weather, crypto, economic data into services
- **E-commerce Backend** — Build services that aggregate product data from multiple sources
- **Research Data** — Access academic papers and research for ML/AI backends
- **Market Research** — Extract competitor data, pricing, trends

**Common workflows:**
- Research API patterns → data-extraction/developer-platforms/github
- Integrate weather data → data-extraction/data-apis/weather
- Build price aggregator → data-extraction/ecommerce-shopping
- Access research papers → data-extraction/academic-research
- Monitor crypto prices → data-extraction/data-apis (coingecko, coinmarketcap)

### AI Integration

- **ai-engineer** — LLM integration, RAG systems, AI agents
- **langchain-architecture** — LangChain patterns
- **langgraph** — Agent workflows with LangGraph

**When to use:** When integrating AI/LLM features into backend.

---

## RECENCY ZONE — Usage Patterns

### Decision Tree

```
What are you building?

├── New backend service from scratch
│   ├── Step 1: database-atlas (design data layer FIRST)
│   └── Step 2: backend-architect (design service architecture)
│
├── RESTful API
│   ├── backend-architect (service design)
│   └── API-Atlas (API-specific patterns)
│
├── GraphQL API
│   ├── backend-architect (service design)
│   └── API-Atlas (GraphQL patterns)
│
├── Microservices architecture
│   ├── backend-architect (service boundaries)
│   ├── API-Atlas (inter-service communication)
│   └── database-atlas (database per service)
│
├── Python FastAPI service
│   ├── fastapi-pro (FastAPI patterns)
│   ├── python-atlas (Python best practices)
│   └── backend-security-coder (security)
│
├── Node.js/TypeScript service
│   ├── nodejs-backend-patterns (Node.js patterns)
│   ├── typescript-expert (TypeScript)
│   └── backend-security-coder (security)
│
├── Authentication system
│   ├── auth-implementation-patterns (auth design)
│   ├── backend-security-coder (implementation)
│   └── API-Atlas (auth endpoints)
│
└── Existing service improvements
    ├── Performance → backend-patterns + database-optimizer
    ├── Security → backend-security-coder + security-review
    ├── Architecture → backend-architect
    └── Code quality → backend-dev-guidelines + code-reviewer
```

### Typical Workflows

**Building a new API service:**
1. database-atlas (design data layer FIRST)
2. backend-architect (service architecture and API contracts)
3. API-Atlas (API endpoint design)
4. fastapi-pro or nodejs-backend-patterns (implementation)
5. backend-security-coder (security review)
6. tdd-workflow (testing strategy)

**Microservices migration:**
1. backend-architect (define service boundaries)
2. database-atlas (database per service strategy)
3. API-Atlas (inter-service communication)
4. backend-patterns (resilience patterns)
5. docker-expert (containerization)

**Adding authentication:**
1. auth-implementation-patterns (auth strategy)
2. backend-security-coder (secure implementation)
3. API-Atlas (auth endpoints)
4. database-atlas (user data model)

---

## Critical Workflow Rules

**ALWAYS follow this order:**

1. **Database design FIRST** (database-atlas)
   - Backend services depend on data layer
   - Schema informs API design
   - Don't design APIs before knowing data structure

2. **Service architecture SECOND** (backend-architect)
   - Define service boundaries
   - Design API contracts
   - Plan inter-service communication

3. **Implementation THIRD** (framework-specific skills)
   - Choose framework (FastAPI, Node.js, etc.)
   - Implement with patterns
   - Add security and testing

**Never:**
- Design backend without database schema
- Skip security review
- Implement without defining API contracts
- Deploy without testing strategy

---

## Quick Reference

**Most commonly used skills:**
- backend-architect (service design and architecture)
- backend-patterns (common patterns and solutions)
- backend-security-coder (security implementation)
- fastapi-pro (Python API development)

**Critical external dependencies:**
- database-atlas (MUST use before backend design)
- API-Atlas (for API-specific patterns)
- python-atlas or nodejs-backend-patterns (language-specific)
- auth-implementation-patterns (for authentication)

**When to invoke external skills:**
- Database design → database-atlas (ALWAYS FIRST)
- API design → API-Atlas
- Python backend → python-atlas, fastapi-pro
- Node.js backend → nodejs-backend-patterns, typescript-expert
- Authentication → auth-implementation-patterns
- Security → security-review, ethical-hacking-methodology
- AI features → ai-engineer, langchain-architecture
- Deployment → docker-expert, cloudflare-workers-expert

**Remember:** Backend-atlas focuses on server-side architecture and patterns. Always design the database layer first, then build backend services on top.
