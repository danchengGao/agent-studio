# OpenJiuwen — Everywhere You Already Are

> AI is only as useful as it is accessible.
> The moment you have to switch apps, open a browser, or break your flow to get help —
> you've already lost.

---

## The Problem

OpenJiuwen is powerful. You can build agents that answer questions, summarise documents, draft replies, and make decisions. You can build workflows that automate multi-step processes end to end.

But there's a friction point.

To use any of it, you have to open a browser, navigate to OpenJiuwen, and type into a chat window. That works when you're sitting at a desk with time to spare. It doesn't work when you're on your phone, in the middle of something else, or just want a quick answer without switching context. And it doesn't work for AI assistants either — an agent that wants to run a workflow has no browser to open.

High effort means low usage. A brilliant AI that nobody reaches is not useful.

---

## The Solution

OpenJiuwen does not need to live in a browser tab. Everything it can do — running agents, executing workflows, having multi-turn conversations — can happen directly inside the tools and environments you already use every day.

There are two kinds of consumers that benefit from this:

**People** — who live inside messaging apps like WhatsApp, Telegram, or Slack, or work from the terminal, and want to reach OpenJiuwen without switching context.

**AI assistants** — that can autonomously call OpenJiuwen tools as part of their own reasoning, without any human typing commands at all.

Both are solved here, under one roof, with one shared idea: OpenJiuwen comes to you.

---

## For People — Channels

Channels bring OpenJiuwen into the apps and environments you already use.

Instead of opening a browser, you type a message wherever you are. OpenJiuwen receives it, runs the agent or workflow, and sends the answer back — in the same place, in the same conversation, without switching.

```
You type in WhatsApp:
  "Run my morning summary workflow"

OpenJiuwen responds in WhatsApp:
  "Here's your summary: ..."
```

```
You type in Telegram from your phone:
  "Ask the research agent: what are the latest papers on memory in LLMs?"

Your Telegram bot replies immediately with the answer.
```

It becomes part of how you naturally communicate. Not a separate tool. Not a tab to remember. Just OpenJiuwen, wherever you already are.

### What you can do from any channel

- **Run agents** — start a conversation with any of your OpenJiuwen agents and continue it over multiple messages, just like a chat
- **Execute workflows** — trigger any workflow; if it needs inputs, the bot collects them step by step in the same conversation
- **Browse your library** — list and search your agents and workflows without opening the web interface
- **Manage your session** — log in, log out, and check your connection status

### Supported platforms

#### Production-Ready Platforms

These platforms are stable, tested, and ready for production use:

| Platform | A good fit for |
|---|---|
| **CLI** | Developers and power users who work in the terminal |
| **Email** | Anyone — email is universal and needs no setup on the user side |
| **WeChat** | Individuals and teams in the Chinese market |
| **Webhook** | Any custom system, product, or internal tool that can make an HTTP call |

#### Experimental Platforms

These platforms are functional but still under development. They may have rough edges or incomplete features:

| Platform | A good fit for |
|---|---|
| **Telegram** | Individuals, technical users, communities |
| **Slack** | Workplace teams with Slack as their daily hub |
| **Discord** | Developer communities, creator groups, personal servers |
| **WhatsApp** | Personal use and teams who run everything through WhatsApp |
| **Microsoft Teams** | Enterprise organisations on the Microsoft ecosystem |
| **Facebook Messenger** | Consumer-facing use cases and existing Messenger audiences |
| **GitHub** | Developers who want to run OpenJiuwen from issue and PR comments |
| **Google Assistant** | Voice and smart home users on the Google ecosystem |
| **SMS via Twilio** | Mobile-first users who want plain-text simplicity |
| **Amazon Alexa** | Hands-free and voice-first environments |

Every platform gives access to the same OpenJiuwen capabilities. The only thing that changes is where you are when you use them.

### Each person logs in as themselves

Every user authenticates with their own OpenJiuwen account directly inside the app. Their agents, their workflows, their conversation history — all personal, all private. One bot, many independent users, each with their own secure session.

---

## For AI Assistants — MCP

Channels solve the human side. MCP solves the AI assistant side.

