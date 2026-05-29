# AgentEval — Integration Technical Specification

> Audience: architects and developers building the integration layer.
> This document covers the general connector architecture (high level), the design patterns used (mid level), and the exact implementation details for the openJiuwen connector (low level).

---

## Table of Contents

1. [Integration Philosophy](#1-integration-philosophy)
2. [High-Level: The Connector Architecture](#2-high-level-the-connector-architecture)
3. [Design Patterns in the Integration Layer](#3-design-patterns-in-the-integration-layer)
4. [Mid-Level: Connector Internals](#4-mid-level-connector-internals)
5. [The Normalized Trace Contract](#5-the-normalized-trace-contract)
6. [Low-Level: openJiuwen Connector — Complete Spec](#6-low-level-openjiuwen-connector--complete-spec)
   - 6.1 [Authentication Flow](#61-authentication-flow)
   - 6.2 [Token Lifecycle Management](#62-token-lifecycle-management)
   - 6.3 [Listing Workflows and Agents](#63-listing-workflows-and-agents)
   - 6.4 [Executing a Workflow or Agent](#64-executing-a-workflow-or-agent)
   - 6.5 [Parsing the SSE Stream](#65-parsing-the-sse-stream)
   - 6.6 [Building the NormalizedTrace](#66-building-the-normalizedtrace)
   - 6.7 [Error Handling and Edge Cases](#67-error-handling-and-edge-cases)
7. [Resilience Patterns](#7-resilience-patterns)
8. [Adding a New Connector (Generic HTTP)](#8-adding-a-new-connector-generic-http)
9. [Testing the Integration Layer](#9-testing-the-integration-layer)
10. [Sequence Diagrams](#10-sequence-diagrams)

---

## 1. Integration Philosophy

AgentEval never imports code from target systems. It only communicates with them over HTTP. This constraint is intentional and non-negotiable — it ensures:

- Target systems can be on different machines, in different languages, behind firewalls
- AgentEval version upgrades are completely independent of target system upgrades
- Any system that can expose an HTTP API can be integrated

The integration layer translates between two worlds:

```
[ Target System's API Shape ]  ←→  [ Connector ]  ←→  [ AgentEval's internal contracts ]
```

The connector's entire job is to speak both languages fluently.

---

## 2. High-Level: The Connector Architecture

### The Three Core Abstractions

Every integration, regardless of target system, is expressed through three abstractions:

```
┌──────────────────────────────────────────────────────────────────────┐
│  BaseConnector                                                       │
│                                                                      │
│  execute(target_type, target_id, version, inputs, ...) → ExecutionResult  │
│  list_targets(target_type) → List[TargetInfo]                        │
│  health_check() → bool                                               │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │ returns
                    ┌───────────────┴───────────────┐
                    │         ExecutionResult        │
                    │  - final_output: Any           │
                    │  - normalized_trace: NormalizedTrace  │
                    │  - token_usage: Dict           │
                    │  - external_trace_id: str      │
                    │  - error: Optional[str]        │
                    └───────────────┬───────────────┘
                                    │ contains
                    ┌───────────────┴───────────────┐
                    │         NormalizedTrace        │
                    │  - trace_id: str               │
                    │  - final_output: Any           │
                    │  - spans: List[NormalizedSpan] │
                    │  - token_usage: Dict           │
                    └───────────────────────────────┘
```

`NormalizedTrace` is the lingua franca. Once a connector produces it, the grader engine, pattern validator, and metrics engine never need to know which system produced the execution.

### The Execution Flow from 50,000 Feet

```
EvaluationHarness
    │
    ├─ 1. Load run + tasks from DB
    ├─ 2. Get connector instance from ConnectorRegistry (using run.connector_id)
    │       ConnectorRegistry.get(connector_id) → OpenJiuwenConnector(config)
    │
    ├─ For each task, for each trial:
    │    │
    │    ├─ 3. connector.execute(target_type, target_id, inputs, ...)
    │    │       ↓
    │    │    [CONNECTOR DOES ITS WORK — see below]
    │    │       ↓
    │    │    returns ExecutionResult(normalized_trace, final_output, ...)
    │    │
    │    ├─ 4. GraderEngine.run_graders(graders_config, execution_result, expected)
    │    │       → List[GraderResult]
    │    │
    │    ├─ 5. PatternValidator.validate(pattern_type, execution_result.normalized_trace)
    │    │       → bool
    │    │
    │    └─ 6. Persist TaskResult to DB
    │
    └─ 7. Compute aggregate metrics → update run record
```

### What the Connector Abstracts

The connector absorbs all complexity of the target system:
- Authentication (credentials, token refresh)
- Request serialization (what format the system expects)
- Response deserialization (parsing SSE, JSON, XML — whatever the system returns)
- Trace normalization (translating system-specific traces to `NormalizedTrace`)
- Error handling (mapping target system errors to a standard error contract)

---

## 3. Design Patterns in the Integration Layer

This section maps GoF and enterprise patterns to specific components. Each pattern is listed with where it is used and why it was chosen.

### 3.1 Adapter Pattern

**Where**: Every `BaseConnector` implementation is an Adapter.

**Problem**: AgentEval has its own internal interface (`execute()`, `list_targets()`, `health_check()`). openJiuwen has a completely different API (`POST /api/v1/execution/workflow`, `POST /api/v1/workflows/list`, etc.). These are incompatible.

**Solution**: `OpenJiuwenConnector` adapts openJiuwen's interface to `BaseConnector`'s interface.

```
Target Interface (AgentEval):        Adaptee (openJiuwen API):
┌──────────────────────┐             ┌─────────────────────────────────────┐
│ BaseConnector        │             │ openJiuwen REST API                 │
│                      │             │                                     │
│ execute(...)         │             │ POST /api/v1/execution/workflow      │
│ list_targets(...)    │←──Adapter──→│ POST /api/v1/workflows/list         │
│ health_check()       │             │ POST /api/v1/agents/list            │
│                      │             │ GET  /api/v1/health                 │
└──────────────────────┘             └─────────────────────────────────────┘
```

**Why Adapter (not Proxy)**: We are not just forwarding calls — we are translating the entire request and response format. This is adaption, not proxying.

```python
# The Adapter in code
class OpenJiuwenConnector(BaseConnector):
    """Adapts the openJiuwen REST API to AgentEval's BaseConnector interface."""

    async def execute(self, target_type, target_id, version, inputs, conversation_id, timeout):
        # Translate BaseConnector.execute() → openJiuwen POST /api/v1/execution/workflow
        openjiuwen_request = {
            "id": target_id,
            "version": version or "draft",
            "space_id": self._space_id,
            "conversation_id": conversation_id,
            "inputs": inputs,
        }
        endpoint = self._execution_endpoint(target_type)  # /execution/workflow or /execution/agent
        raw_chunks = await self._stream_sse(endpoint, openjiuwen_request, timeout)

        # Translate response → NormalizedTrace (Adapter's core responsibility)
        return self._normalizer.normalize(raw_chunks)
```

---

### 3.2 Strategy Pattern

**Where**: Execution strategy inside the connector; how results are collected.

**Problem**: Different target systems return results differently:
- openJiuwen: SSE streaming — results arrive as a stream of events
- Some systems: polling — post job, poll until done
- Some systems: synchronous — one HTTP call, wait for response
- Some systems: webhooks — post job, system calls back

Each collection strategy requires different logic, but the harness doesn't care about the difference.

**Solution**: Define an `ExecutionStrategy` abstraction. Each connector picks the strategy that matches its target system.

```python
# agenteval/connectors/strategies.py

class ExecutionStrategy(ABC):
    """How to invoke a target and collect the result."""

    @abstractmethod
    async def execute(
        self,
        http_client: httpx.AsyncClient,
        url: str,
        request_body: dict,
        headers: dict,
        timeout: int,
    ) -> RawExecutionResult:
        """Return raw chunks/response from the target system."""
        ...


class SSEStreamingStrategy(ExecutionStrategy):
    """
    Collect results from a Server-Sent Events stream.
    Used by: openJiuwen, LangServe streaming endpoints.
    """
    async def execute(self, http_client, url, request_body, headers, timeout):
        chunks = []
        async with http_client.stream("POST", url, json=request_body, headers=headers, timeout=timeout) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if line.startswith("data:"):
                    raw = line[5:].strip()
                    if raw and raw != "[DONE]":
                        chunks.append(json.loads(raw))
        return RawExecutionResult(chunks=chunks)


class PollingStrategy(ExecutionStrategy):
    """
    Submit job, poll until done.
    Used by: systems with async job APIs.
    """
    async def execute(self, http_client, url, request_body, headers, timeout):
        # POST to submit job
        response = await http_client.post(url, json=request_body, headers=headers)
        job_id = response.json()["job_id"]

        # Poll for completion
        poll_url = url + f"/{job_id}/status"
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            status_r = await http_client.get(poll_url, headers=headers)
            data = status_r.json()
            if data["status"] == "completed":
                return RawExecutionResult(chunks=[data["result"]])
            elif data["status"] == "failed":
                return RawExecutionResult(error=data.get("error"))
            await asyncio.sleep(2)
        return RawExecutionResult(error="Polling timeout exceeded")


class SynchronousStrategy(ExecutionStrategy):
    """
    Single HTTP call, wait for response.
    Used by: simple HTTP endpoints that respond synchronously.
    """
    async def execute(self, http_client, url, request_body, headers, timeout):
        response = await http_client.post(url, json=request_body, headers=headers, timeout=timeout)
        response.raise_for_status()
        return RawExecutionResult(chunks=[response.json()])
```

**Usage in OpenJiuwenConnector**:
```python
class OpenJiuwenConnector(BaseConnector):
    def __init__(self, config):
        super().__init__(config)
        self._strategy = SSEStreamingStrategy()  # openJiuwen uses SSE
```

The `GenericHTTPConnector` lets the user choose the strategy at configuration time:
```python
strategy_map = {
    "sse": SSEStreamingStrategy,
    "polling": PollingStrategy,
    "sync": SynchronousStrategy,
}
self._strategy = strategy_map[config["extra_config"].get("strategy", "sync")]()
```

---

### 3.3 Template Method Pattern

**Where**: The `EvaluationHarness._execute_trial()` method.

**Problem**: The algorithm for running a trial is always the same at a high level:
1. Call the connector to execute
2. Run graders on the result
3. Run pattern validator if needed
4. Aggregate scores
5. Persist

But step 1 (the actual execution) varies completely by target system.

**Solution**: Template Method. The harness defines the algorithm skeleton, and the connector fills in the execution step (the "hook").

```python
class EvaluationHarness:
    """Template Method pattern: defines the algorithm, delegates execution to connector."""

    async def _execute_trial(self, task, trial_num, connector):
        """
        TEMPLATE METHOD: Algorithm is fixed. Only _execute_via_connector() varies.
        """
        # Step 1: Fixed — prepare conversation ID
        conversation_id = self._make_conversation_id(run_id, task.id, trial_num)
        start_time = time.time_ns() // 1_000_000

        # Step 2: HOOK — delegated to connector (varies by system)
        execution_result = await self._execute_via_connector(
            connector, task, conversation_id
        )

        # Steps 3-7: Fixed — grading, scoring, persistence
        grader_results = await self._grader.run_graders(
            task.graders_config, execution_result, task.expected_output
        )
        # ... rest is always the same ...

    async def _execute_via_connector(self, connector, task, conversation_id):
        """HOOK: The only step that varies. Calls the connector."""
        return await connector.execute(
            target_type=self._run.target_type,
            target_id=self._run.target_id,
            target_version=self._run.target_version,
            inputs=task.input_data,
            conversation_id=conversation_id,
            timeout_seconds=task.timeout_seconds,
        )
```

---

### 3.4 Factory Method / Registry Pattern

**Where**: `ConnectorRegistry` — creates connector instances from DB configuration.

**Problem**: At the time the harness starts a run, it has only a `connector_id` (UUID). It needs to instantiate the right connector class (openJiuwen vs generic HTTP vs LangChain) with the correct configuration, without knowing in advance which class is needed.

**Solution**: Registry pattern. Each connector class registers itself under a `system_type` key at import time. The registry acts as a Factory.

```python
# agenteval/connectors/registry.py

_REGISTRY: Dict[str, Type[BaseConnector]] = {}

def register(system_type: str):
    """Class decorator. Registers the connector with the factory."""
    def decorator(cls: Type[BaseConnector]):
        _REGISTRY[system_type] = cls
        return cls
    return decorator

class ConnectorRegistry:
    """
    Factory Method: creates connector instances from DB config.
    Caches instances per connector_id to avoid re-initializing on every trial.
    """
    _cache: Dict[str, BaseConnector] = {}

    @classmethod
    async def get(cls, connector_id: str, db: AsyncSession) -> BaseConnector:
        if connector_id in cls._cache:
            return cls._cache[connector_id]

        row = await ConnectorRepository.get_by_id(db, connector_id)
        if row is None:
            raise ValueError(f"Connector {connector_id} not found")

        connector_cls = _REGISTRY.get(row.system_type)
        if connector_cls is None:
            raise ValueError(
                f"No connector registered for system_type='{row.system_type}'. "
                f"Registered types: {list(_REGISTRY.keys())}"
            )

        instance = connector_cls(row.to_config_dict())
        cls._cache[connector_id] = instance
        return instance

    @classmethod
    def invalidate(cls, connector_id: str):
        """Call this when a connector's config is updated."""
        cls._cache.pop(connector_id, None)
```

**Connector self-registration**:
```python
# agenteval/connectors/openjiuwen/connector.py

@register("openjiuwen")   # <-- Registers at module import time
class OpenJiuwenConnector(BaseConnector):
    ...
```

**Why Registry over abstract Factory**: We don't know at compile time how many connector types will exist. The registry allows new connectors to be added as plugins without modifying the factory class.

---

### 3.5 Circuit Breaker Pattern

**Where**: Wrapping all outbound HTTP calls in the connector.

**Problem**: If the target system is down or slow, all evaluation trials will time out one by one. This wastes time and leaves runs in limbo. We want to fail fast.

**Solution**: Circuit Breaker with three states: CLOSED (normal), OPEN (failing fast), HALF_OPEN (testing recovery).

```python
# agenteval/connectors/circuit_breaker.py

class CircuitBreakerState(Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Failing fast — not calling target system
    HALF_OPEN = "half_open" # Testing if target system recovered

class CircuitBreaker:
    """
    Circuit Breaker pattern: prevents cascade failures when target system is down.

    Transitions:
      CLOSED → OPEN:      after failure_threshold consecutive failures
      OPEN → HALF_OPEN:   after recovery_timeout seconds
      HALF_OPEN → CLOSED: after a single successful call
      HALF_OPEN → OPEN:   if the probe call also fails
    """
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._failure_threshold = failure_threshold
        self._last_failure_time: Optional[float] = None
        self._recovery_timeout = recovery_timeout
        self._lock = asyncio.Lock()

    async def call(self, coro):
        async with self._lock:
            if self.state == CircuitBreakerState.OPEN:
                elapsed = time.time() - self._last_failure_time
                if elapsed >= self._recovery_timeout:
                    self.state = CircuitBreakerState.HALF_OPEN
                else:
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker OPEN. Target system unreachable. "
                        f"Retry after {self._recovery_timeout - elapsed:.0f}s."
                    )
        try:
            result = await coro
            await self._on_success()
            return result
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            await self._on_failure()
            raise

    async def _on_success(self):
        async with self._lock:
            self._failure_count = 0
            self.state = CircuitBreakerState.CLOSED

    async def _on_failure(self):
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            if self._failure_count >= self._failure_threshold:
                self.state = CircuitBreakerState.OPEN
```

**Usage in connector**:
```python
class OpenJiuwenConnector(BaseConnector):
    def __init__(self, config):
        ...
        self._circuit_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)

    async def execute(self, ...):
        return await self._circuit_breaker.call(
            self._do_execute(...)
        )
```

---

### 3.6 Decorator Pattern (Retry)

**Where**: HTTP calls in connectors are decorated with retry logic.

**Problem**: Transient network failures or rate limit responses (`429 Too Many Requests`) should be retried automatically, not treated as permanent failures.

**Solution**: Decorator function that wraps any `async` callable with configurable retry-with-backoff.

```python
# agenteval/connectors/retry.py

def with_retry(max_attempts=3, backoff_base=1.0, retryable_statuses=(429, 502, 503, 504)):
    """
    Decorator pattern: adds retry-with-exponential-backoff to any async function.

    Retries on:
    - httpx.ConnectError
    - httpx.TimeoutException
    - HTTP status codes in retryable_statuses
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except httpx.HTTPStatusError as e:
                    if e.response.status_code not in retryable_statuses:
                        raise  # Non-retryable HTTP error — propagate immediately
                    last_exc = e
                    wait = backoff_base * (2 ** (attempt - 1))
                    logger.warning(f"HTTP {e.response.status_code} on attempt {attempt}, retrying in {wait}s")
                    await asyncio.sleep(wait)
                except (httpx.ConnectError, httpx.TimeoutException) as e:
                    last_exc = e
                    wait = backoff_base * (2 ** (attempt - 1))
                    logger.warning(f"{type(e).__name__} on attempt {attempt}, retrying in {wait}s")
                    await asyncio.sleep(wait)
            raise last_exc
        return wrapper
    return decorator
```

**Usage**:
```python
class OpenJiuwenConnector(BaseConnector):

    @with_retry(max_attempts=3, backoff_base=0.5)
    async def _fetch_workflow_list(self, page: int) -> dict:
        response = await self._http_client.post(
            f"{self.base_url}/api/v1/workflows/list",
            json={"space_id": self._space_id, "page": page, "page_size": 50},
            headers=await self._auth_headers(),
        )
        response.raise_for_status()
        return response.json()
```

---

### 3.7 Observer Pattern (SSE Event Publishing)

**Where**: The harness publishes run progress events; the API SSE endpoint subscribes.

**Problem**: The evaluation harness runs in a Celery worker (different process from the FastAPI web server). The browser has an open SSE connection to the web server. How does progress from the worker reach the browser?

**Solution**: Observer via Redis Pub/Sub. The worker is the publisher; the web server is the subscriber/forwarder.

```
[Celery Worker]                    [FastAPI Web Server]           [Browser]
     │                                      │                         │
     │  redis.publish("run:{id}",           │                         │
     │    {type: "trial_completed", ...})   │                         │
     │ ─────────────────────────────────►  │                         │
     │                                      │  EventSource("...stream")│
     │                              SSE forward ──────────────────────►│
     │                                      │                         │
```

```python
# In the Celery worker (EvaluationHarness)
class EventPublisher:
    def __init__(self, redis_client, run_id: str):
        self._redis = redis_client
        self._channel = f"run:{run_id}"

    async def publish(self, event_type: str, **payload):
        message = json.dumps({"type": event_type, **payload})
        await self._redis.publish(self._channel, message)

# In the FastAPI SSE endpoint
@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str, request: Request):
    async def event_generator():
        async with redis.subscribe(f"run:{run_id}") as sub:
            async for message in sub.listen():
                if message["type"] == "message":
                    yield f"data: {message['data']}\n\n"
                if await request.is_disconnected():
                    break
    return EventSourceResponse(event_generator())
```

---

### 3.8 Facade Pattern

**Where**: The `OpenJiuwenConnector` class as a whole.

**Problem**: Connecting to openJiuwen involves multiple sub-systems: authentication, token refresh, SSE parsing, workflow listing, agent execution, trace normalization. Each of these has its own complexity.

**Solution**: The `OpenJiuwenConnector` class acts as a Facade — it presents a single, simplified interface to the rest of AgentEval, hiding all the internal complexity.

```
External view (AgentEval):          Internal view (OpenJiuwenConnector):
┌────────────────────┐              ┌────────────────────────────────────────┐
│                    │              │                                        │
│ .execute(...)      │ ─────────► │ AuthManager.get_token()                │
│ .list_targets(...) │              │ SSEStreamingStrategy.execute()         │
│ .health_check()    │              │ OpenJiuwenTraceNormalizer.normalize()  │
│                    │              │ CircuitBreaker.call()                  │
└────────────────────┘              │ RetryDecorator (via @with_retry)       │
                                    └────────────────────────────────────────┘
```

---

### 3.9 Builder Pattern

**Where**: `NormalizedTraceBuilder` — constructs `NormalizedTrace` from a stream of raw chunks.

**Problem**: A `NormalizedTrace` is built incrementally by processing chunks one by one. Some spans are not complete until a corresponding "finish" chunk arrives. Building it requires accumulating state.

**Solution**: Builder pattern that processes chunks sequentially and constructs the final trace.

```python
class NormalizedTraceBuilder:
    """
    Builder pattern: incrementally builds a NormalizedTrace from raw chunks.

    Usage:
        builder = NormalizedTraceBuilder()
        for chunk in raw_chunks:
            builder.add_chunk(chunk)
        trace = builder.build()
    """
    def __init__(self):
        self._spans: Dict[str, NormalizedSpan] = {}   # span_id → span (in-progress)
        self._final_output = None
        self._token_usage = None
        self._trace_id = None
        self._errors: List[str] = []

    def add_chunk(self, chunk: dict) -> "NormalizedTraceBuilder":
        """Fluent interface: builder.add_chunk(c1).add_chunk(c2)..."""
        chunk_type = chunk.get("data", {}).get("type")
        payload = chunk.get("data", {}).get("payload", {})

        if chunk_type == "trace":
            self._process_trace_chunk(payload)
        elif chunk_type in ("workflow", "agent", "llm_output"):
            pass  # Token streaming chunks — not needed for trace structure
        # ... other chunk types

        return self  # fluent

    def build(self) -> NormalizedTrace:
        """Produces the final immutable NormalizedTrace."""
        return NormalizedTrace(
            trace_id=self._trace_id or str(uuid.uuid4()),
            final_output=self._final_output,
            spans=list(self._spans.values()),
            token_usage=self._token_usage,
        )

    def _process_trace_chunk(self, payload: dict):
        span_id = payload.get("id")
        status = payload.get("status")

        if status == "start":
            span = NormalizedSpan(
                span_id=span_id,
                span_name=payload.get("name", ""),
                span_type="workflow_component",
                parent_span_id=payload.get("parent_id"),
                start_time_ms=self._iso_to_ms(payload.get("start_time")),
                end_time_ms=None,
                status="running",
                inputs=payload.get("inputs"),
                outputs=None,
                component_type=payload.get("component_type"),
            )
            self._spans[span_id] = span

        elif status == "finish":
            if span_id in self._spans:
                span = self._spans[span_id]
                span.end_time_ms = self._iso_to_ms(payload.get("end_time"))
                span.outputs = payload.get("outputs")
                span.status = "ok"
                # Track final output from the last finishing span with outputs
                if payload.get("outputs"):
                    self._final_output = payload["outputs"]
            else:
                # Finish chunk arrived without a corresponding start (rare but possible)
                span = NormalizedSpan(
                    span_id=span_id,
                    span_name=payload.get("name", ""),
                    span_type="workflow_component",
                    parent_span_id=payload.get("parent_id"),
                    start_time_ms=self._iso_to_ms(payload.get("start_time")),
                    end_time_ms=self._iso_to_ms(payload.get("end_time")),
                    status="ok",
                    inputs=payload.get("inputs"),
                    outputs=payload.get("outputs"),
                )
                self._spans[span_id] = span
```

---

### 3.10 Repository Pattern

**Where**: All database access in the connector service layer.

The connector configuration is stored in the DB and loaded by `ConnectorRepository`. This is a standard Repository pattern — the rest of the application never writes raw SQL; it calls repository methods.

```python
class ConnectorRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, connector_id: UUID) -> Optional[ConnectorModel]:
        result = await self._session.execute(
            select(ConnectorModel).where(ConnectorModel.id == connector_id)
        )
        return result.scalar_one_or_none()

    async def get_all_for_workspace(self, workspace_id: UUID) -> List[ConnectorModel]:
        result = await self._session.execute(
            select(ConnectorModel)
            .where(ConnectorModel.workspace_id == workspace_id)
            .order_by(ConnectorModel.created_at.desc())
        )
        return result.scalars().all()
```

---

### Pattern Summary Table

| Pattern | Where Used | Why |
|---|---|---|
| **Adapter** | Each `BaseConnector` implementation | Translates target system's API to AgentEval's interface |
| **Strategy** | `ExecutionStrategy` (SSE, Polling, Sync) | Different result-collection mechanisms per system |
| **Template Method** | `EvaluationHarness._execute_trial()` | Algorithm skeleton fixed; execution step varies |
| **Factory / Registry** | `ConnectorRegistry.get()` | Creates correct connector class from DB config |
| **Circuit Breaker** | `CircuitBreaker` wrapping connector HTTP calls | Fail fast when target system is down |
| **Decorator** | `@with_retry` on HTTP methods | Adds retry/backoff without polluting core logic |
| **Observer / Pub-Sub** | Redis + SSE for run progress events | Worker ↔ web server ↔ browser decoupled event propagation |
| **Facade** | `OpenJiuwenConnector` class | Hides auth, SSE, normalization complexity behind 3 methods |
| **Builder** | `NormalizedTraceBuilder` | Incrementally assembles trace from stream of chunks |
| **Repository** | `ConnectorRepository`, `RunRepository`, etc. | Decouples DB access from business logic |

---

## 4. Mid-Level: Connector Internals

### Internal Class Structure of a Connector

```python
class OpenJiuwenConnector(BaseConnector):
    """
    Facade over all openJiuwen-specific sub-components.
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

        # Sub-components (each handles one concern)
        self._auth = OpenJiuwenAuthManager(
            base_url=config["base_url"],
            auth_config=config["auth_config"],      # decrypted before passed here
        )
        self._http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10.0, read=300.0, write=10.0),
            follow_redirects=True,
        )
        self._strategy = SSEStreamingStrategy()     # Strategy pattern
        self._normalizer = OpenJiuwenTraceNormalizer()
        self._circuit_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30)

        # From extra_config
        self._space_id: str = config["extra_config"]["space_id"]

    # ── Public interface (BaseConnector) ──────────────────────────────────────

    async def execute(self, target_type, target_id, version, inputs, conversation_id, timeout):
        endpoint = self._resolve_execute_endpoint(target_type)
        request_body = {
            "id": target_id,
            "version": version or "draft",
            "space_id": self._space_id,
            "conversation_id": conversation_id,
            "inputs": inputs,
        }
        headers = await self._auth.get_auth_headers()
        raw = await self._circuit_breaker.call(
            self._strategy.execute(self._http_client, endpoint, request_body, headers, timeout)
        )
        return self._normalizer.normalize(raw.chunks)

    async def list_targets(self, target_type: str) -> list:
        if target_type == "workflow":
            return await self._list_all_workflows()
        elif target_type == "agent":
            return await self._list_all_agents()
        raise ValueError(f"Unknown target_type: {target_type}")

    async def health_check(self) -> bool:
        try:
            headers = await self._auth.get_auth_headers()
            r = await self._http_client.get(
                f"{self.base_url}/api/v1/auth/verify_access_token",
                params={"token": await self._auth.get_raw_token()},
                timeout=10,
            )
            return r.status_code == 200
        except Exception:
            return False

    # ── Private helpers ───────────────────────────────────────────────────────

    def _resolve_execute_endpoint(self, target_type: str) -> str:
        endpoints = {
            "workflow": f"{self.base_url}/api/v1/execution/workflow",
            "agent": f"{self.base_url}/api/v1/execution/agent",
        }
        if target_type not in endpoints:
            raise ValueError(f"openJiuwen connector does not support target_type='{target_type}'")
        return endpoints[target_type]

    @with_retry(max_attempts=3, backoff_base=0.5)
    async def _list_all_workflows(self) -> list:
        """Paginate through all workflows, collecting all pages."""
        all_workflows = []
        page = 1
        while True:
            headers = await self._auth.get_auth_headers()
            response = await self._http_client.post(
                f"{self.base_url}/api/v1/workflows/list",
                json={"space_id": self._space_id, "page": page, "page_size": 50},
                headers=headers,
            )
            response.raise_for_status()
            body = response.json()
            workflows = body.get("data", {}).get("list", [])
            if not workflows:
                break
            all_workflows.extend([
                TargetInfo(
                    id=w["workflow_id"],
                    name=w["name"],
                    version=w.get("version"),
                    metadata={"status": w.get("status"), "description": w.get("description")},
                )
                for w in workflows
            ])
            if len(workflows) < 50:
                break
            page += 1
        return all_workflows

    @property
    def system_type(self) -> str:
        return "openjiuwen"
```

### Component Decomposition

```
OpenJiuwenConnector
├── OpenJiuwenAuthManager        — Token lifecycle (login, cache, refresh)
├── SSEStreamingStrategy         — Sends POST, reads SSE stream, returns raw chunks
├── OpenJiuwenTraceNormalizer    — Converts chunks → NormalizedTrace (uses Builder)
│     └── NormalizedTraceBuilder — Stateful trace construction
└── CircuitBreaker               — Wraps all HTTP calls
```

---

## 5. The Normalized Trace Contract

The `NormalizedTrace` is the contract between the connector layer and the evaluation engine. Once you understand this contract, you understand how the whole system hangs together.

### Data Model

```python
@dataclass
class NormalizedTrace:
    trace_id: str
    final_output: Optional[Any]          # The final output dict from the execution
    spans: List[NormalizedSpan]          # All execution steps, in chronological order
    token_usage: Optional[Dict[str, int]] # {"prompt_tokens": N, "completion_tokens": N, "total_tokens": N}

@dataclass
class NormalizedSpan:
    span_id: str
    span_name: str                        # Human-readable name of the step
    span_type: str                        # 'workflow_component', 'llm_call', 'tool_call', 'agent_step'
    parent_span_id: Optional[str]         # For building parent-child tree
    start_time_ms: Optional[int]          # Milliseconds since epoch
    end_time_ms: Optional[int]
    status: str                           # 'ok', 'error', 'running', 'interrupted'
    inputs: Optional[Dict]
    outputs: Optional[Dict]
    component_type: Optional[int]         # Integer from the target system (used by PatternValidator)
    attributes: Dict[str, Any]           # Any extra metadata
```

### How Graders Use the Trace

```
NormalizedTrace.final_output  ←── output_check, state_check graders read here
NormalizedTrace.spans         ←── tool_call_check, transcript_check graders read here
NormalizedTrace.spans[].component_type ←── PatternValidator reads here
```

### How Pattern Validation Uses component_type

The `PatternValidator` uses `span.component_type` to detect workflow patterns. For openJiuwen specifically, the integer values match openJiuwen's internal component type enum:

| component_type | openJiuwen Component | Pattern it enables |
|---|---|---|
| `4` | IF (branch) | `ROUTING` |
| `5` | LOOP | `EVALUATOR_OPTIMIZER` |
| `14` | SubWorkflow | `ORCHESTRATOR_WORKER` |
| `15` | SetVariable | `MEMORY_USAGE` |
| `18` | VariableMerge | `MEMORY_USAGE` |

For connectors where `component_type` is not available (e.g., Generic HTTP), pattern validation degrades gracefully — it uses structural heuristics (span count, time overlaps) instead.

---

## 6. Low-Level: openJiuwen Connector — Complete Spec

### 6.1 Authentication Flow

openJiuwen uses JWT-based auth with username/password login. The connector must:
1. Authenticate with username/password to get a JWT access token + refresh token
2. Cache the tokens in memory
3. Attach the access token to every API request via `Authorization: Bearer <token>`
4. Detect token expiry (401 response) and automatically refresh

**Login Endpoint**

```
POST {base_url}/api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

username=<email>&password=<password>
```

Note: This uses OAuth2 `PasswordRequestForm` encoding — form-encoded, NOT JSON.

**Login Response**

```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
        "user_id_str": "user-uuid",
        "email": "user@example.com",
        "username": "user@example.com",
        "screen_name": "User Name",
        "role_type": "COMMON_USER"
    }
}
```

**AuthManager Implementation**

```python
# agenteval/connectors/openjiuwen/auth.py

class OpenJiuwenAuthManager:
    """
    Manages JWT token lifecycle for the openJiuwen connector.

    Responsibilities:
    - Login with username/password
    - Cache tokens in memory
    - Detect expiry and refresh proactively
    - Handle 401 responses by re-authenticating
    """

    _EXPIRY_MARGIN_SECONDS = 120  # Refresh this many seconds before actual expiry

    def __init__(self, base_url: str, auth_config: dict):
        self._base_url = base_url
        self._auth_config = auth_config
        # auth_config = {
        #   "type": "password",
        #   "username": "admin@example.com",
        #   "password": "<decrypted>",
        # }
        # OR for pre-provided token (no auto-refresh):
        # {
        #   "type": "bearer",
        #   "token": "<jwt>",
        # }
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._token_expiry: Optional[float] = None  # Unix timestamp
        self._lock = asyncio.Lock()  # Prevents concurrent token refreshes

    async def get_auth_headers(self) -> dict:
        """Returns ready-to-use Authorization headers. Refreshes token if needed."""
        token = await self.get_raw_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def get_raw_token(self) -> str:
        """Returns a valid access token, refreshing if needed."""
        async with self._lock:
            # Check if we have a valid token
            if self._access_token and self._token_expiry:
                if time.time() < self._token_expiry - self._EXPIRY_MARGIN_SECONDS:
                    return self._access_token
            # Need to authenticate or refresh
            await self._authenticate()
            return self._access_token

    async def handle_401(self):
        """
        Called when a request returns 401. Forces re-authentication.
        The lock prevents multiple concurrent re-auth attempts.
        """
        async with self._lock:
            # Reset token state
            self._access_token = None
            self._token_expiry = None
            await self._authenticate()

    async def _authenticate(self):
        """Performs login or token refresh. Called inside the lock."""
        auth_type = self._auth_config.get("type", "password")

        if auth_type == "bearer":
            # Pre-provided static token — no auto-refresh possible
            self._access_token = self._auth_config["token"]
            self._token_expiry = None  # Don't auto-refresh
            return

        # Try refresh token first (cheaper than full re-login)
        if self._refresh_token:
            try:
                await self._do_refresh()
                return
            except Exception:
                # Refresh failed — fall through to full login
                self._refresh_token = None

        # Full login
        await self._do_login()

    async def _do_login(self):
        """POST /api/v1/auth/login — form-encoded, not JSON."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/api/v1/auth/login",
                data={
                    "username": self._auth_config["username"],
                    "password": self._auth_config["password"],
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )
            response.raise_for_status()
            body = response.json()

        self._access_token = body["access_token"]
        self._refresh_token = body.get("refresh_token")
        self._token_expiry = self._decode_expiry(self._access_token)

    async def _do_refresh(self):
        """POST /api/v1/auth/refresh — JSON body with refreshToken key."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/api/v1/auth/refresh",
                json={"refreshToken": self._refresh_token},
                timeout=30,
            )
            response.raise_for_status()
            body = response.json()

        new_token = body["data"]["token"]
        self._access_token = new_token
        self._token_expiry = self._decode_expiry(new_token)

    def _decode_expiry(self, token: str) -> Optional[float]:
        """
        Decode JWT expiry without verification (we trust the server).
        Returns Unix timestamp of expiry, or None if not present.
        """
        try:
            # JWT payload is base64url-encoded middle segment
            parts = token.split(".")
            if len(parts) != 3:
                return None
            # Add padding if needed
            payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            return float(payload.get("exp", 0)) or None
        except Exception:
            return None
```

---

### 6.2 Token Lifecycle Management

The diagram below shows the full token lifecycle:

```
connector.execute(...)
       │
       ▼
auth_manager.get_auth_headers()
       │
       ├─ Token valid (not expired)? ──YES──► return {"Authorization": "Bearer <token>"}
       │
       └─ Token missing/expired? ──────────────────────────────────────────►
              │
              ├─ Have refresh_token? ──YES──► POST /auth/refresh ──SUCCESS──► update token
              │                                                   └─FAIL───► fall through
              │
              └─ Do full login ──► POST /auth/login ──► store access_token + refresh_token


                    After any request:
                         │
                 response.status_code == 401?
                         │
                         YES ──► auth_manager.handle_401()
                                      └──► force re-login
                                      └──► retry original request ONCE
```

**Retry on 401 — this is critical**: The connector must implement a "retry once after re-auth" pattern:

```python
async def _make_authenticated_request(self, method, url, **kwargs) -> httpx.Response:
    """
    Executes an HTTP request with automatic 401 retry after token refresh.
    """
    for attempt in range(2):  # max 2 attempts: original + one retry after re-auth
        headers = await self._auth.get_auth_headers()
        kwargs["headers"] = headers
        response = await getattr(self._http_client, method)(url, **kwargs)

        if response.status_code == 401 and attempt == 0:
            # Token rejected — force re-authentication and retry
            await self._auth.handle_401()
            continue  # retry

        response.raise_for_status()
        return response

    # Should not reach here normally
    raise AuthenticationError("Failed to authenticate after token refresh")
```

---

### 6.3 Listing Workflows and Agents

**List Workflows**

```
POST {base_url}/api/v1/workflows/list
Authorization: Bearer <token>
Content-Type: application/json

{
    "space_id": "<space-id>",
    "page": 1,
    "page_size": 50,
    "status": "published"
}
```

The `status` field can be `"published"`, `"draft"`, or omitted (returns all).

**Response**:
```json
{
    "code": 200,
    "message": "success",
    "data": {
        "list": [
            {
                "workflow_id": "wf-uuid",
                "name": "My Calculator Workflow",
                "description": "Adds two numbers",
                "status": "published",
                "version": "1",
                "create_time": 1234567890,
                "update_time": 1234567890
            }
        ],
        "total": 42,
        "page": 1,
        "page_size": 50
    }
}
```

**Pagination strategy**: Keep incrementing `page` until `len(list) < page_size`.

**List Agents**

```
POST {base_url}/api/v1/agents/list
Authorization: Bearer <token>
Content-Type: application/json

{
    "space_id": "<space-id>",
    "page": 1,
    "page_size": 50
}
```

**Response structure**: Same shape as workflow list, with `agent_id` instead of `workflow_id`, plus `type` ("react" or "workflow").

**Mapping to `TargetInfo`**:

```python
@dataclass
class TargetInfo:
    id: str             # workflow_id or agent_id
    name: str           # display name
    version: Optional[str]   # published version number, or None for draft
    target_type: str    # "workflow" or "agent"
    metadata: dict      # additional info for UI display

# Workflow mapping
TargetInfo(
    id=w["workflow_id"],
    name=w["name"],
    version=w.get("version"),
    target_type="workflow",
    metadata={
        "description": w.get("description", ""),
        "status": w.get("status"),
        "create_time": w.get("create_time"),
    }
)
```

---

### 6.4 Executing a Workflow or Agent

**Execute Workflow — SSE Request**

```
POST {base_url}/api/v1/execution/workflow
Authorization: Bearer <token>
Content-Type: application/json
Accept: text/event-stream

{
    "id": "<workflow_id>",
    "version": "published",
    "space_id": "<space-id>",
    "conversation_id": "eval_<run_id>_<task_id>_t1_<uuid8>",
    "inputs": {
        "a": 2,
        "b": 4
    }
}
```

**Key points**:
- `version` must be `"published"` or `"draft"`. Use `"published"` for released workflows; `"draft"` for workflows being tested.
- `conversation_id` must be unique per trial. Format: `eval_{run_id}_{task_id}_t{trial_num}_{8_random_chars}`. This prevents execution conflicts (openJiuwen rejects concurrent executions with the same conversation_id).
- `inputs` keys must match the workflow's input parameter names exactly. Mismatched keys cause silent failures (openJiuwen will use defaults or empty values).

**Execute Agent — SSE Request**

```
POST {base_url}/api/v1/execution/agent
Authorization: Bearer <token>
Content-Type: application/json
Accept: text/event-stream

{
    "id": "<agent_id>",
    "version": "published",
    "space_id": "<space-id>",
    "conversation_id": "eval_<run_id>_<task_id>_t1_<uuid8>",
    "inputs": {
        "user_input": "What is 2 + 4?"
    }
}
```

Note: Agent inputs have a single key (typically `user_input` or as configured in the agent). Unlike workflows, agents process natural language.

**SSE Stream Connection**

The correct way to read an SSE stream using httpx:

```python
async def _stream_sse(
    self,
    url: str,
    request_body: dict,
    headers: dict,
    timeout_seconds: int,
) -> List[dict]:
    """
    Opens an SSE connection, reads all events, returns them as a list.

    SSE format:
        data: {"code": 200, "message": "...", "data": {"type": "...", "payload": {...}}}
        data: {"code": 200, ...}
        ...
        (connection closes when server is done)
    """
    chunks = []
    try:
        async with self._http_client.stream(
            "POST",
            url,
            json=request_body,
            headers={**headers, "Accept": "text/event-stream"},
            timeout=httpx.Timeout(connect=10.0, read=timeout_seconds, write=10.0),
        ) as response:
            if response.status_code == 401:
                raise AuthenticationError("401 Unauthorized during SSE stream")
            response.raise_for_status()

            async for raw_line in response.aiter_lines():
                raw_line = raw_line.strip()
                if not raw_line:
                    continue  # SSE allows blank lines as keepalives
                if raw_line.startswith("data:"):
                    data_str = raw_line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        parsed = json.loads(data_str)
                        chunks.append(parsed)
                    except json.JSONDecodeError:
                        logger.warning(f"Could not parse SSE data line: {data_str[:100]}")

    except httpx.ReadTimeout:
        raise ExecutionTimeoutError(f"Execution timed out after {timeout_seconds}s")
    except httpx.ConnectError as e:
        raise ConnectorConnectionError(f"Could not connect to openJiuwen at {url}: {e}")

    return chunks
```

---

### 6.5 Parsing the SSE Stream

Each line from the SSE stream is a JSON object with this envelope:

```json
{
    "code": 200,
    "message": "Executed successfully",
    "data": {
        "type": "<chunk_type>",
        "payload": { ... }
    }
}
```

**All Chunk Types and What to Do with Them**

| `data.type` | Payload structure | Action in normalizer |
|---|---|---|
| `"trace"` with `status="start"` | `{id, name, status, inputs, start_time, parent_id, component_type?, ...}` | Create pending `NormalizedSpan` |
| `"trace"` with `status="finish"` | `{id, name, status, outputs, start_time, end_time, parent_id, ...}` | Complete the span, capture outputs |
| `"trace"` with error | `{id, error: {code: message}}` | Mark span as error status |
| `"workflow"` | `{node_id, node_name, output, index}` | Streaming output chunk — ignore for trace |
| `"agent"` | `{output, index}` | Agent token stream — ignore for trace |
| `"llm_output"` | `{output, index}` | LLM token stream — ignore for trace |
| `"output"` | `{node_id, node_name, output, index}` | Node streaming — ignore for trace |
| `"end node stream"` | `{output, node_id="end_0", result_type="answer"}` | This IS the final answer output |
| `"workflow_final"` | `{output: {...}}` | Also contains final output; prefer this |
| `"interaction"` | `{interaction_node, interaction_msg}` | Human-in-the-loop pause — harness handles this |
| error `code != 200` | `{type: "trace", payload: {id, error}}` | Execution failed |

**How to Extract `final_output`**

This is the trickiest part. openJiuwen sends final output in two ways depending on the workflow type:

```python
def _extract_final_output(self, chunks: List[dict]) -> Optional[Any]:
    """
    Extracts the final output from the stream.

    Priority order:
    1. Look for a "trace" chunk with status="finish" on the END node (node name contains "end" or node_id="end_0")
    2. Look for "workflow_final" chunk
    3. Look for "end node stream" chunk with result_type="answer"
    4. Fall back to the last "trace" chunk with status="finish" that has outputs
    """
    end_trace_output = None
    workflow_final_output = None
    end_stream_output = None
    last_finish_output = None

    for chunk in chunks:
        if chunk.get("code") != 200:
            continue
        data = chunk.get("data", {})
        chunk_type = data.get("type")
        payload = data.get("payload", {})

        if chunk_type == "trace" and payload.get("status") == "finish":
            outputs = payload.get("outputs")
            if outputs:
                last_finish_output = outputs
                # Check if this is the End node (heuristic: name or id)
                node_id = payload.get("id", "")
                node_name = payload.get("name", "").lower()
                if "end" in node_name or node_id.startswith("end"):
                    end_trace_output = outputs

        elif chunk_type == "workflow_final":
            raw = payload.get("output")
            if isinstance(raw, dict):
                workflow_final_output = raw.get("response") or raw  # unwrap if nested

        elif chunk_type == "end node stream":
            result_type = payload.get("result_type")
            if result_type == "answer":
                end_stream_output = payload.get("output")

    return (
        end_trace_output
        or workflow_final_output
        or end_stream_output
        or last_finish_output
    )
```

**How to Extract Token Usage**

openJiuwen does not currently emit a dedicated `"usage"` chunk in the main execution stream. Token usage is tracked separately and accessible via trace summary endpoints. For the connector, there are two approaches:

1. **Estimate from trace chunks**: Count LLM spans and sum their token attributes (not always present)
2. **Fetch post-execution**: After the SSE stream closes, call `POST /api/v1/execution/get_latest_trace_summary` with the workflow/agent ID to get the trace with token counts

```python
async def _fetch_token_usage_from_trace(self, trace_id: str) -> Optional[Dict[str, int]]:
    """
    After execution, fetch the trace summary to get token usage.
    Called after the SSE stream closes.
    """
    try:
        headers = await self._auth.get_auth_headers()
        response = await self._http_client.post(
            f"{self.base_url}/api/v1/execution/get_trace_summary_by_trace_id",
            json={"trace_id": trace_id, "space_id": self._space_id},
            headers=headers,
            timeout=15,
        )
        body = response.json()
        summary = body.get("data", {})
        input_tokens = summary.get("input_tokens") or 0
        output_tokens = summary.get("output_tokens") or 0
        return {
            "prompt_tokens": input_tokens,
            "completion_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
        } if (input_tokens or output_tokens) else None
    except Exception:
        return None
```

**How to Extract trace_id**

The trace_id is embedded in the trace chunks. Extract it from the first `"trace"` chunk:

```python
def _extract_trace_id(self, chunks: List[dict]) -> Optional[str]:
    for chunk in chunks:
        data = chunk.get("data", {})
        if data.get("type") == "trace":
            payload = data.get("payload", {})
            # openJiuwen sets the trace_id in the payload id field at the root level
            # This is the business_id / execution trace root
            tid = payload.get("trace_id") or payload.get("id")
            if tid:
                return tid
    return None
```

---

### 6.6 Building the NormalizedTrace

Full implementation of `OpenJiuwenTraceNormalizer`:

```python
# agenteval/connectors/openjiuwen/trace_normalizer.py

class OpenJiuwenTraceNormalizer:
    """
    Converts a list of raw openJiuwen SSE chunks into a NormalizedTrace.

    Uses the Builder pattern internally.
    """

    def normalize(self, chunks: List[dict]) -> NormalizedTrace:
        builder = NormalizedTraceBuilder()

        for chunk in chunks:
            if chunk.get("code") != 200:
                # Error chunk — may still carry partial trace info
                builder.add_error_chunk(chunk)
                continue

            data = chunk.get("data", {})
            chunk_type = data.get("type")
            payload = data.get("payload", {})

            if chunk_type == "trace":
                builder.add_trace_chunk(payload)
            elif chunk_type in ("workflow_final",):
                builder.set_workflow_final(payload)
            elif chunk_type == "end node stream":
                if payload.get("result_type") == "answer":
                    builder.set_end_stream_output(payload.get("output"))

        return builder.build()
```

**Complete `NormalizedTraceBuilder` for openJiuwen**:

```python
class NormalizedTraceBuilder:

    # openJiuwen component type integer → semantic label
    # These constants come from openJiuwen_studio/core/common/dsl.py
    _COMPONENT_TYPE_MAP = {
        1: "start",
        2: "end",
        3: "llm",
        4: "if_branch",       # ROUTING
        5: "loop",            # EVALUATOR_OPTIMIZER
        6: "code",
        7: "knowledge_retrieval",
        8: "text_processing",
        9: "questioner",
        14: "sub_workflow",   # ORCHESTRATOR_WORKER
        15: "set_variable",   # MEMORY_USAGE
        16: "user_input",
        17: "user_output",
        18: "variable_merge", # MEMORY_USAGE
    }

    def add_trace_chunk(self, payload: dict):
        span_id = payload.get("id")
        status = payload.get("status")
        if not span_id:
            return

        if status == "start":
            span = NormalizedSpan(
                span_id=span_id,
                span_name=payload.get("name", ""),
                span_type="workflow_component",
                parent_span_id=payload.get("parent_id"),
                start_time_ms=self._parse_time(payload.get("start_time")),
                end_time_ms=None,
                status="running",
                inputs=payload.get("inputs"),
                outputs=None,
                component_type=payload.get("component_type"),
                attributes={
                    "loop_index": payload.get("loop_index"),
                    "description": payload.get("description"),
                    "version": payload.get("version"),
                },
            )
            self._spans[span_id] = span

        elif status == "finish":
            if span_id in self._spans:
                span = self._spans[span_id]
                span.end_time_ms = self._parse_time(payload.get("end_time"))
                span.status = "ok"
                span.outputs = payload.get("outputs")
                # Track final output from End node
                if payload.get("outputs"):
                    self._last_finish_output = payload["outputs"]
                node_name_lower = span.span_name.lower()
                if "end" in node_name_lower or span_id.startswith("end"):
                    self._end_node_output = payload.get("outputs")
            else:
                # Finish without prior start — create complete span
                span = NormalizedSpan(
                    span_id=span_id,
                    span_name=payload.get("name", ""),
                    span_type="workflow_component",
                    parent_span_id=payload.get("parent_id"),
                    start_time_ms=self._parse_time(payload.get("start_time")),
                    end_time_ms=self._parse_time(payload.get("end_time")),
                    status="ok",
                    inputs=payload.get("inputs"),
                    outputs=payload.get("outputs"),
                    component_type=payload.get("component_type"),
                )
                self._spans[span_id] = span

        # Extract trace_id from the first trace chunk at the root level (no parent)
        if self._trace_id is None and payload.get("parent_id") is None:
            self._trace_id = span_id

    def _parse_time(self, time_str: Optional[str]) -> Optional[int]:
        """Convert ISO8601 datetime string to milliseconds since epoch."""
        if not time_str:
            return None
        try:
            dt = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        except (ValueError, TypeError):
            return None
```

**Handling Error Chunks**

```python
def add_error_chunk(self, chunk: dict):
    """
    openJiuwen error format:
    {
        "code": <error_code>,
        "message": "error description",
        "data": {"type": "trace", "payload": {"id": "...", "error": {<code>: "message"}}}
    }
    """
    data = chunk.get("data", {})
    payload = data.get("payload", {})
    span_id = payload.get("id")
    error_info = payload.get("error", {})

    if span_id and span_id in self._spans:
        self._spans[span_id].status = "error"
        self._spans[span_id].attributes["error"] = error_info
    elif span_id:
        span = NormalizedSpan(
            span_id=span_id,
            span_name=payload.get("name", "error"),
            span_type="workflow_component",
            parent_span_id=None,
            start_time_ms=None,
            end_time_ms=None,
            status="error",
            inputs=None,
            outputs=None,
            attributes={"error": error_info, "error_message": chunk.get("message")},
        )
        self._spans[span_id] = span

    self._execution_error = chunk.get("message", str(error_info))
```

---

### 6.7 Error Handling and Edge Cases

**Complete error taxonomy for the openJiuwen connector**:

| Scenario | HTTP Status | Behavior |
|---|---|---|
| Wrong credentials | 401 on login | `AuthenticationError("Login failed: incorrect username or password")` |
| Token expired mid-stream | 401 during SSE | Re-auth + retry the SSE request once |
| openJiuwen is down | `ConnectError` | Circuit breaker records failure; `ConnectorConnectionError` raised |
| Execution timeout | SSE read timeout | `ExecutionTimeoutError(f"Execution timed out after {timeout}s")` |
| Workflow not found | 400 or 404 | `TargetNotFoundError(f"Workflow {target_id} not found")` |
| Concurrent execution conflict | 400 from openJiuwen | Unique `conversation_id` prevents this; if it happens, log and retry with new ID |
| Empty stream (no chunks) | — | Return `ExecutionResult(error="Empty response — no chunks received")` |
| Error in stream (`code != 200`) | — | Extract error message from error chunk; mark execution as failed |
| Space ID mismatch | 403 | `AuthorizationError(f"Space {space_id} access denied")` |

**Detecting execution errors in the stream**:

```python
def _check_for_execution_error(self, chunks: List[dict]) -> Optional[str]:
    """
    openJiuwen may complete the SSE stream but include error chunks.
    Check if any chunk signals execution failure.
    """
    for chunk in chunks:
        code = chunk.get("code", 200)
        if code != 200:
            return chunk.get("message", f"Execution error (code {code})")

        data = chunk.get("data", {})
        payload = data.get("payload", {})
        error = payload.get("error")
        if error:
            # error is a dict like {4001: "workflow node execution failed"}
            if isinstance(error, dict):
                return next(iter(error.values()), "Unknown execution error")
            return str(error)
    return None
```

**Handling the "interaction" chunk (human-in-the-loop)**:

If a workflow contains a `user_input` component (questioner node), the SSE stream will emit an `"interaction"` chunk and wait for input. In an automated evaluation context, this is a blocker — the evaluation cannot proceed.

```python
if chunk_type == "interaction":
    # This workflow requires human interaction.
    # For evaluation purposes, fail the trial with a clear message.
    raise ExecutionBlockedError(
        f"Workflow requires human interaction at node "
        f"'{payload.get('interaction_node')}'. "
        "Workflows with interactive components cannot be automatically evaluated. "
        "Remove questioner/user-input nodes before evaluating."
    )
```

---

## 7. Resilience Patterns

### Full Resilience Stack

Every outbound HTTP call goes through these layers in order:

```
connector.execute(...)
     │
     ▼
CircuitBreaker.call(...)           ← Fail fast if system is down
     │
     ▼
@with_retry(max_attempts=3)        ← Retry transient failures (429, 502, 503, timeouts)
     │
     ▼
_make_authenticated_request(...)   ← Handle 401 with re-auth + retry
     │
     ▼
httpx.AsyncClient.stream(...)      ← Actual HTTP call with timeout configured
```

### Timeout Configuration

```python
httpx.Timeout(
    connect=10.0,           # Time to establish TCP connection
    read=task.timeout_seconds,  # Time to read response (must be long for slow agents)
    write=10.0,             # Time to write request body
    pool=5.0,               # Time to acquire connection from pool
)
```

The `read` timeout is set from the task's `timeout_seconds` field (default 300s). This prevents the worker from hanging indefinitely on a slow/stuck workflow.

### Connector Health Check Integration

Before starting a run, the harness calls `connector.health_check()` and fails early if the system is unreachable:

```python
async def execute_run(self, run, tasks, connector):
    is_healthy = await connector.health_check()
    if not is_healthy:
        await self._mark_run_failed(run.id, "Connector health check failed — target system unreachable")
        return

    # ... proceed with execution
```

---

## 8. Adding a New Connector (Generic HTTP)

To add a connector for any new system, implement `BaseConnector` and register it:

```python
# agenteval/connectors/generic_http/connector.py

@register("generic_http")
class GenericHTTPConnector(BaseConnector):
    """
    A flexible connector for any HTTP-based system.
    The user configures it via extra_config at setup time.

    extra_config example:
    {
        "execute_workflow_path": "/api/invoke",
        "list_workflows_path": "/api/workflows",
        "result_field": "output",             ← JSON path to final output in response
        "strategy": "sync",                   ← "sync", "sse", "polling"
        "id_field": "workflow_id",            ← field name in the list response
        "name_field": "name"
    }
    """

    def __init__(self, config: dict):
        super().__init__(config)
        extra = config.get("extra_config", {})
        strategy_name = extra.get("strategy", "sync")
        self._strategy = {
            "sync": SynchronousStrategy,
            "sse": SSEStreamingStrategy,
            "polling": PollingStrategy,
        }[strategy_name]()
        self._normalizer = GenericHTTPTraceNormalizer(result_field=extra.get("result_field", "output"))

    async def execute(self, target_type, target_id, version, inputs, conversation_id, timeout):
        path = self.config["extra_config"].get("execute_workflow_path", "/invoke")
        raw = await self._strategy.execute(
            self._http_client,
            f"{self.base_url}{path}",
            {"id": target_id, "inputs": inputs},
            await self._build_headers(),
            timeout,
        )
        return self._normalizer.normalize(raw.chunks)

    async def list_targets(self, target_type):
        path = self.config["extra_config"].get("list_workflows_path", "/workflows")
        r = await self._http_client.get(f"{self.base_url}{path}", headers=await self._build_headers())
        r.raise_for_status()
        items = r.json()
        id_field = self.config["extra_config"].get("id_field", "id")
        name_field = self.config["extra_config"].get("name_field", "name")
        return [TargetInfo(id=item[id_field], name=item[name_field], target_type=target_type) for item in items]

    async def health_check(self):
        try:
            r = await self._http_client.get(f"{self.base_url}/health", timeout=5)
            return r.status_code < 400
        except Exception:
            return False

    @property
    def system_type(self):
        return "generic_http"
```

**The `GenericHTTPTraceNormalizer`** produces a minimal `NormalizedTrace` with one span (the whole execution), since generic HTTP systems typically don't expose internal execution spans:

```python
class GenericHTTPTraceNormalizer:
    def normalize(self, chunks: List[dict]) -> NormalizedTrace:
        final_output = None
        for chunk in chunks:
            # Traverse the result_field path (e.g., "output" or "data.result")
            final_output = self._extract(chunk, self._result_field)
            if final_output is not None:
                break

        return NormalizedTrace(
            trace_id=str(uuid.uuid4()),
            final_output=final_output,
            spans=[
                NormalizedSpan(
                    span_id="execution",
                    span_name="execution",
                    span_type="execution",
                    parent_span_id=None,
                    start_time_ms=None,
                    end_time_ms=None,
                    status="ok" if final_output is not None else "error",
                    inputs=None,
                    outputs=final_output,
                )
            ],
        )
```

---

## 9. Testing the Integration Layer

### Test Architecture

```
tests/
├── unit/
│   ├── connectors/
│   │   ├── test_base_connector.py
│   │   ├── openjiuwen/
│   │   │   ├── test_auth_manager.py       ← Test login, refresh, expiry
│   │   │   ├── test_trace_normalizer.py   ← Test chunk → NormalizedTrace
│   │   │   └── test_connector.py          ← Test execute(), list_targets()
│   │   └── generic_http/
│   │       └── test_generic_http_connector.py
│   ├── engine/
│   │   ├── test_grader_engine.py
│   │   ├── test_metrics.py
│   │   └── test_pattern_validator.py
│   └── strategies/
│       └── test_execution_strategies.py
├── integration/
│   └── test_openjiuwen_connector.py       ← Requires live openJiuwen instance
└── fixtures/
    ├── openjiuwen_sse_chunks.json         ← Real SSE chunk sequences for unit tests
    ├── openjiuwen_workflow_list.json
    └── openjiuwen_agent_list.json
```

### Unit Testing the Normalizer with Fixture Data

The core normalization logic should be tested with real SSE chunk sequences captured from openJiuwen. Store them as JSON fixtures:

```python
# tests/unit/connectors/openjiuwen/test_trace_normalizer.py

@pytest.fixture
def calculator_workflow_chunks():
    with open("tests/fixtures/openjiuwen_calculator_chunks.json") as f:
        return json.load(f)

def test_normalize_calculator_workflow(calculator_workflow_chunks):
    normalizer = OpenJiuwenTraceNormalizer()
    trace = normalizer.normalize(calculator_workflow_chunks)

    assert trace.final_output is not None
    assert "result" in trace.final_output
    assert len(trace.spans) >= 2    # At least Start + End nodes
    # Check all spans have span_id set
    assert all(s.span_id for s in trace.spans)
    # Check start/end nodes
    start_spans = [s for s in trace.spans if "start" in s.span_name.lower()]
    assert len(start_spans) >= 1
```

### Unit Testing AuthManager

```python
def test_login_sends_form_encoded_request():
    auth_manager = OpenJiuwenAuthManager(
        base_url="http://localhost:8000",
        auth_config={"type": "password", "username": "test@test.com", "password": "pass"},
    )
    with respx.mock:
        respx.post("http://localhost:8000/api/v1/auth/login").mock(
            return_value=httpx.Response(200, json={
                "access_token": "test_token",
                "refresh_token": "refresh_token",
            })
        )
        token = asyncio.run(auth_manager.get_raw_token())

    assert token == "test_token"

def test_auto_refreshes_expired_token():
    """
    Given: An access_token that expired 5 minutes ago.
    When: get_raw_token() is called.
    Then: POST /auth/refresh is called; new token is returned.
    """
    auth_manager = OpenJiuwenAuthManager(...)
    auth_manager._access_token = "old_token"
    auth_manager._refresh_token = "refresh_token"
    auth_manager._token_expiry = time.time() - 300  # 5 min ago

    with respx.mock:
        respx.post(".../auth/refresh").mock(
            return_value=httpx.Response(200, json={
                "code": 200, "data": {"token": "new_token"}
            })
        )
        token = asyncio.run(auth_manager.get_raw_token())

    assert token == "new_token"
```

### Integration Test (Requires Live openJiuwen)

```python
# tests/integration/test_openjiuwen_connector.py
# Run with: pytest tests/integration -m integration --jw-url http://localhost:8000

@pytest.mark.integration
class TestOpenJiuwenConnectorIntegration:

    @pytest.fixture(autouse=True)
    def connector(self, openjiuwen_url, openjiuwen_credentials):
        config = {
            "base_url": openjiuwen_url,
            "auth_config": {
                "type": "password",
                **openjiuwen_credentials,
            },
            "extra_config": {"space_id": openjiuwen_credentials["space_id"]},
        }
        return OpenJiuwenConnector(config)

    async def test_health_check(self, connector):
        assert await connector.health_check() is True

    async def test_list_workflows(self, connector):
        targets = await connector.list_targets("workflow")
        assert isinstance(targets, list)
        assert all(hasattr(t, "id") and hasattr(t, "name") for t in targets)

    async def test_execute_calculator_workflow(self, connector, published_calculator_workflow_id):
        result = await connector.execute(
            target_type="workflow",
            target_id=published_calculator_workflow_id,
            target_version="published",
            inputs={"a": 3, "b": 5},
            conversation_id="integration_test_001",
            timeout_seconds=60,
        )
        assert result.error is None
        assert result.final_output is not None
        assert result.normalized_trace is not None
        assert len(result.normalized_trace.spans) > 0
```

### Capturing Fixture Data from a Live System

Run this script against a live openJiuwen instance to capture real SSE chunks for use in unit tests:

```python
# scripts/capture_sse_fixture.py
"""
Captures raw SSE chunks from a live openJiuwen workflow execution.
Used to create test fixtures.

Usage:
    python scripts/capture_sse_fixture.py \
        --url http://localhost:8000 \
        --username admin@example.com \
        --password secret \
        --space-id abc123 \
        --workflow-id wf-def456 \
        --inputs '{"a": 2, "b": 4}' \
        --output tests/fixtures/calculator_chunks.json
"""
```

---

## 10. Sequence Diagrams

### Sequence 1: First-Time Authentication + Workflow Execution

```
AgentEval                    openJiuwen
  Harness         Connector    API Server
    │                 │             │
    │ execute(...)    │             │
    │────────────────►│             │
    │                 │             │
    │          [AuthManager: no token yet]
    │                 │             │
    │                 │ POST /auth/login (form-encoded)
    │                 │─────────────────────────────►│
    │                 │             │                │
    │                 │◄── 200 OK {access_token, refresh_token}
    │                 │             │
    │          [Store tokens in memory]
    │                 │             │
    │                 │ POST /api/v1/execution/workflow (SSE)
    │                 │─────────────────────────────►│
    │                 │             │                │
    │                 │◄── data: {type:"trace", payload:{id:"1", status:"start"}}
    │                 │◄── data: {type:"trace", payload:{id:"1", status:"finish", outputs:{...}}}
    │                 │◄── data: {type:"end node stream", payload:{result_type:"answer"}}
    │                 │◄── [connection closed]
    │                 │             │
    │          [NormalizedTraceBuilder.build()]
    │                 │             │
    │◄────────────────│             │
    │ ExecutionResult │             │
```

### Sequence 2: Token Expiry During Run (Mid-Trial Refresh)

```
    Harness         Connector     AuthManager    openJiuwen API
      │                 │              │               │
      │ execute()       │              │               │
      │────────────────►│              │               │
      │                 │ get_auth_headers()            │
      │                 │─────────────►│               │
      │                 │ [token expires in < 120s — refresh proactively]
      │                 │              │               │
      │                 │              │ POST /auth/refresh
      │                 │              │──────────────►│
      │                 │              │◄── 200 {token: "new_token"}
      │                 │              │               │
      │                 │◄──── {"Authorization": "Bearer new_token"}
      │                 │              │               │
      │                 │ POST /execution/workflow (with new token)
      │                 │─────────────────────────────►│
      │                 │◄── SSE stream ...             │
```

### Sequence 3: Circuit Breaker Opening and Recovery

```
    Harness     CircuitBreaker     openJiuwen API
      │               │                 │
   [Trial 1]          │                 │
      │ call(coro)    │                 │
      │──────────────►│                 │
      │               │ execute()       │
      │               │────────────────►│
      │               │◄── ConnectError │
      │               │ [failures=1]    │
      │◄── raise ConnectError           │
      │               │                 │
   [Trial 2]          │                 │
      │ call(coro)    │                 │
      │──────────────►│                 │
      │               │ execute()       │
      │               │────────────────►│
      │               │◄── ConnectError │
      │               │ [failures=2]    │
      │◄── raise ConnectError           │
      │               │                 │
   [Trial 3]          │                 │
      │ call(coro)    │                 │
      │──────────────►│                 │
      │               │ execute()       │
      │               │────────────────►│
      │               │◄── ConnectError │
      │               │ [failures=3 >= threshold → OPEN]
      │◄── raise ConnectError           │
      │               │                 │
  [30s passes]        │                 │
      │               │                 │
   [Trial 4]          │                 │
      │ call(coro)    │                 │
      │──────────────►│                 │
      │               │ [OPEN → HALF_OPEN, probe]
      │               │ execute()       │
      │               │────────────────►│
      │               │◄── 200 OK      │
      │               │ [HALF_OPEN → CLOSED, reset failures=0]
      │◄── ExecutionResult              │
```

### Sequence 4: Starting a Run (Full API + Worker Flow)

```
Browser        FastAPI        Celery        Redis         openJiuwen
   │              │            Worker         │              │
   │ POST /runs   │              │             │              │
   │─────────────►│              │             │              │
   │              │ Save run     │             │              │
   │              │ status=pending              │              │
   │              │              │             │              │
   │              │ publish task to queue       │              │
   │              │──────────────────────────►│              │
   │◄── 200 {run_id} │           │             │              │
   │              │              │             │              │
   │ GET /runs/{id}/stream (SSE) │             │              │
   │─────────────►│              │             │              │
   │              │ subscribe to redis channel  │              │
   │              │──────────────────────────►│              │
   │              │              │             │              │
   │              │  Worker picks up task      │              │
   │              │◄─────────────│             │              │
   │              │              │             │              │
   │              │              │ connector.execute()        │
   │              │              │────────────────────────────►│
   │              │              │             │              │
   │              │              │ publish("trial_started")   │
   │              │              │────────────►│              │
   │◄── data: {type:"trial_started", ...}      │              │
   │              │              │             │              │
   │              │              │◄── SSE stream             │
   │              │              │             │              │
   │              │              │ publish("trial_completed") │
   │              │              │────────────►│              │
   │◄── data: {type:"trial_completed", passed:true, score:1.0}│
   │              │              │             │              │
   │              │              │ [all tasks done]           │
   │              │              │             │              │
   │              │              │ publish("run_completed")   │
   │              │              │────────────►│              │
   │◄── data: {type:"run_completed", metrics:{...}}           │
   │              │              │             │              │
   │ GET /runs/{id}/results      │             │              │
   │─────────────►│              │             │              │
   │◄── 200 {metrics, task_results}            │              │
```

---

*End of AgentEval Integration Technical Specification*

**Document version**: 1.0
**Date**: 2026-03-17
**Related document**: `EVAL_PLATFORM_PLAN.md` (system architecture and build plan)
