# n8n → Jiuwen Node Type Mapping

## Overview

This document maps node types, connections, and expressions from n8n to Jiuwen (OpenJiuwen) workflow format.

---

## Node Type Mapping

### Core Structure Nodes

| n8n Type | n8n Name | Jiuwen Type | Jiuwen Name | Notes |
|----------|----------|-------------|-------------|-------|
| `n8n-nodes-base.manualTrigger` | Manual Trigger | `1` | Start (开始) | Entry point |
| `n8n-nodes-base.executeWorkflowTrigger` | Execute Workflow Trigger | `1` | Start | When called as sub-workflow |
| N/A (implicit) | End of workflow | `2` | End (结束) | n8n has no explicit end node |
| `n8n-nodes-base.if` | IF | `4` | Condition (选择器) | Branching logic |
| `n8n-nodes-base.switch` | Switch | `4` | Condition | Multi-branch (map branches) |
| `n8n-nodes-base.splitInBatches` | Split In Batches | `5` | Loop (循环) | Array iteration |
| `n8n-nodes-base.code` | Code | `10` | Code (代码) | Custom code execution |
| N/A | N/A | `15` | Block Start | Loop/condition internal |
| N/A | N/A | `16` | Block End | Loop/condition internal |

### AI/LLM Nodes

| n8n Type | n8n Name | Jiuwen Type | Jiuwen Name | Notes |
|----------|----------|-------------|-------------|-------|
| `n8n-nodes-langchain.agent` | AI Agent | `3` | LLM | n8n separates model as sub-node |
| `n8n-nodes-langchain.chainLlm` | Basic LLM Chain | `3` | LLM | Direct LLM call |
| `n8n-nodes-langchain.lmChatOpenAi` | OpenAI Chat Model | Embedded | LLM.model | Jiuwen embeds model in LLM node |
| `n8n-nodes-langchain.lmChatAnthropic` | Anthropic Model | Embedded | LLM.model | |
| `n8n-nodes-langchain.lmChatDeepSeek` | DeepSeek Model | Embedded | LLM.model | |
| `n8n-nodes-langchain.lmChatOllama` | Ollama Model | Embedded | LLM.model | |

### Tool/Plugin Nodes

| n8n Type | n8n Name | Jiuwen Type | Jiuwen Name | Notes |
|----------|----------|-------------|-------------|-------|
| `n8n-nodes-langchain.toolHttpRequest` | HTTP Request Tool | `19` | Plugin | External API calls |
| `n8n-nodes-langchain.toolWorkflow` | Workflow Tool | `19` | Plugin | Call sub-workflow |
| `n8n-nodes-langchain.toolCode` | Code Tool | `10` | Code | Custom tool logic |
| `n8n-nodes-base.httpRequest` | HTTP Request | `10` | Code | Use code with `requests` |

### Trigger Nodes

| n8n Type | n8n Name | Jiuwen Type | Jiuwen Name | Notes |
|----------|----------|-------------|-------------|-------|
| `n8n-nodes-base.webhook` | Webhook | `1` | Start | + external webhook config |
| `n8n-nodes-langchain.chatTrigger` | Chat Trigger | `1` | Start | Chat interface entry |
| `n8n-nodes-base.scheduleTrigger` | Schedule Trigger | `1` | Start | + external scheduler |
| Any `*Trigger` | App Triggers | `1` | Start | + external integration |

---

## Connection/Edge Mapping

### Structure Comparison

**n8n** uses a `connections` object keyed by source node name:
```json
{
  "connections": {
    "Source Node Name": {
      "main": [
        [{"node": "Target Node 1", "type": "main", "index": 0}],
        [{"node": "Target Node 2", "type": "main", "index": 0}]
      ],
      "ai_tool": [
        [{"node": "Tool Node", "type": "ai_tool", "index": 0}]
      ]
    }
  }
}
```

**Jiuwen** uses an `edges` array with node IDs:
```json
{
  "edges": [
    {"sourceNodeID": "node_123", "targetNodeID": "node_456"},
    {"sourceNodeID": "node_789", "targetNodeID": "node_456", "sourcePortID": "branch_1"}
  ]
}
```

### Connection Type Mapping