MCP (Model Context Protocol) is an open standard that lets AI assistants call external tools during a conversation. When OpenJiuwen is connected as an MCP tool, any compatible AI assistant gains the ability to discover and run your OpenJiuwen agents and workflows autonomously — deciding on its own when and how to use them, based on what you ask.

```
You tell your AI assistant:
  "Find the onboarding workflow and run it for our new hire Alice."

The assistant — without any further input from you — searches OpenJiuwen,
inspects what inputs the workflow needs, runs it with the right parameters,
and reports back:
  "Done. The onboarding workflow completed for Alice. Here's what happened: ..."
```

You didn't type a command. You didn't open OpenJiuwen. You just described what you wanted, and the AI used OpenJiuwen as a tool to make it happen.

### What an AI assistant can do with OpenJiuwen via MCP

- **Find agents** — search and browse your OpenJiuwen agent library
- **Talk to agents** — run a multi-turn conversation with any agent, preserving context across turns
- **Find workflows** — search and inspect your OpenJiuwen workflow library
- **Run workflows** — execute any workflow with the right inputs and retrieve the results
- **Check status** — verify that the OpenJiuwen backend is reachable before taking action

### Which AI assistants support this

Any AI assistant that implements MCP can connect to OpenJiuwen. Two notable examples:

**Claude Desktop** (by Anthropic) — you can configure OpenJiuwen as an MCP server in Claude Desktop. From that point on, Claude can autonomously run your agents and workflows as part of any conversation.

**JiuwenClaw** — a personal AI assistant from the same family as OpenJiuwen. JiuwenClaw is a ReAct agent with persistent memory and self-evolving skills that lives in the apps you use (Telegram, WhatsApp, Discord, Feishu). When connected to OpenJiuwen via MCP, JiuwenClaw can call on your OpenJiuwen agents and workflows as part of its own reasoning — using your structured workflows to handle things it would otherwise need to figure out step by step.

```
JiuwenClaw, connected to OpenJiuwen:

You: "Summarise my week and send a Slack message with the highlights."

JiuwenClaw reasons:
  → I have a "weekly summary" workflow in OpenJiuwen — run it
  → I have a "send Slack message" workflow in OpenJiuwen — run it with the output
  → Done. Reply with confirmation.
```

JiuwenClaw brings the personal memory and long-running context. OpenJiuwen brings the structured agents and reliable workflows. Together they cover more than either could alone.

### Why this matters

The traditional integration model is: a human learns a tool, opens it, and uses it manually. MCP breaks that model. With OpenJiuwen connected to an AI assistant, the human describes the outcome they want, and the AI figures out the steps — including calling OpenJiuwen when OpenJiuwen is the right tool for the job.

Your OpenJiuwen workflows and agents become ambient capabilities available to any AI assistant that supports MCP, not just to users who know they exist and choose to open the browser.

---

## Two audiences, one idea

| | Channels | MCP |
|---|---|---|
| Who reaches OpenJiuwen | People | AI assistants |
| How they reach it | By messaging in an app they already use | By the AI autonomously deciding to use OpenJiuwen as a tool |
| What triggers a request | A person typing a message | A person describing a goal in natural language |
| What they need to know | Basic commands (run this workflow, talk to this agent) | Nothing — the AI handles it |
| Who logs in | Each user with their own OpenJiuwen account | The developer, once, at setup time |
| Examples | WhatsApp, Telegram, Slack, Email, CLI | Claude Desktop, JiuwenClaw |

Both exist because people work differently. Some want to stay in their messaging app and type commands. Others want to describe what they need to an AI assistant and let it do the work. OpenJiuwen supports both, without requiring any change to how agents and workflows are built.

---

## What stays the same

Regardless of how someone reaches OpenJiuwen — whether through WhatsApp, the terminal, Claude, or JiuwenClaw — the agents and workflows they access are the same ones built in the OpenJiuwen web interface. There is no duplicate set of "channel agents" or "MCP agents." Every capability built in OpenJiuwen is automatically available everywhere OpenJiuwen is connected.

Build once. Reach everywhere.

---

## What this is not

This layer does not replace the OpenJiuwen web interface.

The browser is still the right place for building and editing agents and workflows, managing your account, and configuring settings. What Channels and MCP add is the everyday usage layer — the place where people actually run the things they've built, without the overhead of navigating to a website.

The web interface is the studio. Channels and MCP are the stage.
