# AgentEval Platform — Complete Build Plan

> An independent, system-agnostic evaluation platform for AI agents and workflows.
> openJiuwen Studio is the first supported integration target.

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [What We Are Extracting (Current State)](#2-what-we-are-extracting-current-state)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Repository Structure](#5-repository-structure)
6. [Database Schema](#6-database-schema)
7. [Integration Layer — Connector System](#7-integration-layer--connector-system)
8. [Backend — API Design](#8-backend--api-design)
9. [Core Evaluation Engine (Portable)](#9-core-evaluation-engine-portable)
10. [openJiuwen Connector — Detailed Spec](#10-openjiuwen-connector--detailed-spec)
11. [Frontend — Pages & Components](#11-frontend--pages--components)
12. [Authentication & Multi-Tenancy](#12-authentication--multi-tenancy)
13. [Background Job Processing](#13-background-job-processing)
14. [Benchmark Library & Import/Export](#14-benchmark-library--importexport)
15. [Observability & Internal Logging](#15-observability--internal-logging)
16. [Deployment](#16-deployment)
17. [Security Considerations](#17-security-considerations)
18. [Build Phases & Roadmap](#18-build-phases--roadmap)
19. [Key Design Decisions & Trade-offs](#19-key-design-decisions--trade-offs)
20. [Appendix: Data Contracts](#20-appendix-data-contracts)

---

## 1. Vision & Goals

### What It Is

**AgentEval** is a standalone web application that lets teams define, run, and analyze evaluations of any AI agent or workflow system. It is completely decoupled from any specific AI platform; it connects to external systems through a pluggable **Connector** interface.

### Core Design Principles

| Principle | Description |
|---|---|
| **System-agnostic** | Works with openJiuwen, LangChain, LangGraph, custom HTTP endpoints, or any future system via connectors |
| **API-only integration** | Never imports internal code from the target system — only REST API calls |
| **Fully self-contained** | Own database, backend, frontend, queue, and config |
| **Portable evaluation engine** | Graders, metrics, and benchmark library are pure Python with zero external system dependencies |
| **Observable** | Stores every execution trace received from the target system, normalized into a common format |
| **Extensible** | New connectors, new grader types, new metric functions can be added without touching core |

### Capabilities to Preserve from openJiuwen Embedded System

Everything currently implemented must be preserved in the external platform:

- Evaluation suite CRUD (create, list, get, update, delete)
- Task CRUD with full task definition (input, expected output, graders, trials, difficulty, tags, pattern_type)
- Three grader types: DETERMINISTIC (5 check_type variants), MODEL_BASED, CODE_BASED
- Pattern validation (ROUTING, CHAINING, PARALLELIZATION, ORCHESTRATOR_WORKER, EVALUATOR_OPTIMIZER, MEMORY_USAGE, CUSTOM)
- Evaluation run lifecycle (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED)
- Sequential and parallel task execution with configurable worker count
- All aggregate metrics: pass@k, pass^k, success rate, error rate, latency percentiles, score stats, flakiness, per-grader breakdown, tokens efficiency, score distribution, custom code metrics
- Benchmark YAML import/export
- Reusable grader library
- Multi-trial execution per task

---

## 2. What We Are Extracting (Current State)

### Coupling Points in openJiuwen

The embedded evaluation system is coupled to openJiuwen in exactly **three places**:

```
evaluation_harness.py:
    from openjiuwen_studio.core.executor.workflow.workflow_runner import WorkflowRunner  # COUPLED
    from openjiuwen_studio.core.executor.agent.agent_runner import AgentRunner          # COUPLED

grader_engine.py (_run_model_based):
    from openjiuwen_studio.core.manager.model_manager.managers.model_config_manager import get_model_config_by_id  # COUPLED
    from openjiuwen.core.foundation.llm import InvokeParams, LLMMessage, LLMMessageRole, Model                     # COUPLED

pattern_validator.py:
    Component type integer constants (_COMPONENT_TYPE_IF = 4, etc.)  # openJiuwen-specific
    chunk["type"] == "tracer_workflow"                                # openJiuwen-specific chunk format
```

### What Is Already Portable (Zero Changes Needed)

- `metrics.py` — pure Python, no dependencies on openJiuwen
- `grader_engine.py` — the DETERMINISTIC and CODE_BASED graders are pure Python
- Database schema for evaluation tables
- YAML benchmark format
- All schemas in `schemas/evaluation.py`

### What Needs to be Replaced / Abstracted

| Component | Current Implementation | External Platform Implementation |
|---|---|---|
| Execution trigger | Direct call to `WorkflowRunner.run()` or `AgentRunner.run()` | HTTP call to connector's `execute()` method |
| Trace collection | Async generator streaming from internal runner | HTTP streaming response or polling from target system API |
| Model-based grader | Uses openJiuwen's internal LLM infrastructure | Uses own LLM configuration (configurable API key + model) |
| Pattern validation | Inspects openJiuwen-specific chunk types | Inspects normalized trace format (connector translates) |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AgentEval Platform                          │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────────┐ │
│  │   Frontend   │   │   Backend    │   │   Background Workers    │ │
│  │  (React/TS)  │◄──│  (FastAPI)   │◄──│    (Celery + Redis)     │ │
│  └──────────────┘   └──────┬───────┘   └─────────────────────────┘ │
│                            │                                        │
│                    ┌───────┴────────┐                               │
│                    │  Core Engine   │                               │
│                    │  - Graders     │                               │
│                    │  - Metrics     │                               │
│                    │  - Benchmarks  │                               │
│                    └───────┬────────┘                               │
│                            │                                        │
│                    ┌───────┴────────┐                               │
│                    │  Connector     │                               │
│                    │  Interface     │                               │
│                    └───────┬────────┘                               │
│                            │                                        │
│  ┌─────────────────────────┴────────────────────────────────────┐  │
│  │               Connector Implementations                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │  │
│  │  │  openJiuwen  │  │  LangChain   │  │  Generic HTTP     │  │  │
│  │  │  Connector   │  │  Connector   │  │  Connector        │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │  │
│  └─────────┼─────────────────┼───────────────────┼─────────────┘  │
│            │                 │                   │                  │
│  ┌─────────┴─────────────────┴───────────────────┴─────────────┐  │
│  │                      PostgreSQL                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │                 │                      │
         ▼                 ▼                      ▼
  openJiuwen API    LangChain Serve        Any REST endpoint
  (port 8000)         API                 with SSE/JSON
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| **Frontend** | UI for creating/managing evaluations, viewing results, charts |
| **FastAPI Backend** | REST API, auth, orchestration, delegates to core engine and connectors |
| **Core Engine** | Graders, metrics, pattern validation — pure Python, no I/O |
| **Connector Interface** | Abstract base class defining what any target system must implement |
| **Connector Implementations** | Translate AgentEval calls into target-system-specific API calls |
| **Celery Workers** | Run evaluation tasks asynchronously, persist results |
| **Redis** | Task queue, result cache, real-time status pub/sub |
| **PostgreSQL** | All persistent state: suites, tasks, runs, results, traces, connectors |

---

## 4. Technology Stack

### Backend

| Choice | Rationale |
|---|---|
| **Python 3.11+** | Same language as openJiuwen for familiarity; async support |
| **FastAPI** | Consistent with openJiuwen; excellent async, OpenAPI generation |
| **SQLAlchemy 2.x (async)** | Modern ORM, async driver support, migration via Alembic |
| **Alembic** | Schema migrations |
| **Celery 5.x** | Battle-tested distributed task queue |
| **Redis 7.x** | Queue broker for Celery; pub/sub for real-time run status |
| **Pydantic v2** | Data validation, consistent with openJiuwen |
| **httpx** | Async HTTP client for all connector calls |
| **PyYAML** | Benchmark YAML parsing |

### Frontend

| Choice | Rationale |
|---|---|
| **React 18 + TypeScript** | Modern, well-supported |
| **Vite** | Fast build, HMR |
| **Ant Design** | Consistent with openJiuwen's existing frontend style |
| **React Query (TanStack Query)** | Server state management, cache, refetch |
| **Recharts** | Charts for metrics visualization |
| **React Router v6** | Client-side routing |
| **Zustand** | Lightweight global state (auth token, active workspace) |

### Database

| Choice | Rationale |
|---|---|
| **PostgreSQL 15+** | Primary store; JSONB for flexible config/results; reliable |
| **SQLite** | Dev/test mode only (same as openJiuwen's current approach) |

### Infrastructure

| Choice | Rationale |
|---|---|
| **Docker + Docker Compose** | Local dev and production deployment |
| **Nginx** | Reverse proxy, serves frontend static files |
| **Helm chart** | Kubernetes deployment (mirrors openJiuwen's existing helm structure) |

---

## 5. Repository Structure

```
agenteval/
├── backend/
│   ├── main.py                          # FastAPI app entry point
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/                    # Migration files
│   ├── agenteval/
│   │   ├── __init__.py
│   │   ├── config.py                    # Settings (env vars via pydantic-settings)
│   │   ├── database.py                  # SQLAlchemy engine, session factory
│   │   │
│   │   ├── models/                      # SQLAlchemy ORM models
│   │   │   ├── connector.py
│   │   │   ├── evaluation.py
│   │   │   ├── task.py
│   │   │   ├── run.py
│   │   │   ├── result.py
│   │   │   ├── grader.py
│   │   │   ├── trace.py
│   │   │   └── user.py
│   │   │
│   │   ├── schemas/                     # Pydantic request/response models
│   │   │   ├── connector.py
│   │   │   ├── evaluation.py
│   │   │   ├── task.py
│   │   │   ├── run.py
│   │   │   ├── result.py
│   │   │   ├── grader.py
│   │   │   └── common.py
│   │   │
│   │   ├── api/                         # FastAPI routers
│   │   │   ├── __init__.py
│   │   │   ├── connectors.py
│   │   │   ├── evaluations.py
│   │   │   ├── tasks.py
│   │   │   ├── runs.py
│   │   │   ├── results.py
│   │   │   ├── graders.py
│   │   │   ├── benchmarks.py
│   │   │   └── auth.py
│   │   │
│   │   ├── services/                    # Business logic layer
│   │   │   ├── connector_service.py
│   │   │   ├── evaluation_service.py
│   │   │   ├── run_service.py
│   │   │   └── benchmark_service.py
│   │   │
│   │   ├── repositories/               # DB access layer
│   │   │   ├── base.py
│   │   │   ├── connector_repo.py
│   │   │   ├── evaluation_repo.py
│   │   │   ├── task_repo.py
│   │   │   ├── run_repo.py
│   │   │   ├── result_repo.py
│   │   │   ├── grader_repo.py
│   │   │   └── trace_repo.py
│   │   │
│   │   ├── engine/                      # Portable evaluation engine (no I/O)
│   │   │   ├── __init__.py
│   │   │   ├── grader_engine.py         # Ported from openJiuwen + extended
│   │   │   ├── metrics.py               # Ported from openJiuwen verbatim
│   │   │   ├── pattern_validator.py     # Rewritten to use normalized trace format
│   │   │   └── harness.py               # Rewritten — uses connector interface
│   │   │
│   │   ├── connectors/                  # Integration layer
│   │   │   ├── __init__.py
│   │   │   ├── base.py                  # Abstract BaseConnector
│   │   │   ├── registry.py              # ConnectorRegistry (discover + cache instances)
│   │   │   ├── openjiuwen/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── connector.py         # OpenJiuwenConnector implementation
│   │   │   │   ├── trace_normalizer.py  # Converts openJiuwen chunks → NormalizedTrace
│   │   │   │   └── auth.py              # API key / JWT handling for openJiuwen
│   │   │   ├── generic_http/
│   │   │   │   ├── __init__.py
│   │   │   │   └── connector.py         # GenericHTTPConnector (custom endpoints)
│   │   │   └── langchain/               # Future
│   │   │       └── connector.py
│   │   │
│   │   ├── workers/                     # Celery task definitions
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py
│   │   │   └── evaluation_worker.py
│   │   │
│   │   └── benchmarks/                  # Built-in benchmark YAML files
│   │       ├── calculator_benchmark.yaml
│   │       ├── chaining_benchmark.yaml
│   │       ├── routing_benchmark.yaml
│   │       ├── parallelization_benchmark.yaml
│   │       ├── orchestrator_worker_benchmark.yaml
│   │       ├── evaluator_optimizer_benchmark.yaml
│   │       └── memory_usage_benchmark.yaml
│
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                         # API client layer
│       │   ├── client.ts                # axios/fetch base config
│       │   ├── connectors.ts
│       │   ├── evaluations.ts
│       │   ├── tasks.ts
│       │   ├── runs.ts
│       │   ├── results.ts
│       │   └── graders.ts
│       ├── stores/
│       │   ├── auth.ts
│       │   └── workspace.ts
│       ├── pages/
│       │   ├── Login/
│       │   ├── Dashboard/
│       │   ├── Connectors/
│       │   │   ├── ConnectorListPage.tsx
│       │   │   └── ConnectorFormPage.tsx
│       │   ├── Evaluations/
│       │   │   ├── EvaluationListPage.tsx
│       │   │   ├── EvaluationDetailPage.tsx
│       │   │   └── EvaluationFormPage.tsx
│       │   ├── Tasks/
│       │   │   ├── TaskListPage.tsx
│       │   │   └── TaskFormPage.tsx
│       │   ├── Runs/
│       │   │   ├── RunListPage.tsx
│       │   │   ├── RunDetailPage.tsx
│       │   │   └── StartRunPage.tsx
│       │   ├── Results/
│       │   │   └── ResultDetailPage.tsx
│       │   ├── Benchmarks/
│       │   │   └── BenchmarkLibraryPage.tsx
│       │   └── Graders/
│       │       └── GraderLibraryPage.tsx
│       └── components/
│           ├── Layout/
│           ├── Charts/
│           │   ├── MetricsSummaryCard.tsx
│           │   ├── PassAtKChart.tsx
│           │   ├── ScoreDistributionChart.tsx
│           │   ├── LatencyChart.tsx
│           │   └── PerGraderBreakdown.tsx
│           ├── GraderEditor/
│           │   ├── DeterministicGraderForm.tsx
│           │   ├── ModelBasedGraderForm.tsx
│           │   └── CodeGraderEditor.tsx
│           └── Common/
│               ├── StatusBadge.tsx
│               └── JsonViewer.tsx
│
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
│   └── docker-compose.dev.yml
│
├── helm/
│   └── agenteval/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│
├── scripts/
│   ├── seed_benchmarks.py               # Import built-in benchmarks on first run
│   └── create_admin.py
│
└── README.md
```

---

## 6. Database Schema

All tables below are PostgreSQL. Field types use SQLAlchemy-style notation.

### 6.1 `connectors` — Target system registrations

```sql
CREATE TABLE connectors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    system_type     VARCHAR(100) NOT NULL,   -- 'openjiuwen', 'generic_http', 'langchain'
    base_url        VARCHAR(1024) NOT NULL,  -- e.g. http://openjiuwen-backend:8000
    auth_type       VARCHAR(50) NOT NULL,    -- 'bearer', 'api_key', 'basic', 'none'
    auth_config     JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "token": "...",           -- for bearer
    --   "header_name": "...",    -- for api_key
    --   "api_key": "...",
    --   "username": "...",       -- for basic
    --   "password": "..."
    -- }
    extra_config    JSONB NOT NULL DEFAULT '{}',
    -- system-specific config:
    -- openjiuwen: {"space_id": "...", "user_id": "..."}
    -- generic_http: {"execute_path": "/invoke", "result_path": "/result/{id}"}
    is_active       BOOLEAN NOT NULL DEFAULT true,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connectors_workspace ON connectors(workspace_id);
```

### 6.2 `workspaces` — Multi-tenancy unit

```sql
CREATE TABLE workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.3 `users`

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(320) UNIQUE NOT NULL,
    hashed_password VARCHAR(256) NOT NULL,
    display_name    VARCHAR(255),
    is_admin        BOOLEAN NOT NULL DEFAULT false,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.4 `evaluations` — Evaluation suites

```sql
CREATE TABLE evaluations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "imported_from": "calculator_benchmark.yaml",
    --   "custom_metrics": [ { "name": "...", "code": "..." } ],
    --   "default_connector_id": "uuid",
    --   "tags": ["regression", "nightly"]
    -- }
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_workspace ON evaluations(workspace_id);
```

### 6.5 `evaluation_tasks`

```sql
CREATE TABLE evaluation_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id   UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    task_name       VARCHAR(255) NOT NULL,
    description     TEXT,
    tags            JSONB NOT NULL DEFAULT '[]',           -- array of strings
    difficulty      SMALLINT,                              -- 0=EASY 1=MEDIUM 2=HARD
    pattern_type    SMALLINT,                              -- 0-5 or 99=CUSTOM
    input_data      JSONB NOT NULL DEFAULT '{}',
    expected_output JSONB,
    graders_config  JSONB NOT NULL DEFAULT '[]',
    -- [
    --   {
    --     "name": "check_result",
    --     "type": 0,            -- 0=DETERMINISTIC 1=MODEL_BASED 2=CODE_BASED
    --     "weight": 1.0,
    --     "config": { ... }
    --   }
    -- ]
    trials          SMALLINT NOT NULL DEFAULT 1,
    timeout_seconds INTEGER NOT NULL DEFAULT 300,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_evaluation ON evaluation_tasks(evaluation_id);
```

### 6.6 `evaluation_runs`

```sql
CREATE TABLE evaluation_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id       UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    connector_id        UUID NOT NULL REFERENCES connectors(id),

    -- Target entity on the external system
    target_type         VARCHAR(50) NOT NULL,   -- 'workflow', 'agent', 'endpoint'
    target_id           VARCHAR(255) NOT NULL,  -- ID on the external system
    target_version      VARCHAR(100),
    target_display_name VARCHAR(255),           -- human-readable name for UI

    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending', 'running', 'completed', 'failed', 'cancelled'

    run_config          JSONB NOT NULL DEFAULT '{}',
    -- { "parallel": false, "max_workers": 5, "task_ids": null }

    metrics             JSONB,                  -- computed aggregate metrics (null until completed)
    error_message       TEXT,
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_runs_evaluation ON evaluation_runs(evaluation_id);
CREATE INDEX idx_runs_status ON evaluation_runs(status);
CREATE INDEX idx_runs_connector ON evaluation_runs(connector_id);
```

### 6.7 `task_results`

```sql
CREATE TABLE task_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES evaluation_tasks(id) ON DELETE CASCADE,
    trial_number    SMALLINT NOT NULL DEFAULT 1,

    passed          BOOLEAN,
    score           DOUBLE PRECISION,
    grader_results  JSONB NOT NULL DEFAULT '[]',
    -- [
    --   {
    --     "grader_name": "...",
    --     "grader_type": 0,
    --     "passed": true,
    --     "score": 1.0,
    --     "weight": 1.0,
    --     "details": { ... }
    --   }
    -- ]

    latency_ms      INTEGER,
    token_usage     JSONB,
    -- { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 }
    error_message   TEXT,

    -- Link to the external system's execution
    external_trace_id   VARCHAR(255),      -- trace_id returned by connector
    normalized_trace    JSONB,             -- NormalizedTrace stored for debugging/regrade

    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_results_run ON task_results(run_id);
CREATE INDEX idx_results_task ON task_results(task_id);
```

### 6.8 `reusable_graders`

```sql
CREATE TABLE reusable_graders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    grader_type     SMALLINT NOT NULL,     -- 0/1/2
    config          JSONB NOT NULL DEFAULT '{}',
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.9 `llm_configs` — Models for model-based graders

```sql
CREATE TABLE llm_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    provider        VARCHAR(100) NOT NULL,  -- 'openai', 'anthropic', 'azure_openai', 'custom'
    model_name      VARCHAR(255) NOT NULL,  -- 'gpt-4o', 'claude-3-5-sonnet-20241022'
    api_key_env_var VARCHAR(255),           -- Name of env var holding the key (not the key itself)
    api_key         VARCHAR(1024),          -- Encrypted at rest (or use env var)
    base_url        VARCHAR(1024),          -- for azure/custom
    extra_params    JSONB NOT NULL DEFAULT '{}',
    -- { "temperature": 0.0, "max_tokens": 1000 }
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 7. Integration Layer — Connector System

### 7.1 BaseConnector Interface

Every connector must implement this abstract interface. The harness only ever calls these methods.

```python
# agenteval/connectors/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

@dataclass
class ExecutionResult:
    """
    Unified execution result returned by every connector.

    The connector is responsible for translating whatever the target system
    returns into this common format.
    """
    final_output: Optional[Any]              # The final output of the execution
    trace_id: Optional[str]                  # Trace ID on the external system (for linking)
    token_usage: Optional[Dict[str, int]]    # {"prompt_tokens": N, "completion_tokens": N, "total_tokens": N}
    normalized_trace: "NormalizedTrace"      # Trace in common format (for graders and pattern validation)
    raw_response: Optional[Any] = None      # Original response (for debugging)
    error: Optional[str] = None             # Set if execution failed on remote side


@dataclass
class NormalizedTrace:
    """
    System-agnostic representation of an execution trace.

    Every connector translates its system's trace format into this.
    The grader engine and pattern validator only work with NormalizedTrace.
    """
    trace_id: str
    final_output: Optional[Any]
    spans: list["NormalizedSpan"] = field(default_factory=list)
    token_usage: Optional[Dict[str, int]] = None
    raw_chunks: list = field(default_factory=list)  # Original chunks, preserved for CODE_BASED graders


@dataclass
class NormalizedSpan:
    """A single execution step/component in the trace."""
    span_id: str
    span_name: str
    span_type: str          # 'llm', 'tool', 'workflow_component', 'agent_step', etc.
    parent_span_id: Optional[str]
    start_time_ms: Optional[int]
    end_time_ms: Optional[int]
    status: str             # 'ok', 'error', 'interrupted'
    inputs: Optional[Dict]
    outputs: Optional[Dict]
    component_type: Optional[int] = None    # system-specific component type integer (for pattern validation)
    attributes: Dict[str, Any] = field(default_factory=dict)


class BaseConnector(ABC):
    """
    Abstract base class for all system connectors.

    A connector is configured at the workspace level (stored in the connectors table)
    and instantiated at runtime by the ConnectorRegistry.
    """

    def __init__(self, connector_config: Dict[str, Any]):
        """
        Args:
            connector_config: Row from the connectors table as a dict.
                              Includes base_url, auth_config, extra_config, etc.
        """
        self.config = connector_config

    @abstractmethod
    async def execute(
        self,
        target_type: str,
        target_id: str,
        target_version: Optional[str],
        inputs: Dict[str, Any],
        conversation_id: str,
        timeout_seconds: int = 300,
    ) -> ExecutionResult:
        """
        Execute a target (workflow/agent/endpoint) and return a normalized result.

        Args:
            target_type:    'workflow', 'agent', or 'endpoint'
            target_id:      ID of the target on the external system
            target_version: Version string (optional)
            inputs:         Dict of input data for this task
            conversation_id: Unique ID for this trial (prevents conflicts)
            timeout_seconds: Max execution time

        Returns:
            ExecutionResult with normalized trace and final output
        """
        ...

    @abstractmethod
    async def list_targets(self, target_type: str) -> list:
        """
        List available targets (workflows, agents) on the connected system.

        Used by the frontend to populate the target selector when starting a run.

        Returns:
            List of dicts: [{"id": "...", "name": "...", "version": "...", ...}]
        """
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Check whether the connected system is reachable and responding."""
        ...

    @property
    @abstractmethod
    def system_type(self) -> str:
        """Identifier string: 'openjiuwen', 'generic_http', 'langchain', etc."""
        ...
```

### 7.2 ConnectorRegistry

```python
# agenteval/connectors/registry.py

from typing import Dict, Type
from .base import BaseConnector

_REGISTRY: Dict[str, Type[BaseConnector]] = {}

def register_connector(system_type: str):
    """Decorator: @register_connector('openjiuwen')"""
    def decorator(cls: Type[BaseConnector]):
        _REGISTRY[system_type] = cls
        return cls
    return decorator

def get_connector(connector_row: dict) -> BaseConnector:
    """
    Instantiate the correct connector given a row from the connectors table.
    Raises ValueError if system_type is not registered.
    """
    system_type = connector_row["system_type"]
    cls = _REGISTRY.get(system_type)
    if cls is None:
        raise ValueError(f"No connector registered for system_type='{system_type}'. "
                         f"Available: {list(_REGISTRY.keys())}")
    return cls(connector_row)
```

### 7.3 Pattern Validator Contract

The pattern validator is rewritten to operate on `NormalizedTrace` instead of openJiuwen-specific chunks. The detection rules stay the same but keys are now:

```python
# Pattern detection uses NormalizedSpan fields:
# span.span_type == 'workflow_component'
# span.component_type == <integer>   (connector sets these for platforms that have them)
# span.start_time_ms / end_time_ms   (for parallelization overlap detection)

# Component type constants become connector-provided — the connector sets
# span.component_type using an integer convention documented per connector.
# For openJiuwen: same integers as before (IF=4, LOOP=5, SUB_WORKFLOW=14, etc.)
# For generic connectors: component_type can be None (pattern validation degrades gracefully)
```

---

## 8. Backend — API Design

All endpoints are prefixed with `/api/v1`. Auth via Bearer JWT token.

### 8.1 Connector Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/connectors` | Register a new connector |
| `GET` | `/connectors` | List connectors for workspace |
| `GET` | `/connectors/{id}` | Get connector details |
| `PUT` | `/connectors/{id}` | Update connector config |
| `DELETE` | `/connectors/{id}` | Remove connector |
| `POST` | `/connectors/{id}/health` | Test connectivity |
| `GET` | `/connectors/{id}/targets?type=workflow` | List available targets |

### 8.2 Evaluation Suite Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/evaluations` | Create evaluation suite |
| `GET` | `/evaluations` | List evaluations (paginated) |
| `GET` | `/evaluations/{id}` | Get evaluation details |
| `PUT` | `/evaluations/{id}` | Update evaluation |
| `DELETE` | `/evaluations/{id}` | Delete evaluation (cascades) |
| `GET` | `/evaluations/{id}/tasks` | List tasks in evaluation |
| `POST` | `/evaluations/{id}/tasks` | Add task |
| `PUT` | `/evaluations/{id}/tasks/{task_id}` | Update task |
| `DELETE` | `/evaluations/{id}/tasks/{task_id}` | Delete task |

### 8.3 Run Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/runs` | Start evaluation run (async) |
| `GET` | `/runs?evaluation_id=...` | List runs |
| `GET` | `/runs/{id}` | Get run status + metrics |
| `DELETE` | `/runs/{id}` | Delete run + results |
| `POST` | `/runs/{id}/cancel` | Cancel in-progress run |
| `GET` | `/runs/{id}/results` | Get detailed task results |
| `GET` | `/runs/{id}/results/{result_id}` | Get single task result |
| `GET` | `/runs/{id}/stream` | SSE stream of run progress events |
| `POST` | `/runs/compare` | Compare metrics across multiple runs |

### 8.4 Benchmark Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/benchmarks` | List available benchmark YAML files |
| `POST` | `/benchmarks/import` | Import benchmark YAML as new evaluation suite |
| `GET` | `/benchmarks/{name}/download` | Download benchmark YAML |
| `POST` | `/evaluations/{id}/export` | Export evaluation + tasks as YAML |

### 8.5 Grader Library Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/graders` | Create reusable grader |
| `GET` | `/graders` | List graders for workspace |
| `PUT` | `/graders/{id}` | Update grader |
| `DELETE` | `/graders/{id}` | Delete grader |

### 8.6 LLM Config Endpoints (for model-based graders)

| Method | Path | Description |
|---|---|---|
| `POST` | `/llm-configs` | Register LLM for grading |
| `GET` | `/llm-configs` | List registered LLMs |
| `DELETE` | `/llm-configs/{id}` | Remove LLM config |
| `POST` | `/llm-configs/{id}/test` | Test LLM connectivity |

### 8.7 Auth Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Username + password → JWT |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Invalidate token |
| `GET` | `/auth/me` | Current user info |

### 8.8 Run Start Request (Key Contract)

```json
POST /api/v1/runs
{
    "evaluation_id": "uuid",
    "connector_id": "uuid",
    "target_type": "workflow",
    "target_id": "workflow-id-on-external-system",
    "target_version": "published",
    "target_display_name": "My Calculator Workflow",
    "task_ids": null,
    "run_config": {
        "parallel": false,
        "max_workers": 5
    }
}
```

### 8.9 SSE Run Progress Stream

```
GET /api/v1/runs/{id}/stream
Content-Type: text/event-stream

data: {"type": "run_started", "run_id": "...", "total_tasks": 5}
data: {"type": "task_started", "task_id": "...", "task_name": "Basic addition", "trial": 1}
data: {"type": "task_completed", "task_id": "...", "trial": 1, "passed": true, "score": 1.0, "latency_ms": 834}
data: {"type": "task_failed", "task_id": "...", "trial": 1, "error": "Timeout"}
data: {"type": "run_completed", "run_id": "...", "metrics": {...}}
```

---

## 9. Core Evaluation Engine (Portable)

### 9.1 Harness — Rewritten Contract

The harness is fully rewritten to use the connector interface:

```python
# agenteval/engine/harness.py

class EvaluationHarness:
    """Orchestrates a full evaluation run using a connector."""

    def __init__(self, connector: BaseConnector, grader_engine: GraderEngine, ...):
        self._connector = connector
        self._grader = grader_engine
        self._pattern_validator = PatternValidator()

    async def execute_run(self, run: EvaluationRun, tasks: List[EvaluationTask]) -> None:
        """
        Main entry point. Called by Celery worker.
        Updates run status and persists results to the DB.
        """
        ...

    async def _execute_trial(self, task: EvaluationTask, trial_num: int) -> TaskTrialResult:
        # 1. Generate unique conversation_id
        # 2. Call connector.execute(target_type, target_id, ...)
        # 3. Get ExecutionResult with NormalizedTrace
        # 4. Run graders via GraderEngine.run_graders(graders_config, normalized_trace, expected)
        # 5. Run pattern validator if task.pattern_type is set
        # 6. Aggregate scores (weight-aware)
        # 7. Return TaskTrialResult
        ...
```

### 9.2 GraderEngine Changes

The grader engine is nearly identical to the openJiuwen version with these changes:

**DETERMINISTIC**: No changes — works on `ExecutionResult.normalized_trace.final_output`.

**MODEL_BASED**: Decoupled from openJiuwen's LLM infrastructure. Instead:
```python
async def _run_model_based(self, cfg, trace, expected, llm_config: LLMConfig) -> dict:
    """
    Uses the platform's own LLM configuration (from llm_configs table).
    Supports: openai, anthropic, azure_openai, custom (OpenAI-compatible).
    """
    # Uses httpx to call the LLM API directly, or openai/anthropic SDK
    ...
```

**CODE_BASED**: Receives `ExecutionResult` instead of the internal trace dict. The `grade(trace, expected)` function signature is preserved — `trace` is now `ExecutionResult.normalized_trace.__dict__`.

**PATTERN**: PatternValidator receives `NormalizedTrace` (see section 7.3).

### 9.3 Metrics — Zero Changes

`metrics.py` is ported **verbatim** — it is pure Python with no I/O. All functions work on the same dict structure.

---

## 10. openJiuwen Connector — Detailed Spec

This is the first connector and the most important. It must correctly bridge AgentEval to openJiuwen Studio's backend API.

### 10.1 openJiuwen APIs Used

The connector calls these openJiuwen endpoints (no code changes needed in openJiuwen):

| Operation | openJiuwen Endpoint | Notes |
|---|---|---|
| List workflows | `GET /workflow/list?spaceId=...` | Used by `list_targets('workflow')` |
| List agents | `GET /agent/list?spaceId=...` | Used by `list_targets('agent')` |
| Execute workflow | `POST /workflow/invoke/stream` | SSE streaming response |
| Execute agent | `POST /agent/invoke/stream` | SSE streaming response |
| Health check | `GET /health` or any fast endpoint | |

### 10.2 Authentication to openJiuwen

The connector's `auth_config` field stores credentials to authenticate to openJiuwen:

```json
{
    "type": "bearer",
    "token": "user-jwt-token-from-openjiuwen-login",
    "space_id": "openjiuwen-space-id"
}
```

The connector adds the header `Authorization: Bearer <token>` and `spaceId: ...` to every request.

**Important**: The token needs to be refreshed. The connector should handle 401 responses by re-authenticating using stored username/password credentials (if provided) or surfacing a clear error.

### 10.3 Workflow Execution

```python
# POST /workflow/invoke/stream
{
    "id": target_id,
    "version": target_version or "draft",
    "inputs": inputs,
    "conversation_id": conversation_id,
    "spaceId": space_id
}
```

Response: SSE stream of chunks, each being a JSON object.

The connector collects all chunks into a list and normalizes them.

### 10.4 Trace Normalization (openJiuwen → NormalizedTrace)

```python
# agenteval/connectors/openjiuwen/trace_normalizer.py

# openJiuwen chunk types and their NormalizedTrace mapping:
#
# chunk["type"] == "trace" and chunk["payload"]["status"] == "finish"
#    → final_output = chunk["payload"]["outputs"]
#
# chunk["type"] == "tracer_workflow"
#    → NormalizedSpan(
#          span_id = payload["span_id"],
#          span_name = payload["component_name"],
#          span_type = "workflow_component",
#          component_type = payload["component_type"],   ← enables pattern validation
#          start_time_ms = payload["start_time"],
#          end_time_ms = payload["end_time"],
#          inputs = payload.get("input"),
#          outputs = payload.get("output"),
#          status = "ok" if payload["status"] == "finish" else "error"
#      )
#
# chunk["type"] == "tool_call"
#    → NormalizedSpan(span_type="tool", span_name=payload["tool_name"], ...)
#
# chunk["type"] == "tool_result"
#    → Merge into the corresponding tool span
#
# chunk["type"] == "usage"
#    → token_usage = payload
```

This normalization is complete and deterministic — the same openJiuwen trace always produces the same NormalizedTrace.

### 10.5 List Targets

```python
async def list_targets(self, target_type: str) -> list:
    if target_type == "workflow":
        response = await self._http_client.get(
            f"{self.base_url}/workflow/list",
            params={"spaceId": self.space_id, "page": 1, "size": 100},
            headers=self._auth_headers()
        )
        return [
            {"id": w["id"], "name": w["name"], "version": w.get("version", "draft")}
            for w in response.json()["data"]["list"]
        ]
    elif target_type == "agent":
        # similar for agents
        ...
```

### 10.6 Extra Config for openJiuwen

The `extra_config` field for the openJiuwen connector stores:
```json
{
    "space_id": "the-openjiuwen-space-id",
    "user_id": "optional-user-id-for-auth"
}
```

---

## 11. Frontend — Pages & Components

### 11.1 Navigation Structure

```
AgentEval
├── Dashboard                    ← Overview: recent runs, metrics summary
├── Connectors
│   ├── All Connectors           ← List + status chips
│   └── Add Connector            ← Form: system_type selector, URL, auth
├── Evaluations
│   ├── All Evaluations          ← Table: name, task count, last run, status
│   ├── [Suite Name]
│   │   ├── Overview             ← Suite config, recent runs list
│   │   ├── Tasks                ← Task list with grader chips, add/edit/delete
│   │   ├── Runs                 ← Run history table
│   │   └── Settings             ← Suite config, custom metrics
│   └── New Evaluation
├── Benchmark Library            ← Browse + import pre-built benchmarks
├── Grader Library               ← Reusable grader catalog
└── Settings
    ├── LLM Configs              ← Model configs for model-based graders
    └── Workspace                ← Name, users, API tokens
```

### 11.2 Key Pages

#### Connector Form Page
- Dropdown: system type (openJiuwen, Generic HTTP, ...)
- Fields dynamically change based on system type:
  - openJiuwen: Base URL, Space ID, Auth token, (optional) username/password for refresh
  - Generic HTTP: Base URL, execute path template, result path template, headers
- Test connection button (calls `/connectors/{id}/health`)

#### Evaluation Detail → Tasks Tab
- Table of tasks: name, difficulty chip, pattern_type chip, trials count, tag chips, grader count
- Inline + button to add task
- Task form (drawer/modal):
  - Task name, description, tags, difficulty, pattern_type
  - Input data: JSON editor
  - Expected output: JSON editor
  - Trials slider (1-100)
  - Graders section: add/remove graders, each with:
    - Type selector (Deterministic / Model-Based / Code)
    - Weight slider
    - Config sub-form (depends on type):
      - **Deterministic**: check_type dropdown, path, expected_value, condition dropdown
      - **Model-Based**: LLM config selector, rubric textarea, assertions list, passing_score
      - **Code**: Monaco editor with `def grade(trace, expected): → dict`

#### Start Run Page
- Select evaluation (pre-filled if coming from evaluation page)
- Select connector
- Select target type (workflow / agent)
- Target selector (populated dynamically from `GET /connectors/{id}/targets`)
- Version input (optional)
- Task subset selector (all / specific tasks)
- Parallel toggle + max workers
- Submit → immediately redirects to Run Detail page

#### Run Detail Page
- Header: run status badge, target name, connector name, created time
- Real-time progress: SSE-driven task list with live status updates
  - Each task row: name, status icon, score progress bar, latency badge
- Metrics panel (shows once completed):
  - Card grid: success_rate, avg_score, avg_latency, error_rate, pass@1/3/5
  - Score distribution histogram
  - Latency box plot (p50/p75/p95)
  - Per-grader breakdown table
  - Flakiness score
- Task results table: expandable rows showing grader breakdown + trace_id link
- Compare button: opens run comparison modal

#### Run Comparison Modal
- Select up to 5 runs to compare
- Side-by-side metric cards
- Pass rate trend chart (if runs are ordered by time — regression detection)
- Task-level diff table: which tasks changed pass status between runs

#### Benchmark Library Page
- Card grid: benchmark name, description, task count, difficulty distribution
- Import button → chooses connector, target, suite name override → starts immediately or creates suite first

### 11.3 Component Library

#### `MetricsSummaryCard`
Props: `metrics: AggregateMetrics`, renders key metrics as stat cards.

#### `PassAtKChart`
Bar chart: x-axis = k values (1, 3, 5), y-axis = probability.

#### `ScoreDistributionChart`
Histogram of scores bucketed 0-20, 20-40, 40-60, 60-80, 80-100.

#### `LatencyChart`
Box-and-whisker chart or horizontal bar chart showing min/p50/p75/p95/max.

#### `PerGraderBreakdown`
Table: grader name | pass rate | avg score | trial count. Color-coded pass rate cells.

#### `GraderEditor`
Embedded form that renders different sub-forms based on selected grader type.
Includes Monaco editor for code graders with Python syntax highlighting.

#### `StatusBadge`
Props: `status: 'pending'|'running'|'completed'|'failed'|'cancelled'`
Renders colored chip with icon.

#### `JsonViewer`
Read-only JSON tree viewer for input/output data in results.

---

## 12. Authentication & Multi-Tenancy

### Model

- Single **workspace** per deployment (simple mode) or multiple workspaces (enterprise mode)
- **Users** belong to a workspace
- All resources (connectors, evaluations, runs, graders) are scoped to a workspace
- JWT-based auth with refresh tokens stored in Redis

### JWT Payload

```json
{
    "sub": "user-uuid",
    "workspace_id": "workspace-uuid",
    "is_admin": false,
    "exp": 1234567890
}
```

### Middleware

- All `/api/v1/*` routes require valid JWT (except `/auth/login`)
- `workspace_id` extracted from token, all DB queries automatically scoped
- Admin-only routes for workspace management

### Environment Variable Config

```env
# JWT
SECRET_KEY=<random 256-bit hex>
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/agenteval

# Redis
REDIS_URL=redis://localhost:6379/0

# Encryption key for sensitive fields (connector api keys)
FIELD_ENCRYPTION_KEY=<fernet key>
```

### Sensitive Field Encryption

Connector `auth_config` fields (tokens, passwords) and `llm_configs.api_key` must be encrypted at rest. Use Fernet symmetric encryption (`cryptography` library). The encryption key is loaded from environment variable, never stored in DB.

---

## 13. Background Job Processing

### Celery Architecture

```
FastAPI (web process)
    ↓  POST /runs → creates run record → sends task to queue
Redis Queue (broker)
    ↓  picks up task
Celery Worker (separate process)
    ↓  instantiates EvaluationHarness
    ↓  runs all trials via connector
    ↓  persists results to PostgreSQL
    ↓  publishes SSE events to Redis pub/sub channel "run:{run_id}"
FastAPI SSE endpoint
    ↓  subscribes to Redis channel "run:{run_id}"
    ↓  forwards events to browser
```

### Celery Task

```python
# agenteval/workers/evaluation_worker.py

@celery_app.task(bind=True, max_retries=0, name="run_evaluation")
def run_evaluation_task(self, run_id: str):
    """
    Main Celery task for executing an evaluation run.

    - Loads run + tasks from DB
    - Instantiates connector from DB config
    - Runs harness
    - Persists results
    - Publishes SSE events
    """
    ...
```

### Cancellation

- Store a cancellation flag in Redis: `SET run:{run_id}:cancel 1 EX 3600`
- Worker checks this flag between trials; if set, marks run as CANCELLED and stops
- `POST /runs/{id}/cancel` sets the flag

### Concurrency

- Default: 1 Celery worker, 4 concurrent threads per worker
- Each evaluation run gets one task; parallel trials within a run use `asyncio` (no extra workers needed)
- Multiple runs can execute simultaneously (each on a separate thread in the worker)
- `max_workers` run config parameter controls parallelism **within** a run

---

## 14. Benchmark Library & Import/Export

### Built-in Benchmarks

The 7 benchmarks from openJiuwen are ported verbatim as YAML files in `agenteval/benchmarks/`. They remain openJiuwen-specific in their pattern validation (uses component_type integers), but work with any connector for deterministic/model-based grader checks.

Additionally, create system-agnostic benchmarks:

| File | Description |
|---|---|
| `calculator_benchmark.yaml` | Input/output math check (any system) |
| `chaining_benchmark.yaml` | Multi-step chain quality check |
| `routing_benchmark.yaml` | Conditional routing verification |
| `parallelization_benchmark.yaml` | Parallel branch detection |
| `orchestrator_worker_benchmark.yaml` | Sub-workflow delegation |
| `evaluator_optimizer_benchmark.yaml` | Loop optimization |
| `memory_usage_benchmark.yaml` | State management |
| `json_output_benchmark.yaml` | NEW: validates structured JSON output format |
| `sentiment_analysis_benchmark.yaml` | NEW: LLM classification correctness |
| `rag_quality_benchmark.yaml` | NEW: Retrieval-augmented generation relevance |

### YAML Format (Preserved)

Identical to the format used in openJiuwen. The only addition is an optional `connector_hints` section:

```yaml
suite:
  suite_name: "Calculator — Add Function"
  description: "..."
  connector_hints:
    compatible_systems: ["openjiuwen", "generic_http"]
    target_type: "workflow"

tasks:
  - task_id: "calc_add_basic"
    task_name: "Basic integer addition"
    # ... identical format to current ...
```

### Import Endpoint

```
POST /api/v1/benchmarks/import
{
    "file_name": "calculator_benchmark.yaml",
    "suite_name_override": null
}
```

Creates the evaluation suite and all tasks. Returns `evaluation_id`.

### Export Endpoint

```
POST /api/v1/evaluations/{id}/export
```

Returns a YAML document that can be re-imported into any AgentEval instance.

---

## 15. Observability & Internal Logging

### Application Logging

- Structured JSON logging via `structlog`
- Fields: `timestamp`, `level`, `event`, `run_id`, `task_id`, `connector_id`, `duration_ms`
- Log levels configurable via `LOG_LEVEL` env var

### Metrics (Internal Platform Health)

Expose Prometheus metrics at `/metrics`:

| Metric | Type | Description |
|---|---|---|
| `agenteval_runs_total` | Counter | Total runs, labeled by status |
| `agenteval_run_duration_seconds` | Histogram | End-to-end run duration |
| `agenteval_trial_duration_seconds` | Histogram | Per-trial execution duration |
| `agenteval_connector_call_duration_seconds` | Histogram | Connector HTTP call latency |
| `agenteval_connector_errors_total` | Counter | Connector error count by type |
| `agenteval_grader_duration_seconds` | Histogram | Per-grader execution time |
| `agenteval_active_runs` | Gauge | Currently running evaluations |

### Error Tracing

- Integrate `sentry-sdk` (optional, configured via `SENTRY_DSN` env var)
- All unhandled exceptions in Celery workers and API routes captured

---

## 16. Deployment

### Docker Compose (Production)

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://agenteval:pass@db:5432/agenteval
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
      FIELD_ENCRYPTION_KEY: ${FIELD_ENCRYPTION_KEY}
    depends_on: [db, redis]
    ports: ["8080:8080"]

  worker:
    build: ./backend
    command: celery -A agenteval.workers.celery_app worker --loglevel=info
    environment:
      DATABASE_URL: postgresql+asyncpg://agenteval:pass@db:5432/agenteval
      REDIS_URL: redis://redis:6379/0
    depends_on: [db, redis]

  frontend:
    build: ./frontend
    ports: ["3000:80"]    # Nginx serving built React app

  nginx:
    image: nginx:alpine
    volumes:
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf
    ports: ["80:80"]
    depends_on: [backend, frontend]

  db:
    image: postgres:15
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment:
      POSTGRES_DB: agenteval
      POSTGRES_USER: agenteval
      POSTGRES_PASSWORD: pass

  redis:
    image: redis:7-alpine
    volumes: ["redisdata:/data"]

volumes:
  pgdata:
  redisdata:
```

### Docker Compose (Development)

```yaml
# docker-compose.dev.yml (extends base)
services:
  backend:
    command: uvicorn main:app --reload --host 0.0.0.0 --port 8080
    volumes: ["./backend:/app"]  # hot reload

  worker:
    command: watchmedo auto-restart -- celery -A agenteval.workers.celery_app worker
    volumes: ["./backend:/app"]

  frontend:
    command: npm run dev -- --host 0.0.0.0
    volumes: ["./frontend:/app"]
    ports: ["5173:5173"]
```

### Nginx Config

```nginx
server {
    listen 80;

    # Frontend
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SSE — requires special buffering config
    location /api/v1/runs/ {
        proxy_pass http://backend:8080;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
    }
}
```

### Environment Variables Reference

```env
# Required
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=<256-bit hex>
FIELD_ENCRYPTION_KEY=<fernet key, generated with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">

# Optional
LOG_LEVEL=INFO
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
CELERY_CONCURRENCY=4          # worker threads
MAX_PARALLEL_RUNS=10          # platform-wide concurrent run limit
SENTRY_DSN=                   # leave blank to disable
BENCHMARK_DIR=/app/benchmarks  # path to YAML benchmark files
```

### First-Run Initialization

On first startup, run:
```bash
# 1. Apply migrations
alembic upgrade head

# 2. Create default workspace + admin user
python scripts/create_admin.py --email admin@example.com --password ...

# 3. Seed built-in benchmarks into DB (optional — lazy-loaded from disk is fine)
python scripts/seed_benchmarks.py
```

---

## 17. Security Considerations

### Connector Credentials

- API keys and tokens stored **encrypted** using Fernet (AES-128-CBC + HMAC-SHA256)
- Encryption key from env var, never stored in DB or logs
- Credentials never returned in API responses (write-only after creation, masked in GET)
- Recommended: Use environment variable references (`env:OPENJIUWEN_TOKEN`) instead of literal values for production

### Code-Based Grader Sandboxing

The current implementation uses `exec()` with no sandboxing — this is a known risk.

**Recommended mitigation** (implement in v2):
- Run code-based graders in a subprocess with resource limits (`resource.setrlimit`)
- Or use [RestrictedPython](https://restrictedpython.readthedocs.io/en/latest/)
- Or run grader code in an isolated Docker container (heaviest but most secure)

**For v1**: Accept the risk in internal/trusted deployments; add a prominent warning in the UI.

### SSRF Protection

The connector's `base_url` field is user-controlled and could be used to make requests to internal services.

**Mitigations**:
- Validate that `base_url` resolves to a non-RFC-1918 address (configurable whitelist/blacklist)
- Add `ALLOW_PRIVATE_IPS=true/false` config (default false in production, true for local dev)
- Log all outbound connector requests

### Rate Limiting

- API rate limiting via `slowapi` (per-user, per-endpoint)
- Connector calls rate-limited per connector instance to prevent overloading target systems
- Max concurrent runs per workspace (configurable)

### Input Validation

- All task `input_data` and `expected_output` are valid JSON (enforced by Pydantic JSONB fields)
- Grader code size limit: 64KB maximum
- Task name, evaluation name: max length enforced

---

## 18. Build Phases & Roadmap

### Phase 1 — Foundation (MVP)

**Goal**: Working evaluation platform with openJiuwen integration

1. Backend project scaffold (FastAPI, SQLAlchemy, Alembic, Pydantic)
2. Database migrations for all tables
3. Auth system (JWT, workspace, users)
4. Connector CRUD API + `BaseConnector` abstract class
5. `ConnectorRegistry`
6. **openJiuwen Connector**: execute workflow + agent, trace normalization
7. Evaluation suite + task CRUD
8. Grader engine (DETERMINISTIC + CODE_BASED) — ported from openJiuwen
9. Metrics module — ported verbatim from openJiuwen
10. Pattern validator — rewritten for NormalizedTrace
11. `EvaluationHarness` rewrite (connector-based)
12. Celery worker setup + Redis
13. Run management API (start, status, results)
14. Benchmark YAML import/export
15. Basic frontend: Login, Connector setup, Evaluation list, Task editor, Run start, Run results

### Phase 2 — Feature Parity + Model-Based Graders

1. LLM Config management (backend + frontend)
2. Model-based grader implementation (OpenAI SDK, Anthropic SDK)
3. SSE real-time run progress stream
4. Run comparison view
5. Reusable grader library
6. Advanced result views: charts, grader breakdown, latency distribution
7. Docker Compose production deployment
8. Proper error handling, retry logic in connector
9. Run cancellation
10. Custom metrics (code-based aggregate metrics)

### Phase 3 — Extended Integrations

1. **Generic HTTP Connector**: configure any endpoint with SSE/polling
2. **LangChain/LangServe Connector**
3. Connector health dashboard
4. Connector auto-discovery (test endpoint browsing)
5. Benchmark library expansion (10+ new benchmarks)
6. YAML export of evaluation suites
7. Batch import of multiple benchmarks

### Phase 4 — Enterprise Features

1. Regrade runs (re-run graders on stored traces without re-executing)
2. Scheduled evaluations (cron-based automatic runs)
3. Regression alerts (compare against baseline, send notification if degraded)
4. Multi-workspace management
5. API tokens for programmatic access (CI/CD integration)
6. Code grader sandboxing (RestrictedPython or subprocess)
7. Helm chart for Kubernetes deployment
8. Prometheus + Grafana dashboard for platform health

---

## 19. Key Design Decisions & Trade-offs

### Decision 1: Why not embed a Python SDK instead of REST-only?

**Option A**: Import openJiuwen Python packages directly (current embedded approach).
**Option B**: REST API calls only (chosen approach).

**Rationale for B**:
- Complete decoupling — AgentEval can run on a different machine/container
- No version coupling between AgentEval and openJiuwen
- Works for ALL systems (non-Python systems can also be integrated)
- AgentEval upgrades are independent of openJiuwen upgrades
- **Downside**: Slightly higher latency per trial; requires openJiuwen's API to be running

### Decision 2: Why Celery + Redis instead of asyncio background tasks?

**Option A**: FastAPI `BackgroundTasks` (asyncio).
**Option B**: Celery + Redis (chosen approach).

**Rationale for B**:
- Celery workers survive backend restarts (runs that were in-flight can be recovered)
- Multiple workers can scale horizontally
- Worker concurrency is configurable independently of web server
- Built-in retry and failure handling
- **Downside**: More infrastructure (Redis, separate worker process)

### Decision 3: PostgreSQL vs SQLite

SQLite is kept for development only. Production requires PostgreSQL because:
- JSONB for flexible config/results storage with querying
- Concurrent write access from multiple Celery workers
- Production-grade ACID guarantees
- Row-level locking for run status updates

### Decision 4: NormalizedTrace vs raw connector output

Could pass raw connector output to graders. Instead, normalize first.

**Benefits of normalization**:
- Grader engine has zero knowledge of any specific system
- Stored traces are system-independent (regrading works even if connector changes)
- Pattern validator is portable
- Future connectors don't require grader changes
- **Downside**: Normalization code must be maintained per connector

### Decision 5: Frontend stack — standalone vs embedded in openJiuwen

AgentEval has its own completely independent frontend. Not embedded in openJiuwen's frontend.

**Benefits**:
- Can be used to evaluate openJiuwen and other systems simultaneously
- Independent deployable
- **Downside**: Separate login, separate URL — users must navigate to two places

---

## 20. Appendix: Data Contracts

### 20.1 NormalizedTrace JSON (stored in task_results.normalized_trace)

```json
{
    "trace_id": "abc123",
    "final_output": { "result": "42" },
    "spans": [
        {
            "span_id": "1",
            "span_name": "Start",
            "span_type": "workflow_component",
            "parent_span_id": null,
            "start_time_ms": 0,
            "end_time_ms": 12,
            "status": "ok",
            "inputs": { "a": 2, "b": 4 },
            "outputs": { "a": 2, "b": 4 },
            "component_type": 1,
            "attributes": {}
        },
        {
            "span_id": "2",
            "span_name": "Calculate",
            "span_type": "workflow_component",
            "parent_span_id": null,
            "start_time_ms": 12,
            "end_time_ms": 834,
            "status": "ok",
            "inputs": { "a": 2, "b": 4 },
            "outputs": { "result": "6" },
            "component_type": 3,
            "attributes": {}
        }
    ],
    "token_usage": {
        "prompt_tokens": 250,
        "completion_tokens": 45,
        "total_tokens": 295
    }
}
```

### 20.2 Graders Config JSON (stored in evaluation_tasks.graders_config)

```json
[
    {
        "name": "result_equals_6",
        "type": 0,
        "weight": 1.0,
        "config": {
            "check_type": "state_check",
            "path": "result",
            "expected_value": "6",
            "condition": "eq"
        }
    },
    {
        "name": "output_quality",
        "type": 1,
        "weight": 0.5,
        "config": {
            "llm_config_id": "uuid-of-llm-config",
            "rubric": "The output is a valid number equal to the sum of inputs.",
            "passing_score": 0.8
        }
    },
    {
        "name": "custom_validator",
        "type": 2,
        "weight": 1.0,
        "config": {
            "code": "def grade(trace, expected):\n    out = trace.get('final_output') or {}\n    return {'passed': out.get('result') == expected.get('result'), 'score': 1.0}",
            "function_name": "grade"
        }
    }
]
```

### 20.3 Aggregate Metrics JSON (stored in evaluation_runs.metrics)

```json
{
    "success_rate": 0.85,
    "passed": 17,
    "total_results": 20,
    "error_rate": 0.05,
    "total_tasks": 5,
    "task_pass_rate": 0.8,
    "tasks_fully_passed_rate": 0.6,
    "tasks_never_passed_rate": 0.2,
    "avg_score": 0.82,
    "median_score": 0.9,
    "score_std": 0.18,
    "score_min": 0.0,
    "score_max": 1.0,
    "avg_latency_ms": 1243.5,
    "median_latency_ms": 987.0,
    "p75_latency_ms": 1580.0,
    "p95_latency_ms": 2840.0,
    "min_latency_ms": 340.0,
    "max_latency_ms": 3200.0,
    "latency_std_ms": 620.0,
    "latency_cv": 0.49,
    "total_latency_ms": 24870,
    "pass_at_k": { "1": 0.85, "3": 0.97, "5": 0.99 },
    "pass_pow_k": { "1": 0.85, "3": 0.61, "5": 0.44 },
    "token_usage": { "prompt_tokens": 5000, "completion_tokens": 1200, "total_tokens": 6200 },
    "perfect_score_rate": 0.65,
    "score_distribution": { "0_20": 0.05, "20_40": 0.05, "40_60": 0.10, "60_80": 0.15, "80_100": 0.65 },
    "tokens_per_trial": { "prompt_tokens": 250.0, "completion_tokens": 60.0, "total_tokens": 310.0 },
    "tokens_efficiency": {
        "passed": { "prompt_tokens": 240.0, "completion_tokens": 55.0, "total_tokens": 295.0 },
        "failed": { "prompt_tokens": 310.0, "completion_tokens": 85.0, "total_tokens": 395.0 }
    },
    "per_grader_breakdown": {
        "result_equals_6": { "pass_rate": 0.85, "avg_score": 0.85, "count": 20 },
        "output_not_empty": { "pass_rate": 1.0, "avg_score": 1.0, "count": 20 }
    },
    "flakiness": 0.12,
    "custom_metrics": {}
}
```

### 20.4 SSE Event Formats

```
// Run started
data: {"type":"run_started","run_id":"uuid","total_tasks":5,"total_trials":12}

// Trial started
data: {"type":"trial_started","task_id":"uuid","task_name":"Basic addition","trial":1,"of":3}

// Trial completed
data: {"type":"trial_completed","task_id":"uuid","trial":1,"passed":true,"score":1.0,"latency_ms":834}

// Trial failed (execution error, not grader failure)
data: {"type":"trial_error","task_id":"uuid","trial":1,"error":"Connection timeout after 30s"}

// Task fully done (all trials)
data: {"type":"task_done","task_id":"uuid","task_name":"Basic addition","trials_passed":3,"trials_total":3}

// Run finished
data: {"type":"run_completed","run_id":"uuid","status":"completed","metrics":{...}}

// Run failed
data: {"type":"run_failed","run_id":"uuid","error":"Connector health check failed"}

// Keepalive (every 15s)
: keepalive
```

---

*End of AgentEval Platform Build Plan*

**Version**: 1.0
**Date**: 2026-03-17
**Author**: Architecture planning document
