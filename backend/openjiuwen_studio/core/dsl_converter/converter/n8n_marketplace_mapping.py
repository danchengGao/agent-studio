#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

"""
N8N Marketplace Plugin Mappings

Maps n8n app node types (+ resource/operation parameter) to OpenJiuwen
marketplace plugin tools.  This is the authoritative "knowledge base" that
lets the converter produce a proper Plugin node instead of a fallback Code node
when an n8n workflow calls a service that exists in the OpenJiuwen marketplace.

Structure per entry
-------------------
"n8n-nodes-base.<app>": {
    "marketplace_plugin_id": str,   # plugin_id in marketplace JSON  (e.g. "nasa_api")
    "plugin_name":           str,   # human-readable name – must match DB `name` field
    "resources": {
        "<n8n_resource_value>": {
            "tool_name":    str,             # marketplace tool name (matches DB tool `name`)
            "path":         str,             # API path (informational / documentation)
            "method":       str,             # HTTP method
            "param_mapping": Dict[str,str],  # "n8n.dot.path" → "marketplace_param_name"
        },
        # optional fallback when the resource value is not explicitly listed:
        "_default": { "tool_name": None, "path": None, "method": "GET", "param_mapping": {} }
    }
}

param_mapping dot-notation
--------------------------
  "startDate"                  → params["startDate"]
  "additionalFields.startDate" → params["additionalFields"]["startDate"]
  "options.limit"              → params["options"]["limit"]

To extend this file: add an entry for the new n8n node type and list all
resource/operation combinations that exist in the corresponding marketplace
plugin JSON under ready_plugins/.
"""

from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------
ResourceInfo = Dict[str, Any]
PluginInfo = Dict[str, Any]


# ---------------------------------------------------------------------------
# Main mapping table
# ---------------------------------------------------------------------------

