---
name: database-atlas
description: Comprehensive database orchestrator. Covers database design, architecture, optimization, migrations, and administration. Use when designing or working with databases.
---

## PRIMACY ZONE — Identity and Purpose

**What this atlas contains**

Database-atlas is your comprehensive guide for database design, architecture, and management. It orchestrates specialized skills covering data modeling, schema design, query optimization, migrations, and database administration.

**Use this atlas when**

- Designing database schemas and data models
- Optimizing database performance
- Planning database migrations
- Setting up database infrastructure
- Implementing database security
- Troubleshooting database issues

**Do not use this atlas when**

- Backend service design (use backend-atlas AFTER database design)
- Frontend data fetching (use frontend-atlas)
- Data science or analytics (use data-scientist, data-analysis)

---

## MIDDLE ZONE — Available Skills and Resources

### Architecture & Design

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **database-architect** | Database architecture, schema design, data modeling | Designing new databases, defining data architecture |
| **database-design** | Data modeling, relationships, normalization | Creating entity relationships, table structures |

### Database Management

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **database** | General database operations and queries | Day-to-day database work |
| **database-admin** | Database administration, maintenance, backups | Managing database infrastructure |

### Optimization & Performance

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **database-optimizer** | Query optimization, indexing, performance tuning | Fixing slow queries, improving performance |

### Migrations & Evolution

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **database-migration** | Schema migrations, versioning, data migrations | Evolving database schema safely |

---

## Related External Skills

These skills complement database-atlas and should be invoked when needed:

### Backend Integration (backend-atlas)

- **backend-architect** — Service design that uses the database
- **backend-patterns** — Data access patterns
- **fastapi-pro** — Python database integration

**When to use:** AFTER database design is complete. Backend depends on database schema.

### NoSQL & Specialized Databases

- **nosql-expert** — NoSQL database patterns (MongoDB, DynamoDB, etc.)
- **vector-database-engineer** — Vector databases for AI/ML (Pinecone, Qdrant, etc.)

**When to use:** For NoSQL or specialized database technologies.

### Data Engineering

- **data-engineer** — Data pipelines, ETL, data warehousing
- **data-analysis** — Data analysis and querying

**When to use:** For data engineering and analytics workflows.

### ORM & Data Access

- **python-atlas** — SQLAlchemy, Prisma patterns
- **nodejs-backend-patterns** — TypeORM, Prisma patterns

**When to use:** For ORM-specific implementation.

### Cloud Databases

- **docker-expert** — Containerized databases
- **cloudflare-workers-expert** — Edge databases (D1)

**When to use:** For cloud-native database deployment.

### Security

- **security-review** — Database security audits
- **backend-security-coder** — Secure data access patterns

**When to use:** For database security implementation.

---

## RECENCY ZONE — Usage Patterns

### Decision Tree

```
What are you working on?

├── New application database design
│   ├── Step 1: database-architect (overall architecture)
│   ├── Step 2: database-design (detailed schema)
│   └── Step 3: backend-atlas (service layer on top)
│
├── SQL database (PostgreSQL, MySQL)
│   ├── database-architect (schema design)
│   ├── database-design (tables and relationships)
│   └── database-optimizer (indexing strategy)
│
├── NoSQL database (MongoDB, DynamoDB)
│   ├── nosql-expert (data modeling)
│   └── database-architect (architecture)
│
├── Vector database (AI/ML)
│   ├── vector-database-engineer (vector DB setup)
│   └── ai-engineer (AI integration)
│
├── Database performance issues
│   ├── database-optimizer (query optimization)
│   └── database-admin (infrastructure tuning)
│
├── Schema changes / Migrations
│   ├── database-migration (migration strategy)
│   ├── database-design (schema changes)
│   └── backend-atlas (service layer updates)
│
└── Database administration
    ├── database-admin (maintenance, backups)
    └── database-optimizer (performance monitoring)
```

### Typical Workflows

**Designing a new database:**
1. database-architect (overall architecture and technology selection)
2. database-design (detailed schema, tables, relationships)
3. database-optimizer (indexing strategy)
4. database-migration (initial migration setup)
5. backend-atlas (build services on top of database)

**Optimizing database performance:**
1. database-optimizer (identify slow queries)
2. database-design (review schema design)
3. database-admin (infrastructure tuning)
4. backend-patterns (optimize data access patterns)

**Database migration:**
1. database-migration (migration strategy)
2. database-design (schema changes)
3. database-optimizer (ensure performance)
4. backend-atlas (update service layer)

**Setting up database infrastructure:**
1. database-admin (infrastructure setup)
2. database-architect (architecture decisions)
3. docker-expert (containerization if needed)
4. security-review (security configuration)

---

## Critical Workflow Rules

**ALWAYS follow this order:**

1. **Database design FIRST** (database-atlas)
   - Design schema before backend services
   - Define data model before API contracts
   - Plan relationships before implementation

2. **Backend services SECOND** (backend-atlas)
   - Backend depends on database schema
   - API design follows data model
   - Service boundaries align with data boundaries

3. **Frontend LAST** (frontend-atlas)
   - UI consumes backend APIs
   - Frontend doesn't directly access database
   - Data fetching follows API contracts

**Never:**
- Design backend before database schema
- Let frontend directly access database
- Skip migration strategy for schema changes
- Ignore indexing and performance from the start

---

## Database Technology Selection

### SQL Databases

| Database | Best For | Use Skill |
|----------|----------|-----------|
| **PostgreSQL** | General purpose, complex queries, JSON | database-architect + database-design |
| **MySQL** | Web applications, read-heavy workloads | database-architect + database-design |
| **SQLite** | Embedded, local-first, mobile apps | database-design |

### NoSQL Databases

| Database | Best For | Use Skill |
|----------|----------|-----------|
| **MongoDB** | Document storage, flexible schema | nosql-expert |
| **DynamoDB** | Serverless, high scale, AWS | nosql-expert |
| **Redis** | Caching, sessions, real-time | nosql-expert |

### Specialized Databases

| Database | Best For | Use Skill |
|----------|----------|-----------|
| **Pinecone** | Vector search, AI/ML | vector-database-engineer |
| **Qdrant** | Vector search, self-hosted | vector-database-engineer |
| **Elasticsearch** | Full-text search, logs | data-engineer |

---

## Quick Reference

**Most commonly used skills:**
- database-architect (overall database architecture)
- database-design (schema and data modeling)
- database-optimizer (performance tuning)
- database-migration (schema evolution)

**Critical external dependencies:**
- backend-atlas (MUST use AFTER database design)
- nosql-expert (for NoSQL databases)
- vector-database-engineer (for vector databases)
- data-engineer (for data pipelines)

**When to invoke external skills:**
- Backend services → backend-atlas (AFTER database design)
- NoSQL → nosql-expert
- Vector databases → vector-database-engineer
- Data pipelines → data-engineer
- ORM implementation → python-atlas, nodejs-backend-patterns
- Security → security-review, backend-security-coder
- Cloud deployment → docker-expert

**Common combinations:**
- PostgreSQL + Python: database-design + python-atlas (SQLAlchemy)
- PostgreSQL + Node.js: database-design + nodejs-backend-patterns (Prisma)
- MongoDB: nosql-expert + backend-atlas
- Vector DB + AI: vector-database-engineer + ai-engineer

**Remember:** Database-atlas focuses on data layer design. ALWAYS design the database FIRST, then build backend services on top. Backend-atlas depends on database-atlas.
