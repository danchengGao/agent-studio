# Evaluation System — Documentation Index

Complete reference for all documentation covering the Agents & Workflows Evaluation System.

---

## For Different Audiences

### 👤 For Users — Understanding & Using the System

#### "I'm new to evaluation — where do I start?"
→ [03_User_Guide.md](03_User_Guide.md) — Full user documentation with glossary

#### "I want step-by-step instructions for a specific task"
→ [07_Cookbook.md](07_Cookbook.md) — Step-by-step recipes for common workflows

#### "I'm setting up graders and don't know which to use"
→ [04_Reference.md](04_Reference.md) — Task schema, grader config reference, and 10 ready-to-use presets

#### "I need to understand the task schema"
→ [04_Reference.md](04_Reference.md) — Task YAML schema, graders, and presets (all in one)

#### "I want to understand the Reliability tab"
→ [03_User_Guide.md §8](03_User_Guide.md) — Full explanation: Consistency, Robustness, Predictability, Safety dimensions + academic basis

#### "Something is broken / not working"
→ [08_Troubleshooting.md](08_Troubleshooting.md) — Systematic diagnosis and fixes

#### "I want to migrate from another evaluation system"
→ [10_Import_Guide.md](10_Import_Guide.md) — Migration from LangSmith, Promptfoo, OpenAI Evals, etc.

#### "I want to look up what a term means"
→ [09_Glossary.md](09_Glossary.md) — User glossary: every metric, concept, and option explained

---

### 🔧 For Developers — Implementation & Technical Details

#### "I need a system overview and architecture"
→ [dev/01_Overview.md](dev/01_Overview.md) — 10-minute system overview

#### "I'm implementing the Quick Setup wizard"
→ [dev/02_Getting_Started.md](dev/02_Getting_Started.md) — Quick setup wizard specification

#### "I'm a developer implementing the UI"
→ [dev/05_UI_Component_Specs.md](dev/05_UI_Component_Specs.md) — Component specs with TypeScript interfaces
→ [dev/04_Accessibility_Plan.md](dev/04_Accessibility_Plan.md) — Full UX improvement plan

#### "I need developer reference for UI text and tooltips"
→ [dev/06_Help_Text_Dictionary.md](dev/06_Help_Text_Dictionary.md) — Developer reference: 100+ tooltip texts and definitions

#### "I want to make tutorial videos"
→ [dev/07_Video_Scripts.md](dev/07_Video_Scripts.md) — 8 complete word-for-word scripts

---

## All Documents

### User Documentation

| File | Purpose | Audience | Length |
|------|---------|---------|--------|
| [03_User_Guide.md](03_User_Guide.md) | Complete user documentation | Users | Long |
| [04_Reference.md](04_Reference.md) | Task schema, grader config, 10 presets | Users/Devs | Medium |
| [07_Cookbook.md](07_Cookbook.md) | Step-by-step recipes for common scenarios | Users | Very Long |
| [08_Troubleshooting.md](08_Troubleshooting.md) | Common errors + fixes | All | Medium |
| [09_Glossary.md](09_Glossary.md) | Glossary of every metric, concept, and option | Users | Short |
| [10_Import_Guide.md](10_Import_Guide.md) | Migrating benchmarks from other systems | Users | Medium |

### Developer / Internal Docs (`dev/` folder)

| File | Purpose | Audience | Length |
|------|---------|---------|--------|
| [dev/01_Overview.md](dev/01_Overview.md) | System overview, architecture, key concepts | All | Short |
| [dev/02_Getting_Started.md](dev/02_Getting_Started.md) | Quick setup wizard specification | Users / UX | Short |
| [dev/04_Accessibility_Plan.md](dev/04_Accessibility_Plan.md) | 12-week UX improvement plan | PMs/UX/Devs | Long |
| [dev/05_UI_Component_Specs.md](dev/05_UI_Component_Specs.md) | Component specs + TypeScript interfaces | Frontend | Long |
| [dev/06_Help_Text_Dictionary.md](dev/06_Help_Text_Dictionary.md) | 100+ tooltip texts and metric definitions | Frontend/Content | Long |
| [dev/07_Video_Scripts.md](dev/07_Video_Scripts.md) | 8 complete video scripts | Content creators | Very Long |

### Pre-Built Benchmarks (17 total)

#### Pattern Benchmarks (7)

| File | Pattern |
|------|---------|
| [calculator_benchmark.yaml](../../marketplace/benchmarks/calculator_benchmark.yaml) | Basic calculation |
| [routing_benchmark.yaml](../../marketplace/benchmarks/routing_benchmark.yaml) | Routing |
| [chaining_benchmark.yaml](../../marketplace/benchmarks/chaining_benchmark.yaml) | Chaining |
| [parallelization_benchmark.yaml](../../marketplace/benchmarks/parallelization_benchmark.yaml) | Parallelization |
| [orchestrator_worker_benchmark.yaml](../../marketplace/benchmarks/orchestrator_worker_benchmark.yaml) | Orchestrator-worker |
| [evaluator_optimizer_benchmark.yaml](../../marketplace/benchmarks/evaluator_optimizer_benchmark.yaml) | Evaluator-optimizer |
| [memory_usage_benchmark.yaml](../../marketplace/benchmarks/memory_usage_benchmark.yaml) | Memory usage |