| n8n Connection Type | Jiuwen Equivalent | Notes |
|--------------------|-------------------|-------|
| `main` | `edges[]` | Primary execution flow |
| `main[0]` | `edges[]` | First output (default/true) |
| `main[1]` | `edges[].sourcePortID` | Second output (false/else) |
| `ai_languageModel` | Embedded in LLM node | Jiuwen embeds model config |
| `ai_memory` | Not separate | Jiuwen handles memory differently |
| `ai_tool` | `edges[]` to Plugin nodes | Tools are separate nodes |
| `ai_embedding` | Embedded or Plugin | Depends on usage |

### Branching (IF/Condition)

**n8n IF node** outputs to `main[0]` (true) and `main[1]` (false):
```json
"connections": {
  "IF": {
    "main": [
      [{"node": "True Branch"}],   // index 0 = true
      [{"node": "False Branch"}]   // index 1 = false
    ]
  }
}
```

**Jiuwen Condition** uses `branches` with `branchId`:
```json
{
  "type": "4",
  "data": {
    "branches": [
      {"branchId": "branch_true", "conditions": [...], "logic": 2},
      {"branchId": "branch_else", "conditions": []}
    ]
  }
}
// Edges reference branchId
{"sourceNodeID": "condition_1", "targetNodeID": "next_1", "sourcePortID": "branch_true"}
{"sourceNodeID": "condition_1", "targetNodeID": "next_2", "sourcePortID": "branch_else"}
```

---

## Data Reference Mapping

### Expression Syntax

| n8n Expression | Jiuwen Reference | Description |
|---------------|------------------|-------------|
| `={{ $json.field }}` | `{"type": "ref", "content": ["prev_node_id", "field"]}` | Access previous node output |
| `={{ $('Node Name').item.json.field }}` | `{"type": "ref", "content": ["node_id", "field"]}` | Access specific node |
| `={{ $input.first().json.field }}` | `{"type": "ref", "content": ["prev_node_id", "field"]}` | First item from input |
| `={{ $now }}` | N/A | Use code node for datetime |
| `={{ $json }}` | `{"type": "ref", "content": ["prev_node_id"]}` | Entire output object |
| `"static value"` | `{"type": "constant", "content": "static value"}` | Literal values |
| `={{ $env.VAR }}` | Environment variable | External config |

### Template Variables (Jiuwen LLM)

Jiuwen LLM nodes use `{{variable}}` syntax in prompts:
```json
{
  "systemPrompt": {
    "type": "template",
    "content": "You are helping with {{Filename}}\n\nDiff:\n{{Diff}}"
  },
  "inputParameters": {
    "Filename": {"type": "ref", "content": ["code_node", "Filename"]},
    "Diff": {"type": "ref", "content": ["code_node", "Diff"]}
  }
}
```

Equivalent n8n would use expressions in the prompt parameter:
```json
{
  "parameters": {
    "systemMessage": "You are helping with {{ $json.Filename }}\n\nDiff:\n{{ $json.Diff }}"
  }
}
```

---

## Loop Mapping

### n8n SplitInBatches → Jiuwen Loop

**n8n** loops using SplitInBatches with manual reconnection:
```
┌──────────────────┐
│ SplitInBatches   │──┐
└──────────────────┘  │
         │            │
    [process item]    │
         │            │
         └────────────┘ (loop back)
```

**Jiuwen** has a dedicated Loop node with nested blocks:
```json
{
  "type": "5",
  "data": {
    "inputs": {
      "loopParam": {
        "type": "arrayLoop",
        "loopArray": {
          "items": {"type": "ref", "content": ["start", "InputArray"]}
        }
      }
    }
  },
  "blocks": [
    {"id": "block_start", "type": "15"},
    {"id": "process_node", "type": "10"},
    {"id": "block_end", "type": "16"}
  ],
  "edges": [
    {"sourceNodeID": "block_start", "targetNodeID": "process_node"},
    {"sourceNodeID": "process_node", "targetNodeID": "block_end"}
  ]
}
```

---

## LLM Configuration Mapping

### n8n Agent with Model Sub-node