N8N_MARKETPLACE_MAPPINGS: Dict[str, PluginInfo] = {

    # =========================================================================
    # NASA Open APIs
    # n8n node: n8n-nodes-base.nasa
    # marketplace: ready_plugins/data/nasa.json  (plugin_id: "nasa_api")
    # =========================================================================
    "n8n-nodes-base.nasa": {
        "marketplace_plugin_id": "nasa_api",
        "plugin_name": "NASA Open APIs",
        "api_prefix": "https://api.nasa.gov",
        "resources": {
            # -- APOD ---------------------------------------------------------
            "apod": {
                "tool_name": "Astronomy Picture of the Day (APOD)",
                "path": "/planetary/apod",
                "method": "GET",
                "param_mapping": {
                    "date": "date",
                    "additionalFields.date": "date",
                    "additionalFields.startDate": "start_date",
                    "additionalFields.endDate": "end_date",
                    "additionalFields.count": "count",
                    "additionalFields.thumbs": "thumbs",
                },
            },

            # -- DONKI: Solar Flare  (primary test case) ----------------------
            "donkiSolarFlare": {
                "tool_name": "DONKI - Solar Flare",
                "path": "/DONKI/FLR",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                    # also accept top-level if n8n puts them there
                    "startDate": "startDate",
                    "endDate": "endDate",
                },
            },

            # -- DONKI: CME ---------------------------------------------------
            "donkiCme": {
                "tool_name": "DONKI - Coronal Mass Ejection (CME)",
                "path": "/DONKI/CME",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                },
            },

            # -- DONKI: CME Analysis ------------------------------------------
            "donkiCmeAnalysis": {
                "tool_name": "DONKI - CME Analysis",
                "path": "/DONKI/CMEAnalysis",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                    "additionalFields.mostAccurateOnly": "mostAccurateOnly",
                    "additionalFields.completeEntryOnly": "completeEntryOnly",
                    "additionalFields.speed": "speed",
                    "additionalFields.halfAngle": "halfAngle",
                },
            },

            # -- DONKI: Geomagnetic Storm -------------------------------------
            "donkiGeomagneticStorm": {
                "tool_name": "DONKI - Geomagnetic Storm (GST)",
                "path": "/DONKI/GST",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                },
            },

            # -- DONKI: Solar Energetic Particle ------------------------------
            "donkiSolarEnergeticParticle": {
                "tool_name": "DONKI - Solar Energetic Particle (SEP)",
                "path": "/DONKI/SEP",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                },
            },

            # -- DONKI: Interplanetary Shock ----------------------------------
            "donkiInterplanetaryShock": {
                "tool_name": "DONKI - Interplanetary Shock (IPS)",
                "path": "/DONKI/IPS",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                    "additionalFields.location": "location",
                    "additionalFields.catalog": "catalog",
                },
            },

            # -- DONKI: Magnetopause Crossing ---------------------------------
            "donkiMagnetopauseCrossing": {
                "tool_name": "DONKI - Magnetopause Crossing (MPC)",
                "path": "/DONKI/MPC",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                },
            },

            # -- DONKI: Radiation Belt Enhancement ----------------------------
            "donkiRadiationBeltEnhancement": {
                "tool_name": "DONKI - Radiation Belt Enhancement (RBE)",
                "path": "/DONKI/RBE",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                },
            },

            # -- DONKI: High Speed Stream -------------------------------------
            "donkiHighSpeedStream": {
                "tool_name": "DONKI - High Speed Stream (HSS)",
                "path": "/DONKI/HSS",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                },
            },

            # -- DONKI: WSA-ENLIL Simulation ----------------------------------
            "donkiWsaEnlilSimulation": {
                "tool_name": "DONKI - WSA-ENLIL Solar Wind Simulation",
                "path": "/DONKI/WSAEnlilSimulations",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                },
            },

            # -- DONKI: Notifications -----------------------------------------
            "donkiNotifications": {
                "tool_name": "DONKI - Notifications",
                "path": "/DONKI/notifications",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.startDate": "startDate",
                    "additionalFields.endDate": "endDate",
                    "additionalFields.type": "type",
                },
            },

            # -- NEO: Feed ----------------------------------------------------
            "neoFeed": {
                "tool_name": "Near Earth Objects (NEO) Feed",
                "path": "/neo/rest/v1/feed",
                "method": "GET",
                "param_mapping": {
                    "startDate": "start_date",
                    "additionalFields.startDate": "start_date",
                    "additionalFields.endDate": "end_date",
                },
            },

            # -- NEO: Lookup --------------------------------------------------
            "neoLookup": {
                "tool_name": "Near Earth Objects (NEO) Lookup",
                "path": "/neo/rest/v1/neo/{asteroid_id}",
                "method": "GET",
                "param_mapping": {
                    "asteroidId": "asteroid_id",
                    "additionalFields.asteroidId": "asteroid_id",
                },
            },

            # -- NEO: Browse --------------------------------------------------
            "neoBrowse": {
                "tool_name": "Near Earth Objects (NEO) Browse",
                "path": "/neo/rest/v1/neo/browse",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.page": "page",
                    "additionalFields.size": "size",
                },
            },

            # -- Mars Rover Photos (n8n uses one resource + rover dropdown) --
            "marsRoverPhotos": {
                "tool_name": "Mars Rover Photos - Curiosity",
                "path": "/mars-photos/api/v1/rovers/curiosity/photos",
                "method": "GET",
                "param_mapping": {
                    "additionalFields.sol": "sol",
                    "additionalFields.earthDate": "earth_date",
                    "additionalFields.camera": "camera",
                    "additionalFields.page": "page",
                },
            },

            # -- Earth Imagery ------------------------------------------------
            "earthImagery": {
                "tool_name": "Earth Imagery",
                "path": "/planetary/earth/imagery",
                "method": "GET",
                "param_mapping": {
                    "lat": "lat",
                    "lon": "lon",
                    "additionalFields.date": "date",
                    "additionalFields.dim": "dim",
                },
            },

            # -- Earth Assets -------------------------------------------------
            "earthAssets": {
                "tool_name": "Earth Assets",
                "path": "/planetary/earth/assets",
                "method": "GET",
                "param_mapping": {
                    "lat": "lat",
                    "lon": "lon",
                    "additionalFields.begin": "begin",
                    "additionalFields.end": "end",
                },
            },

            # -- EPIC ---------------------------------------------------------
            "epic": {
                "tool_name": "EPIC - Earth Polychromatic Imaging Camera",
                "path": "/EPIC/api/natural",
                "method": "GET",
                "param_mapping": {},
            },
        },
    },

    # =========================================================================
    # Slack
    # n8n node: n8n-nodes-base.slack
    # marketplace: ready_plugins/communication/slack.json  (plugin_id: "slack_api")
    #
    # n8n Slack v2.x uses select/user/channel params instead of resource/operation
    # for the most common case (sending messages), so resource is often absent.
    # _default handles that fallback and maps to chat.postMessage ("Post Message").
    # =========================================================================
    "n8n-nodes-base.slack": {
        "marketplace_plugin_id": "slack_api",
        "plugin_name": "Slack API",
        "api_prefix": "https://slack.com/api",
        "resources": {

            # v2.x: no resource field → send message (DM or channel)
            "_default": {
                "tool_name": "Post Message",
                "path": "/chat.postMessage",
                "method": "POST",
                "param_mapping": {
                    "text": "text",
                    "user.value": "channel",       # v2.x DM
                    "channel.value": "channel",    # v2.x channel
                    "channel": "channel",          # v1 flat param
                    "threadTs": "thread_ts",
                },
            },

            # v1.x resource="message"
            "message": {
                "tool_name": "Post Message",
                "path": "/chat.postMessage",
                "method": "POST",
                "param_mapping": {
                    "text": "text",
                    "channel": "channel",
                    "channel.value": "channel",
                    "threadTs": "thread_ts",
                    "otherOptions.threadTs": "thread_ts",
                },
            },

            # resource="channel"
            "channel": {
                "tool_name": "Get Channel History",
                "path": "/conversations.history",
                "method": "GET",
                "param_mapping": {
                    "channelId": "channel",
                    "channel": "channel",
                    "returnAll": None,
                    "filters.limit": "limit",
                    "filters.oldest": "oldest",
                    "filters.latest": "latest",
                },
            },

            # resource="file"
            "file": {
                "tool_name": "Upload File",
                "path": "/files.upload",
                "method": "POST",
                "param_mapping": {
                    "channels": "channels",
                    "content": "content",
                    "fileName": "filename",
                    "title": "title",
                    "initialComment": "initial_comment",
                },
            },

            # resource="reaction"
            "reaction": {
                "tool_name": "Add Reaction",
                "path": "/reactions.add",
                "method": "POST",
                "param_mapping": {
                    "name": "name",
                    "channel": "channel",
                    "timestamp": "timestamp",
                },
            },

            # resource="user"
            "user": {
                "tool_name": "Get User Info",
                "path": "/users.info",
                "method": "GET",
                "param_mapping": {
                    "user": "user",
                    "userId": "user",
                },
            },
        },
    },

    # =========================================================================
    # OpenAI (LangChain node)
    # n8n node: @n8n/n8n-nodes-langchain.openAi  (also without @n8n/ prefix)
    # marketplace: ready_plugins/ai/openai.json  (plugin_id: "openai_api")
    #
    # The n8n LangChain OpenAI node covers several resource types:
    #   "text"      → chat / text generation   → Create Chat Completion
    #   "assistant" → Assistants API (multi-step, no single REST equivalent)
    #                 Best-effort: map to Create Chat Completion; the `text`
    #                 param becomes the user message and `model` is preserved.
    #   "image"     → DALL-E image generation  → Create Image (DALL-E)
    #   "audio"     → Whisper transcription    → Create Transcription (Whisper)
    #   _default    → Create Chat Completion
    # =========================================================================
    "@n8n/n8n-nodes-langchain.openAi": {
        "marketplace_plugin_id": "openai_api",
        "plugin_name": "OpenAI API",
        "api_prefix": "https://api.openai.com/v1",
        "resources": {

            # resource="text" — plain chat/completion call
            "text": {
                "tool_name": "Create Chat Completion",
                "path": "/chat/completions",
                "method": "POST",
                "param_mapping": {
                    "prompt": "messages",              # user prompt → messages (array)
                    "text": "messages",
                    "options.model": "model",
                    "model": "model",
                    "options.temperature": "temperature",
                    "options.maxTokens": "max_tokens",
                },
            },

            # resource="assistant" — approximated via Chat Completion
            "assistant": {
                "tool_name": "Create Chat Completion",
                "path": "/chat/completions",
                "method": "POST",
                "param_mapping": {
                    "text": "messages",
                    "options.model": "model",
                    "model": "model",
                    "options.temperature": "temperature",
                    "options.maxTokens": "max_tokens",
                },
            },

            # resource="image" — DALL‑E
            "image": {
                "tool_name": "Create Image (DALL-E)",
                "path": "/images/generations",
                "method": "POST",
                "param_mapping": {
                    "prompt": "prompt",
                    "options.size": "size",
                    "options.n": "n",
                    "options.model": "model",
                },
            },

            # resource="audio" — Whisper
            "audio": {
                "tool_name": "Create Transcription (Whisper)",
                "path": "/audio/transcriptions",
                "method": "POST",
                "param_mapping": {
                    "options.language": "language",
                    "options.responseFormat": "response_format",
                },
            },

            # default fallback
            "_default": {
                "tool_name": "Create Chat Completion",
                "path": "/chat/completions",
                "method": "POST",
                "param_mapping": {
                    "text": "messages",
                    "prompt": "messages",
                    "options.model": "model",
                    "model": "model",
                },
            },
        },
    },

    # Same node without the @n8n/ scope prefix (older n8n versions)
    "n8n-nodes-langchain.openAi": {
        "marketplace_plugin_id": "openai_api",
        "plugin_name": "OpenAI API",
        "api_prefix": "https://api.openai.com/v1",
        "resources": {

            "text": {
                "tool_name": "Create Chat Completion",
                "path": "/chat/completions",
                "method": "POST",
                "param_mapping": {
                    "prompt": "messages",
                    "text": "messages",
                    "options.model": "model",
                    "model": "model",
                    "options.temperature": "temperature",
                    "options.maxTokens": "max_tokens",
                },
            },

            "assistant": {
                "tool_name": "Create Chat Completion",
                "path": "/chat/completions",
                "method": "POST",
                "param_mapping": {
                    "text": "messages",
                    "options.model": "model",
                    "model": "model",
                },
            },

            "image": {
                "tool_name": "Create Image (DALL-E)",
                "path": "/images/generations",
                "method": "POST",
                "param_mapping": {
                    "prompt": "prompt",
                    "options.size": "size",
                    "options.n": "n",
                    "options.model": "model",
                },
            },

            "audio": {
                "tool_name": "Create Transcription (Whisper)",
                "path": "/audio/transcriptions",
                "method": "POST",
                "param_mapping": {
                    "options.language": "language",
                    "options.responseFormat": "response_format",
                },
            },

            "_default": {
                "tool_name": "Create Chat Completion",
                "path": "/chat/completions",
                "method": "POST",
                "param_mapping": {
                    "text": "messages",
                    "prompt": "messages",
                    "options.model": "model",
                    "model": "model",
                },
            },
        },
    },


    # =========================================================================
    # Add more plugins below as needed.
    # Example skeleton:
    #
    # "n8n-nodes-base.<app>": {
    #     "marketplace_plugin_id": "<marketplace_plugin_id>",
    #     "plugin_name":           "<Plugin Display Name>",
    #     "api_prefix":            "https://api.example.com",  # used for HTTP fallback
    #     "resources": {
    #         "<resource>": {
    #             "tool_name":    "<Tool Name in Marketplace>",
    #             "path":         "/api/path",
    #             "method":       "GET",
    #             "param_mapping": {},
    #         },
    #     },
    # },
    # =========================================================================
}


# ---------------------------------------------------------------------------
# Helper functions used by converter_n8n.py
# ---------------------------------------------------------------------------

def get_marketplace_mapping(node_type: str) -> Optional[PluginInfo]:
    """Return the mapping entry for an n8n node type, or None if not mapped."""
    return N8N_MARKETPLACE_MAPPINGS.get(node_type)


def get_resource_info(plugin_info: PluginInfo, resource: str) -> Optional[ResourceInfo]:
    """
    Return tool info for a specific resource value.
    Falls back to the "_default" entry if the resource is not listed.
    Returns None if neither the resource nor "_default" is found.
    """
    resources = plugin_info.get("resources", {})
    return resources.get(resource) or resources.get("_default")


def resolve_param_path(params: Dict[str, Any], dot_path: str) -> Any:
    """
    Extract a value from a nested dict using dot-notation.

    Examples
    --------
    resolve_param_path({"additionalFields": {"startDate": "2024-01-01"}},
                       "additionalFields.startDate")
    → "2024-01-01"

    Returns None if any key along the path is missing.
    """
    parts = dot_path.split(".")
    current: Any = params
    for part in parts:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
        if current is None:
            return None
    return current