#### Domain Benchmarks (10)

| # | File | Domain | Tasks | Key Patterns |
|---|------|--------|-------|-------------|
| 1 | [01_customer_support.yaml](../../marketplace/benchmarks/01_customer_support.yaml) | Customer Service | 5 | Routing, tone checks, empathy |
| 2 | [02_rag_system.yaml](../../marketplace/benchmarks/02_rag_system.yaml) | RAG / Q&A | 5 | Hallucination prevention, grounding |
| 3 | [03_code_generation.yaml](../../marketplace/benchmarks/03_code_generation.yaml) | Software Dev | 5 | Syntax validation, security checks |
| 4 | [04_content_moderation.yaml](../../marketplace/benchmarks/04_content_moderation.yaml) | Trust & Safety | 5 | False positive/negative rate |
| 5 | [05_data_extraction.yaml](../../marketplace/benchmarks/05_data_extraction.yaml) | NLP / ETL | 4 | JSON schema, number extraction |
| 6 | [06_research_agent.yaml](../../marketplace/benchmarks/06_research_agent.yaml) | Research | 4 | Multi-source synthesis, citations |
| 7 | [07_translation_agent.yaml](../../marketplace/benchmarks/07_translation_agent.yaml) | Localization | 4 | Idiom handling, register, terms |
| 8 | [08_email_assistant.yaml](../../marketplace/benchmarks/08_email_assistant.yaml) | Productivity | 4 | Tone, completeness, empathy |
| 9 | [09_sql_agent.yaml](../../marketplace/benchmarks/09_sql_agent.yaml) | Database | 4 | SQL safety, injection prevention |
| 10 | [10_conversational_agent.yaml](../../marketplace/benchmarks/10_conversational_agent.yaml) | Chatbot | 5 | Context retention, safety |

---

## Key Concepts Quick Reference

| Concept | One-sentence definition | Where to learn more |
|---------|------------------------|---------------------|
| **Evaluation Suite** | A named group of related test tasks | [03_User_Guide.md §2](03_User_Guide.md) |
| **Evaluation Task** | One test case with input, expected output, and graders | [04_Reference.md](04_Reference.md) |
| **Trial** | One independent run of a task | [03_User_Guide.md §3](03_User_Guide.md) |
| **Grader** | Checks whether a trial's output meets requirements | [04_Reference.md](04_Reference.md) |
| **Success Rate** | % of tasks that passed at least once | [03_User_Guide.md §4](03_User_Guide.md) |
| **pass@k** | Probability at least 1 of k runs succeeds (capability) | [03_User_Guide.md §4](03_User_Guide.md) |
| **pass^k** | Probability all k runs succeed (reliability) | [03_User_Guide.md §4](03_User_Guide.md) |
| **Flakiness** | How inconsistent the agent is (0=stable, 0.5=random) | [03_User_Guide.md §4](03_User_Guide.md) |
| **Custom Metric** | User-written Python function computing any aggregate stat | [03_User_Guide.md §6](03_User_Guide.md) |
| **Benchmark** | Pre-built evaluation suite for standard agent patterns | [03_User_Guide.md §7](03_User_Guide.md) |
| **Reliability Score** | Holistic agent reliability profile (Consistency + Robustness + Predictability + Safety) | [03_User_Guide.md §8](03_User_Guide.md) |

---

## Metrics Reference Card

```
                ┌──────────────────────────────────────────┐
                │         EVALUATION METRICS                │
                ├──────────────────────────────────────────┤
                │                                          │
   CAPABILITY   │  pass@k   = 1 − (fail_rate)^k           │
                │           "Can it do it at all?"         │
                │                                          │
  RELIABILITY   │  pass^k   = (success_rate)^k             │
                │           "Does it always work?"         │
                │                                          │
 CONSISTENCY    │  Flakiness = mean std_dev per task       │
                │           0 = stable, 0.5 = random       │
                │                                          │
     QUALITY    │  avg_score = Σ(score_i × weight_i)      │
                │              ───────────────────         │
                │                  Σ(weight_i)             │
                │                                          │
   EFFICIENCY   │  avg_latency = mean(latency per trial)   │
                │  token_efficiency = score / tokens_used   │
                │                                          │
                └──────────────────────────────────────────┘
```

---

## Quick Troubleshooting Reference

| Symptom | Most Likely Cause | Fix |
|---------|------------------|-----|
| 0% success rate | Agent unreachable or wrong URL | Check agent endpoint |
| All graders fail | Grader expected value wrong | Review grader config |
| High flakiness (>0.3) | Temperature too high or ambiguous prompt | Lower temp or be more specific |
| Custom metric error | Python error in compute() | Add null checks and try/except |
| Run stuck/hanging | Agent timeout or crash | Check agent logs |

---

## 🔧 Document Ownership (For Maintainers)

| Category | Owner | Review Frequency |
|----------|-------|-----------------|
| Core user docs (03, 04, 07, 08, 09, 10) | Engineering team | Each release |
| Cookbook, Troubleshooting | DevRel / Support | Monthly |
| Benchmarks (YAML files) | Engineering | Quarterly |
| Video scripts | DevRel / Marketing | Major releases |
| UI specs, accessibility, overview | Frontend lead / Engineering | Per sprint |