```json
// n8n: Agent node + separate model sub-node
{
  "nodes": [
    {
      "type": "n8n-nodes-langchain.agent",
      "name": "AI Agent",
      "parameters": {
        "systemMessage": "You are a helpful assistant"
      }
    },
    {
      "type": "n8n-nodes-langchain.lmChatOpenAi",
      "name": "OpenAI Model",
      "parameters": {
        "model": "gpt-4",
        "temperature": 0.7
      }
    }
  ],
  "connections": {
    "OpenAI Model": {
      "ai_languageModel": [[{"node": "AI Agent"}]]
    }
  }
}
```

### Jiuwen LLM Node (Embedded)

```json
// Jiuwen: Single LLM node with embedded model config
{
  "type": "3",
  "data": {
    "title": "AI Agent",
    "inputs": {
      "llmParam": {
        "systemPrompt": {"type": "template", "content": "You are a helpful assistant"},
        "prompt": {"type": "template", "content": "{{input}}"},
        "model": {
          "id": "1",
          "name": "gpt-4",
          "type": "gpt-4"
        }
      }
    }
  }
}
```

---

## Code Node Mapping

### n8n Code Node

```json
{
  "type": "n8n-nodes-base.code",
  "parameters": {
    "mode": "runOnceForAllItems",
    "jsCode": "return items.map(item => ({ json: { result: item.json.value * 2 } }));"
  }
}
```

### Jiuwen Code Node

```json
{
  "type": "10",
  "data": {
    "inputs": {
      "language": "python",
      "code": "def main(args):\n    value = args.params.get('value', 0)\n    return {'result': value * 2}",
      "inputParameters": {
        "value": {"type": "ref", "content": ["prev_node", "value"]}
      }
    },
    "outputs": {
      "type": "object",
      "properties": {
        "result": {"type": "number"}
      }
    }
  }
}
```

### Key Differences

| Aspect | n8n | Jiuwen |
|--------|-----|--------|
| Language | JavaScript (default), Python | Python (default) |
| Input access | `items[0].json.field` or `$json.field` | `args.params.get('field')` |
| Output format | Return array of `{json: {...}}` | Return dict directly |
| Input declaration | Implicit from connections | Explicit `inputParameters` |
| Output declaration | Implicit | Explicit `outputs` schema |

---

## Transformation Strategy

### n8n → Jiuwen

1. **Parse n8n workflow** using `n8n_workflow_parser.py`
2. **Generate Start/End nodes** (Jiuwen requires explicit)
3. **Convert nodes by type**:
   - Triggers → Start node
   - AI Agent + Model sub-nodes → Single LLM node with embedded config
   - IF → Condition with branches
   - SplitInBatches → Loop with nested blocks
   - Code → Code (translate JS to Python or wrap)
   - HTTP Request → Code with `requests` library
   - App nodes (Slack, Gmail, etc.) → Plugin stubs
4. **Convert connections**:
   - Resolve node names to IDs
   - Convert `main[n]` outputs to `sourcePortID`
   - Flatten AI sub-node connections into LLM config
5. **Convert expressions**:
   - Parse `={{ }}` expressions
   - Map to `{"type": "ref", "content": [...]}` format
6. **Track unsupported nodes**:
   - Unknown node types → Code fallback with warning
   - Generate transformation report

---

## Challenges & Limitations

| Challenge | Solution |
|-----------|----------|
| Model config | Merge sub-nodes into single LLM node |
| Memory | Extract from sub-node, embed in LLM |
| Tools | Note in warnings, requires manual implementation |
| Loops | Restructure as nested blocks with block_start/block_end |
| Credentials | Not in export, need external mapping |
| Expressions | Parse and convert `={{ }}` to `{{ref}}` format |
| App integrations | Convert to Plugin stubs |
| Unknown types | Fallback to Code node with TODO comments |

---

## Quick Reference: Type Numbers

### Jiuwen Node Types
```
1  = Start (开始)
2  = End (结束)
3  = LLM
4  = Condition (选择器)
5  = Loop (循环)
10 = Code (代码)
15 = Block Start (loop internal)
16 = Block End (loop internal)
19 = Plugin
```

### n8n Node Categories
```
trigger    = *Trigger, webhook
core       = code, if, switch, merge, set, filter, httpRequest
ai_root    = agent, chainLlm, chainRetrievalQa, vectorStore*
ai_subnode = lmChat*, memory*, embeddings*, tool*, outputParser*
app_action = slack, gmail, notion, etc. (400+ integrations)
```
