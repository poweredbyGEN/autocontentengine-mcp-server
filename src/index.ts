#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.GEN_API_KEY;
const BASE_URL = process.env.GEN_API_BASE_URL || "https://api.gen.pro/v1";
const AGENT_API_BASE = process.env.GEN_AGENT_API_URL || "https://agent.gen.pro/v1";

if (!API_KEY) {
  console.error("GEN_API_KEY environment variable is required");
  process.exit(1);
}

const API_REFERENCE = `# GEN Auto Content Engine — System Prompt & API Reference

## About GEN

GEN is an Autonomous Social Media Agent platform. It detects trends, generates video content (text, images, video, speech, lipsync, captions), publishes across platforms, and improves automatically. The Auto Content Engine API gives programmatic access to GEN's content creation system.

You are interacting with the GEN API through MCP tools. This reference teaches you how to use them effectively.

## Mental Model

Think of GEN as a hierarchy:

1. **Workspace (Organization)** — A company or brand container. Holds billing, team members, and credits.
2. **Agent** — A brand identity within a workspace. An agent has a name, personality, voice, and strategy. ALL content operations are scoped to an agent via agent_id.
3. **Auto Content Engine (ACE)** — A spreadsheet-like workspace attached to an agent. Think of it as a production pipeline where each column is a content type and each row is one piece of content.
4. **Content Loop** — The cycle: create engine → define columns → add rows → generate content in cells → render final video → publish.

Within an engine:
- **Columns** define content types (text script, hero image, video clip, voiceover, etc.)
- **Rows** represent one piece of content across all columns
- **Cells** are the intersection of a row and column — this is where content lives
- **Layers** are composition elements within a video cell (text overlays, sound tracks, clips)
- **Generations** are async AI jobs that produce content in a cell or layer

## Authentication

All API calls require a Personal Access Token (PAT) sent as an X-API-Key header.

**How to get a PAT:**
1. Log in to GEN at https://gen.pro
2. Go to Settings → API Keys
3. Click "Create API Key" and give it a name
4. Copy the token immediately — it is only shown once
5. Set it as GEN_API_KEY environment variable

The token format is: ref_<random_string>

You can also manage PATs programmatically with gen_list_api_keys, gen_create_api_key, and gen_revoke_api_key.

## Quick Start Workflow

### Fastest path — clone a template:
1. **gen_list_templates** → browse available templates
2. **gen_list_agents** → pick an agent_id to work with
3. **gen_clone_template** → clone the template into your agent. This creates a fully configured engine with all the right columns.
4. **gen_list_rows** → see the rows created by the template
5. **gen_update_cell** → fill in text cells with your content
6. **gen_generate_content** → trigger AI generation for each cell
7. **gen_get_generation** → poll until status is "completed"

### From scratch:
1. **gen_list_agents** → pick an agent_id
2. **gen_create_engine** → create a new empty engine
3. **gen_create_column** → add columns (text, image, video, audio)
4. **gen_create_row** → add content rows
5. **gen_update_cell** → set cell values (e.g., write a script in a text cell)
6. **gen_generate_content** → trigger AI generation in a cell
7. **gen_get_generation** → poll until "completed"
8. **gen_render_video** → render the final composed video

## Templates

**Always check templates first.** Cloning a template is the fastest way to create a production-ready engine.

Templates are pre-configured engines created by GEN or the community. They come with:
- The right columns for the workflow (text, image, video, audio, final_video)
- Pre-configured generation settings and prompts
- Example rows showing how to use the engine

Use gen_list_templates to browse, gen_get_template to inspect one, and gen_clone_template to copy it into your agent's workspace.

## Creation Card Types (Generation Types)

This is the most important section. When calling gen_generate_content, you must specify a generation_type and pass the right data params.

### Text Generation
- **generation_type:** "text_generation"
- **data:** { model: "gemini" | "openai", prompt: "Write a 30-second TikTok script about..." }
- **Output:** Text string in the generation's result field
- **Use for:** Scripts, captions, descriptions, hashtags, any text content

### Image from Text (Gemini)
- **generation_type:** "gemini_image_generation"
- **data:** { prompt: "A cinematic shot of...", model: "gemini" | "gemini_pro", aspect_ratio: "1024:1024" | "576:1024" | "1024:576", number_of_images: 1 }
- **Output:** Image URL(s) in output_resources
- **Aspect ratios:** "1024:1024" (square), "576:1024" (portrait/vertical), "1024:576" (landscape/horizontal)

### Image (Midjourney)
- **generation_type:** "midjourney"
- **data:** { prompt: "A hyper-realistic photo of..." }
- **Output:** Image URL in output_resources
- **Use for:** High-quality artistic images, photorealistic renders

### Video from Text (Veo / Google)
- **generation_type:** "gemini_video_generation"
- **data:** { prompt: "A drone shot flying over...", model: "veo3" | "veo3-fast" | "veo3-1" | "veo3-1-fast", aspect_ratio: "1024:576" | "576:1024", duration: 8, negative_prompt: "blurry, low quality" }
- **Models:** veo3 (highest quality), veo3-fast (faster), veo3-1 (v1), veo3-1-fast (v1 fast)
- **Duration:** seconds (default 8)

### Video from Text (Sora / OpenAI)
- **generation_type:** "sora2_video_generation"
- **data:** { prompt: "A timelapse of...", aspect_ratio: "1024:576" | "576:1024", duration: 10 }
- **Duration:** seconds (default 10)

### Video from Text (Kling)
- **generation_type:** "kling"
- **data:** { prompt: "A person walking...", model: "kling-v1-6", aspect_ratio: "576:1024" | "1024:576", duration: 5 }
- **Duration:** seconds (default 5)

### Video from Image (Kling)
- **generation_type:** "kling_image_video"
- **data:** { prompt: "The person starts dancing...", model: "kling-v2-1" | "kling-v2-6", image_content_resource_id: 123, aspect_ratio: "576:1024" | "1024:576", duration: 5 }
- **Requires:** An existing image content resource (pass its ID as image_content_resource_id)
- **Models:** kling-v2-1 (quality), kling-v2-6 (newer)

### Video from Text (Seedance)
- **generation_type:** "seedance_video_generation"
- **data:** { prompt: "A dancer performing...", model: "seedance-1.0-pro" | "seedance-1.5-pro", aspect_ratio: "576:1024" | "1024:576", duration: 5 }
- **Duration:** seconds (default 5)

### Speech from Text (ElevenLabs)
- **generation_type:** "eleven_labs"
- **data:** { voice_id: "voice_abc123", script: "Hello, welcome to my channel!", enhance_voice: true }
- **Output:** Audio URL in output_resources
- **Note:** Requires a valid ElevenLabs voice_id. The agent may need an ElevenLabs API key configured.

### Lipsync (Video + Audio → Talking Head)
- **generation_type:** "lipsync"
- **data:** { model: "sync.so" | "gen", video_content_resource_id: 123, audio_content_resource_id: 456 }
- **Requires:** An existing video content resource and an audio content resource
- **Models:** "sync.so" (third-party, high quality), "gen" (GEN's built-in)

### Captions (Audio → Subtitles)
- **generation_type:** "captions"
- **data:** { audio_content_resource_id: 123 }
- **Requires:** An existing audio content resource
- **Output:** Timed caption data

## Column Types

Columns define what kind of content a cell holds:
- **text** — Scripts, prompts, descriptions, hashtags
- **image** — Generated or uploaded images
- **video** — Generated or uploaded video clips
- **audio** — Generated speech, uploaded music, sound effects

### Column Roles
- **ingredient** — User-creatable columns. These are the inputs to your content pipeline.
- **video** — System video composition column (auto-created with templates)
- **final_video** — The rendered output video (auto-created with templates)
- **stats** — Analytics/metrics column (auto-created, read-only)

Only **ingredient** role columns can be created by users via gen_create_column. The video, final_video, and stats columns are created automatically when you clone a template.

## Common Workflows

### Create a TikTok Video
1. gen_clone_template (use a TikTok template) → creates engine with columns
2. gen_create_row → add a row
3. gen_update_cell → write your script in the text column cell
4. gen_generate_content (text_generation) → generate/refine script with AI
5. gen_generate_content (gemini_video_generation or kling) → generate video clip
6. gen_generate_content (eleven_labs) → generate voiceover
7. gen_generate_content (lipsync) → sync voice to video
8. gen_render_video → render the final composed video

### Generate Batch Images
1. gen_create_engine → new engine
2. gen_create_column (type: "text") → for prompts
3. gen_create_column (type: "image") → for generated images
4. gen_create_row (repeat for each image) → add rows
5. gen_update_cell → write image prompts in text cells
6. gen_generate_content (gemini_image_generation) → generate in each image cell

### Add Voiceover to Existing Video
1. gen_generate_content (eleven_labs) → generate speech in an audio cell
2. gen_generate_content (lipsync) → combine video + audio content resources

### Monitor Social Media Content
1. **gen_create_monitoring_job** → set platform, search_type, value, monitoring=true
2. Poll job status via GET /v1/user_jobs/{id}?agent_id={id}
3. Query scraped data by chatting with the agent (the data is in the agent's knowledge base)

### Publish Content
1. Generate or upload your video/image → get a public media_url
2. **gen_publish_content** → post immediately (schedule_type="now") or schedule for later
3. Poll status until completed — result contains the post_id from the platform

## Generation Status Flow

All generations are asynchronous. After triggering gen_generate_content:

pending → processing → completed | failed | stopped

**Poll with gen_get_generation** until status is "completed".

On completion:
- **Text:** result field contains the generated text
- **Media (image/video/audio):** output_resources array contains URLs

**Credits:** Pre-charged when generation starts. Automatically refunded if the generation fails or is stopped.

**Stopping:** Use gen_stop_generation to cancel a running generation.

## All Endpoints

### Discovery
- GET /me → user profile, workspace memberships
- GET /workspaces → list workspaces [{id, name}]
- GET /agents?workspace_id={id} → list agents [{id, name, role, organization}]

### Agents
- POST /agents → create agent (body: {agent: {name, description, time_zone}})
- GET /agents/{id} → agent details
- PATCH /agents/{id} → update agent
- DELETE /agents/{id} → soft-delete agent
- GET /agents/{id}/avatars → list avatars
- POST /agents/{id}/avatars → upload avatar
- DELETE /agents/{id}/avatars/{avatar_id} → delete avatar

### Organizations
- GET /organizations → list orgs with credits, role, plan
- POST /organizations → create org (body: {organization: {name}})
- GET /organizations/{id} → org details
- PATCH /organizations/{id} → update org (owner/manager)
- DELETE /organizations/{id} → delete org (owner only, irreversible)

### Templates
- GET /templates/projects → list templates (paginated, 20 per page)
- GET /templates/projects/{slug} → get template details by slug/UUID/ID
- POST /templates/spreadsheets/{slug}/clone → clone template into agent (body: {agent_id})

### Auto Content Engine
- POST /autocontentengine?agent_id={id} → create engine (body: {agent_id, title})
- GET /autocontentengine/{id}?agent_id={id} → get engine with all columns, rows, cells
- POST /autocontentengine/{id}/clone?agent_id={id} → clone engine

### Columns
- GET /autocontentengine/{id}/columns?agent_id={id} → list columns
- POST /autocontentengine/{id}/columns → create column (body: {agent_id, title, type, position?})

### Rows
- GET /autocontentengine/{id}/rows?agent_id={id} → list rows
- POST /autocontentengine/{id}/rows → create row (body: {agent_id})
- POST /autocontentengine/{id}/rows/{row_id}/duplicate → duplicate row

### Cells
- GET /autocontentengine/{id}/cells/{cell_id}?agent_id={id} → get cell
- PATCH /autocontentengine/{id}/cells/{cell_id} → update cell value (body: {agent_id, value})
- POST /autocontentengine/{id}/cells/{cell_id}/generate → trigger generation
- POST /autocontentengine/{id}/cells/{cell_id}/render → render final video

### Layers
- POST /autocontentengine/{id}/cells/{cell_id}/layers → create layer
- POST /autocontentengine/{id}/cells/{cell_id}/layers/{layer_id}/generate → generate layer
- DELETE /autocontentengine/{id}/cells/{cell_id}/layers/{layer_id} → delete layer

### Generations
- GET /generations/{id} → poll generation status
- POST /generations/{id}/stop → stop a running generation

### Global Variables
- GET /autocontentengine/{id}/global_variables?agent_id={id} → list engine variables

### Content Resources
- GET /content_resources?agent_id={id} → list files (filterable by type, project_id)
- POST /content_resources?agent_id={id} → create resource from signed_id
- GET /content_resources/{id}?agent_id={id} → file details
- PATCH /content_resources/{id}?agent_id={id} → rename file
- DELETE /content_resources/{id}?agent_id={id} → delete file
- GET /asset_libraries?agent_id={id} → browse asset library (files + folders)
- POST /direct_upload → get pre-signed S3 URL for large uploads

### API Keys (Personal Access Tokens)
- GET /persisted_tokens → list all PATs
- POST /persisted_tokens → create PAT (body: {name?}, token shown once)
- DELETE /persisted_tokens/{id}/revoke → revoke PAT

## Error Format

All errors return: { error: "Human-readable message", error_code: "machine_code" }

Common error codes:
- 401 unauthorized — invalid or missing API key
- 404 not_found — resource does not exist or you lack access
- 422 usable_gen_credit_required — insufficient credits for this generation
- 422 agent_not_found — the agent_id is invalid or you lack access
- 422 validation_error — request body failed validation
- 429 rate_limited — too many requests, slow down

## Tips for AI Agents

1. **Always start with gen_list_agents** to get valid agent IDs before any operation.
2. **Check templates before building from scratch** — gen_list_templates saves significant time.
3. **Poll generations patiently** — video generation can take 30-120 seconds. Poll every 5-10 seconds.
4. **Use gen_get_engine to see everything** — it returns all columns, rows, and cells in one call.
5. **Text cells are inputs** — write prompts/scripts there first, then generate media from them.
6. **Content resource IDs link media** — when lipsync or image-to-video needs existing media, get the content_resource_id from a completed generation's output_resources.
7. **Render is the final step** — gen_render_video combines all layers into the publishable video.

## Agentic Chat API (agent.gen.pro)

The GEN Agentic Chat API provides AI-powered content idea generation with built-in research.
Base URL: https://agent.gen.pro/v1. Same PAT auth (X-API-Key header).

### How It Works
1. Start a run with a message → agent researches, generates ideas
2. Poll for completion or listen via Firebase
3. Ideas come back with:
   - Full video scripts grounded in real research
   - Selected assets (images, videos) ready for production
   - Video manifests with timeline layers
   - Fact-verified claims with citations
   - Asset-script coherence (visuals match what's spoken)

### Model Routing
- Claude Opus: orchestrates research, evaluates quality, iterates
- Gemini 3.0 Flash: synthesizes research findings, analyzes assets
- ChatGPT 5.2: writes creative scripts

### Quick Start
1. gen_get_agent_profile → check agent has keywords configured
2. gen_generate_content_ideas → "create 5 ideas about recent trends"
3. gen_get_run_status → poll until completed (ideas in messages array)
4. gen_list_content_ideas → review generated ideas with selected_assets
5. gen_update_idea_status → approve the good ones
6. gen_run_research → standalone research on any topic

### Research
gen_run_research runs topic research across 10+ platforms (Reddit, X, YouTube,
TikTok, Instagram, HN, Perplexity, Gemini). Returns source counts, citations,
and AI synthesis. Content ideas automatically use research when generating.

### Three Layers of Control
- Per-batch requirements: one-time constraints ("focus on before/after", "under 12 seconds")
- Long-term preferences: persistent rules for ALL future generations ("never use question hooks")
- Feedback/refinement: iterate on specific ideas in conversation context

### Video Types
0=Any, 1=Talking Avatar, 2=Green Screen, 3=Montage, 4=Text-Driven,
5=POV Object, 6=Narrated/VO, 8=Split Screen, 9=Skit

### Content Ideas Response Shape
Each idea includes: title, hook, full_script, video_type, video_type_id,
estimated_duration, selected_assets[], project_manifest (timeline_layers),
inspiration_sources[], rationale

### Asset Types in selected_assets
- url: downloadable URL (assets.gen.buzz for social, S3 for web research)
- type: image | video | audio
- clip_range: { start, end } — recommended timestamps
- usage: exact placement in the video ("overlay at 3-6s", "background for green screen")
`;

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "X-API-Key": API_KEY!,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function agentApiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${AGENT_API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "X-API-Key": API_KEY!,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({
  name: "autocontentengine",
  version: "0.3.0",
});

// ── API Reference resource ──────────────────────────────────────────────────
// Claude can read this to understand the full API before making calls.

server.resource(
  "api-reference",
  "gen://api-reference",
  { description: "Full GEN Auto Content Engine API reference — read this first to understand all available endpoints, generation types, request/response schemas, and authentication." },
  async () => ({
    contents: [{
      uri: "gen://api-reference",
      mimeType: "text/plain",
      text: API_REFERENCE,
    }],
  })
);

// ── Discovery tools ──────────────────────────────────────────────────────────

server.tool(
  "gen_get_me",
  "Get the authenticated user's profile and workspace info",
  {},
  async () => {
    const data = await apiCall("GET", "/me");
    return jsonResult(data);
  }
);

server.tool(
  "gen_list_workspaces",
  "List all workspaces the authenticated user has access to",
  {},
  async () => {
    const data = await apiCall("GET", "/workspaces");
    return jsonResult(data);
  }
);

server.tool(
  "gen_list_agents",
  "List agents, optionally filtered by workspace",
  {
    workspace_id: z.string().optional().describe("Filter agents by workspace ID"),
  },
  async ({ workspace_id }) => {
    const params = workspace_id ? `?workspace_id=${workspace_id}` : "";
    const data = await apiCall("GET", `/agents${params}`);
    return jsonResult(data);
  }
);

// ── Template tools ──────────────────────────────────────────────────────────

server.tool(
  "gen_list_templates",
  "List available templates. Templates are pre-configured engines — cloning one is the fastest way to start. Always check templates before creating an engine from scratch.",
  {
    page: z.string().optional().describe("Page number (default 1, 20 per page)"),
  },
  async ({ page }) => {
    const params = page ? `?page=${page}` : "";
    const data = await apiCall("GET", `/templates/projects${params}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_template",
  "Get details of a specific template by slug, UUID, or ID",
  {
    slug: z.string().describe("Template slug, UUID, or numeric ID"),
  },
  async ({ slug }) => {
    const data = await apiCall("GET", `/templates/projects/${slug}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_clone_template",
  "Clone a template into an agent's workspace. This is the FASTEST way to create a production-ready engine with pre-configured columns. Returns the new engine.",
  {
    slug: z.string().describe("Template slug to clone"),
    agent_id: z.string().describe("Agent ID to clone the template into"),
  },
  async ({ slug, agent_id }) => {
    const data = await apiCall("POST", `/templates/spreadsheets/${slug}/clone`, { agent_id });
    return jsonResult(data);
  }
);

// ── Engine tools ─────────────────────────────────────────────────────────────

server.tool(
  "gen_create_engine",
  "Create a new empty Auto Content Engine for an agent. TIP: Consider using gen_clone_template instead — templates come pre-configured with the right columns for common workflows.",
  {
    agent_id: z.string().describe("The agent ID to create the engine for"),
    title: z.string().describe("Title for the new engine"),
  },
  async ({ agent_id, title }) => {
    const data = await apiCall("POST", "/autocontentengine", { agent_id, title });
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_engine",
  "Get details of a specific Auto Content Engine",
  {
    agent_id: z.string().describe("The agent ID that owns the engine"),
    engine_id: z.string().describe("The engine ID to retrieve"),
  },
  async ({ agent_id, engine_id }) => {
    const data = await apiCall("GET", `/autocontentengine/${engine_id}?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_clone_engine",
  "Clone an existing engine, optionally to a different agent",
  {
    agent_id: z.string().describe("The agent ID that owns the source engine"),
    engine_id: z.string().describe("The engine ID to clone"),
    target_agent_id: z.string().optional().describe("Target agent ID (defaults to same agent)"),
  },
  async ({ agent_id, engine_id, target_agent_id }) => {
    const body: Record<string, string> = { agent_id };
    if (target_agent_id) body.target_agent_id = target_agent_id;
    const data = await apiCall("POST", `/autocontentengine/${engine_id}/clone`, body);
    return jsonResult(data);
  }
);

// ── Row tools ────────────────────────────────────────────────────────────────

server.tool(
  "gen_list_rows",
  "List all rows in an Auto Content Engine",
  {
    engine_id: z.string().describe("The engine ID"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, agent_id }) => {
    const data = await apiCall("GET", `/autocontentengine/${engine_id}/rows?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_row",
  "Create a new row in an Auto Content Engine",
  {
    engine_id: z.string().describe("The engine ID"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, agent_id }) => {
    const data = await apiCall("POST", `/autocontentengine/${engine_id}/rows`, { agent_id });
    return jsonResult(data);
  }
);

server.tool(
  "gen_duplicate_row",
  "Duplicate an existing row in an Auto Content Engine",
  {
    engine_id: z.string().describe("The engine ID"),
    row_id: z.string().describe("The row ID to duplicate"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, row_id, agent_id }) => {
    const data = await apiCall("POST", `/autocontentengine/${engine_id}/rows/${row_id}/duplicate`, { agent_id });
    return jsonResult(data);
  }
);

// ── Cell tools ───────────────────────────────────────────────────────────────

server.tool(
  "gen_get_cell",
  "Get the value and metadata of a specific cell",
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID to retrieve"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, cell_id, agent_id }) => {
    const data = await apiCall("GET", `/autocontentengine/${engine_id}/cells/${cell_id}?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_cell",
  "Update the value of a specific cell",
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID to update"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
    value: z.string().describe("The new cell value"),
  },
  async ({ engine_id, cell_id, agent_id, value }) => {
    const data = await apiCall("PATCH", `/autocontentengine/${engine_id}/cells/${cell_id}`, { agent_id, value });
    return jsonResult(data);
  }
);

// ── Generation type mapping (canonical → Rails internal) ────────────────────

const SIMPLE_TYPE_MAP: Record<string, string> = {
  text: "text_generation",
  speech_from_text: "eleven_labs",
};

const MODEL_ROUTED_TYPE_MAP: Record<string, (model: string) => string> = {
  image_from_text: (model) =>
    model === "midjourney" ? "midjourney" : "gemini_image_generation",
  video_from_text: (model) => {
    if (model.startsWith("sora")) return "sora2_video_generation";
    if (model.startsWith("kling")) return "kling";
    if (model.startsWith("seedance")) return "seedance_video_generation";
    return "gemini_video_generation";
  },
  video_from_image: (model) => {
    if (model.startsWith("kling")) return "kling_image_video";
    if (model.startsWith("sora")) return "sora2_video_generation";
    if (model.startsWith("seedance")) return "seedance_video_generation";
    return "gemini_video_generation";
  },
};

function resolveGenerationType(
  canonicalType: string,
  data?: Record<string, unknown>
): string {
  if (SIMPLE_TYPE_MAP[canonicalType]) return SIMPLE_TYPE_MAP[canonicalType];
  const router = MODEL_ROUTED_TYPE_MAP[canonicalType];
  if (router) {
    const model = String((data?.model as string) ?? "");
    return router(model);
  }
  // Already a Rails type or unknown — pass through unchanged
  return canonicalType;
}

// ── Generation tools ─────────────────────────────────────────────────────────

server.tool(
  "gen_generate_content",
  `Trigger AI content generation for a cell. Returns a generation_id — poll with gen_get_generation until status is "completed".

Generation types (canonical names — legacy names also accepted):
- TEXT: generation_type="text", data={model:"gemini_2_0_flash"|"gpt_4o"|..., prompt:"..."}
- IMAGE: generation_type="image_from_text", data={prompt:"...", model:"gemini_image"|"gemini_pro_image"|"midjourney", aspect_ratio:"1:1"|"9:16"|"16:9"}
- VIDEO (text): generation_type="video_from_text", data={prompt:"...", model:"veo_3"|"sora_2"|"kling_1_6"|"seedance_pro"|..., duration:5|10}
- VIDEO (image): generation_type="video_from_image", data={prompt:"...", model:"kling_2_1"|"veo_3"|..., image_resource_id:123}
- VIDEO (ingredients): generation_type="video_from_ingredients", data={prompt:"...", model:"pika"|..., asset_resource_ids:[...]}
- SPEECH: generation_type="speech_from_text", data={voice_id:"...", script:"...", voice_method:"my_voices"|"design_voice"|"clone_voice"}
- LIPSYNC: generation_type="lipsync", data={model:"sync_so"|"gen", video_resource_id:123, audio_resource_id:456}
- CAPTIONS: generation_type="captions", data={model:"gemini", source_resource_id:123}
- MEDIA: generation_type="media", data={content_resource_id:123}

Credits are pre-charged and refunded on failure/stop.`,
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID to generate content for"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
    generation_type: z.string().describe("text | image_from_text | video_from_text | video_from_image | video_from_ingredients | speech_from_text | lipsync | captions | media"),
    data: z.record(z.string(), z.unknown()).optional().describe("Generation-specific parameters (prompt, model, aspect_ratio, duration, voice_id, etc.)"),
  },
  async ({ engine_id, cell_id, agent_id, generation_type, data: extraData }) => {
    const railsType = resolveGenerationType(generation_type, extraData as Record<string, unknown> | undefined);
    const body: Record<string, unknown> = { agent_id, generation_type: railsType };
    if (extraData) body.data = extraData;
    const result = await apiCall("POST", `/autocontentengine/${engine_id}/cells/${cell_id}/generate`, body);
    return jsonResult(result);
  }
);

server.tool(
  "gen_generate_layer",
  "Trigger generation for a specific layer within a cell",
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID"),
    layer_id: z.string().describe("The layer ID to generate"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, cell_id, layer_id, agent_id }) => {
    const data = await apiCall(
      "POST",
      `/autocontentengine/${engine_id}/cells/${cell_id}/layers/${layer_id}/generate`,
      { agent_id }
    );
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_generation",
  "Poll a generation job's status. Status flow: pending → processing → completed | failed | stopped. On completion: text results in 'result' field, media URLs in 'output_resources' array.",
  {
    generation_id: z.string().describe("The generation ID to check"),
  },
  async ({ generation_id }) => {
    const data = await apiCall("GET", `/generations/${generation_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_stop_generation",
  "Stop a running generation job",
  {
    generation_id: z.string().describe("The generation ID to stop"),
  },
  async ({ generation_id }) => {
    const data = await apiCall("POST", `/generations/${generation_id}/stop`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_continue_generation",
  "Continue a previously stopped generation. Credits are re-charged.",
  {
    generation_id: z.string().describe("The generation ID to continue"),
  },
  async ({ generation_id }) => {
    const data = await apiCall("POST", `/generations/${generation_id}/continue`);
    return jsonResult(data);
  }
);

// ── Render tools ─────────────────────────────────────────────────────────────

server.tool(
  "gen_render_video",
  "Render the final composed video for a cell. This combines all layers (video, audio, text overlays, captions) into the final output.",
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID (must be a final_video column cell)"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, cell_id, agent_id }) => {
    const data = await apiCall("POST", `/autocontentengine/${engine_id}/cells/${cell_id}/render`, { agent_id });
    return jsonResult(data);
  }
);

// ── Layer tools ──────────────────────────────────────────────────────────────

server.tool(
  "gen_create_layer",
  "Create a new layer in a cell",
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID to add the layer to"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
    name: z.string().describe("Name of the layer"),
    type: z.string().describe("Type of the layer"),
    position: z.number().optional().describe("Position of the layer (0-indexed)"),
  },
  async ({ engine_id, cell_id, agent_id, name, type, position }) => {
    const body: Record<string, unknown> = { agent_id, name, type };
    if (position !== undefined) body.position = position;
    const data = await apiCall("POST", `/autocontentengine/${engine_id}/cells/${cell_id}/layers`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_delete_layer",
  "Delete a layer from a cell",
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID"),
    layer_id: z.string().describe("The layer ID to delete"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, cell_id, layer_id, agent_id }) => {
    const data = await apiCall(
      "DELETE",
      `/autocontentengine/${engine_id}/cells/${cell_id}/layers/${layer_id}?agent_id=${agent_id}`
    );
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_layer",
  "Get details of a specific layer in a cell, including its type, position, attributes, and generation history.",
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID"),
    layer_id: z.string().describe("The layer ID"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, cell_id, layer_id, agent_id }) => {
    const data = await apiCall(
      "GET",
      `/autocontentengine/${engine_id}/cells/${cell_id}/layers/${layer_id}?agent_id=${agent_id}`
    );
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_layer",
  "Update a layer's name, type, position, or additional attributes.",
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID"),
    layer_id: z.string().describe("The layer ID to update"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
    name: z.string().optional().describe("New layer name"),
    type: z.string().optional().describe("New layer type"),
    position: z.number().optional().describe("New position (0-indexed)"),
    additional_attributes: z.record(z.string(), z.unknown()).optional().describe("Additional attributes to set"),
  },
  async ({ engine_id, cell_id, layer_id, agent_id, name, type, position, additional_attributes }) => {
    const body: Record<string, unknown> = { agent_id };
    const video_layer: Record<string, unknown> = {};
    if (name !== undefined) video_layer.name = name;
    if (type !== undefined) video_layer.type = type;
    if (position !== undefined) video_layer.position = position;
    if (additional_attributes) video_layer.additional_attributes = additional_attributes;
    body.video_layer = video_layer;
    const data = await apiCall(
      "PATCH",
      `/autocontentengine/${engine_id}/cells/${cell_id}/layers/${layer_id}`,
      body
    );
    return jsonResult(data);
  }
);

// ── Agent tools ─────────────────────────────────────────────────────────────

server.tool(
  "gen_create_agent",
  "Create a new agent, optionally within a specific organization/workspace",
  {
    name: z.string().describe("Agent name (must be unique within the workspace)"),
    description: z.string().optional().describe("Short description of the agent's purpose"),
    time_zone: z.string().optional().describe("IANA time zone identifier (e.g. America/New_York)"),
    organization_id: z.string().optional().describe("Workspace ID to create the agent in"),
    eleven_lab_api_key: z.string().optional().describe("ElevenLabs API key for voice synthesis"),
    hume_ai_api_key: z.string().optional().describe("Hume AI API key for emotional voice"),
  },
  async ({ name, description, time_zone, organization_id, eleven_lab_api_key, hume_ai_api_key }) => {
    const agent: Record<string, unknown> = { name };
    if (description) agent.description = description;
    if (time_zone) agent.time_zone = time_zone;
    if (eleven_lab_api_key) agent.eleven_lab_api_key = eleven_lab_api_key;
    if (hume_ai_api_key) agent.hume_ai_api_key = hume_ai_api_key;
    const body: Record<string, unknown> = { agent };
    if (organization_id) body.organization_id = organization_id;
    const data = await apiCall("POST", "/agents", body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_agent",
  "Get full details of a specific agent by ID",
  {
    agent_id: z.string().describe("The agent ID"),
    with_organization_uuid: z.string().optional().describe("If 'true', includes the workspace UUID in the response"),
  },
  async ({ agent_id, with_organization_uuid }) => {
    const params = with_organization_uuid ? `?with_organization_uuid=${with_organization_uuid}` : "";
    const data = await apiCall("GET", `/agents/${agent_id}${params}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_agent",
  "Update an existing agent's name, description, time zone, or voice keys",
  {
    agent_id: z.string().describe("The agent ID to update"),
    name: z.string().optional().describe("Updated agent name"),
    description: z.string().optional().describe("Updated description"),
    time_zone: z.string().optional().describe("IANA time zone identifier"),
    eleven_lab_api_key: z.string().optional().describe("ElevenLabs API key"),
    hume_ai_api_key: z.string().optional().describe("Hume AI API key"),
  },
  async ({ agent_id, name, description, time_zone, eleven_lab_api_key, hume_ai_api_key }) => {
    const agent: Record<string, unknown> = {};
    if (name) agent.name = name;
    if (description) agent.description = description;
    if (time_zone) agent.time_zone = time_zone;
    if (eleven_lab_api_key) agent.eleven_lab_api_key = eleven_lab_api_key;
    if (hume_ai_api_key) agent.hume_ai_api_key = hume_ai_api_key;
    const data = await apiCall("PATCH", `/agents/${agent_id}`, { agent });
    return jsonResult(data);
  }
);

server.tool(
  "gen_delete_agent",
  "Soft-delete an agent (requires owner/manager role or being the creator)",
  {
    agent_id: z.string().describe("The agent ID to delete"),
  },
  async ({ agent_id }) => {
    const data = await apiCall("DELETE", `/agents/${agent_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_list_agent_avatars",
  "List avatar images for an agent, with the primary avatar first",
  {
    agent_id: z.string().describe("The agent ID"),
    cursor: z.string().optional().describe("Return avatars with ID greater than this value (for pagination)"),
  },
  async ({ agent_id, cursor }) => {
    const params = cursor ? `?cursor=${cursor}` : "";
    const data = await apiCall("GET", `/agents/${agent_id}/avatars${params}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_agent_avatar",
  "Create an avatar for an agent using a DeGod avatar ID (for file uploads, use the API directly)",
  {
    agent_id: z.string().describe("The agent ID"),
    degod_avatar_id: z.string().optional().describe("DeGod avatar ID to use"),
  },
  async ({ agent_id, degod_avatar_id }) => {
    const body: Record<string, unknown> = {
      agent_avatars_attributes: [
        degod_avatar_id ? { degod_avatar_id } : {},
      ],
    };
    const data = await apiCall("POST", `/agents/${agent_id}/avatars`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_delete_agent_avatar",
  "Delete one or more avatars from an agent (separate multiple IDs with underscores)",
  {
    agent_id: z.string().describe("The agent ID"),
    avatar_id: z.string().describe("The avatar ID to delete (use underscores for multiple, e.g. '7_8_9')"),
  },
  async ({ agent_id, avatar_id }) => {
    const data = await apiCall("DELETE", `/agents/${agent_id}/avatars/${avatar_id}`);
    return jsonResult(data);
  }
);

// ── Organization tools ──────────────────────────────────────────────────────

server.tool(
  "gen_list_organizations",
  "List all organizations/workspaces the authenticated user is a member of",
  {},
  async () => {
    const data = await apiCall("GET", "/organizations");
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_organization",
  "Create a new organization/workspace (you become the owner automatically)",
  {
    name: z.string().describe("Display name for the organization"),
  },
  async ({ name }) => {
    const data = await apiCall("POST", "/organizations", { organization: { name } });
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_organization",
  "Get details of a specific organization by ID",
  {
    organization_id: z.string().describe("The organization ID"),
  },
  async ({ organization_id }) => {
    const data = await apiCall("GET", `/organizations/${organization_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_organization",
  "Update an organization's name (requires owner or manager role)",
  {
    organization_id: z.string().describe("The organization ID to update"),
    name: z.string().describe("New display name for the organization"),
  },
  async ({ organization_id, name }) => {
    const data = await apiCall("PATCH", `/organizations/${organization_id}`, { organization: { name } });
    return jsonResult(data);
  }
);

server.tool(
  "gen_delete_organization",
  "Permanently delete an organization and all associated data (requires owner role, irreversible)",
  {
    organization_id: z.string().describe("The organization ID to delete"),
  },
  async ({ organization_id }) => {
    const data = await apiCall("DELETE", `/organizations/${organization_id}`);
    return jsonResult(data);
  }
);

// ── Global Variables tools ──────────────────────────────────────────────────

server.tool(
  "gen_list_variables",
  "Get global variables for an engine. Variables are key-value pairs used for template substitution in prompts and content.",
  {
    engine_id: z.string().describe("The engine ID"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, agent_id }) => {
    const data = await apiCall("GET", `/autocontentengine/${engine_id}/global_variables?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

// ── Content Resource tools ──────────────────────────────────────────────────

server.tool(
  "gen_list_content_resources",
  "List content resources (files) belonging to an agent, with optional filters",
  {
    agent_id: z.string().describe("The agent whose resources to list"),
    type: z.string().optional().describe("Filter by file type: image, video, audio, zip, or safe_tensors"),
    project_id: z.string().optional().describe("Filter to resources attached to a specific project"),
    page: z.string().optional().describe("Page number for pagination (default 0, 20 items per page)"),
  },
  async ({ agent_id, type, project_id, page }) => {
    const params = new URLSearchParams({ agent_id });
    if (type) params.set("type", type);
    if (project_id) params.set("project_id", project_id);
    if (page) params.set("page", page);
    const data = await apiCall("GET", `/content_resources?${params.toString()}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_content_resource",
  "Create a content resource from a signed_id (use gen_create_direct_upload first to upload the file to S3)",
  {
    agent_id: z.string().describe("The agent to create the resource under"),
    signed_id: z.string().describe("The signed_id returned from gen_create_direct_upload"),
    project_id: z.string().optional().describe("Attach the resource to this project"),
    asset_folder_id: z.string().optional().describe("Place the resource inside this asset folder"),
  },
  async ({ agent_id, signed_id, project_id, asset_folder_id }) => {
    const body: Record<string, unknown> = { content_resource: { file: signed_id } };
    if (project_id) body.project_node = { project_id };
    if (asset_folder_id) body.asset_folder = { id: asset_folder_id };
    const data = await apiCall("POST", `/content_resources?agent_id=${agent_id}`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_content_resource",
  "Get full details of a content resource, including generator info if AI-generated",
  {
    agent_id: z.string().describe("The agent that owns the resource"),
    resource_id: z.string().describe("The content resource ID"),
  },
  async ({ agent_id, resource_id }) => {
    const data = await apiCall("GET", `/content_resources/${resource_id}?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_content_resource",
  "Rename a content resource file",
  {
    agent_id: z.string().describe("The agent that owns the resource"),
    resource_id: z.string().describe("The content resource ID"),
    filename: z.string().describe("The new filename for the resource"),
  },
  async ({ agent_id, resource_id, filename }) => {
    const data = await apiCall("PATCH", `/content_resources/${resource_id}?agent_id=${agent_id}`, {
      content_resource: { filename },
    });
    return jsonResult(data);
  }
);

server.tool(
  "gen_delete_content_resource",
  "Permanently delete a content resource and its associated file",
  {
    agent_id: z.string().describe("The agent that owns the resource"),
    resource_id: z.string().describe("The content resource ID to delete"),
  },
  async ({ agent_id, resource_id }) => {
    const data = await apiCall("DELETE", `/content_resources/${resource_id}?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_list_asset_libraries",
  "List the agent's asset library (files and folders) with filtering and search",
  {
    agent_id: z.string().describe("The agent whose asset library to list"),
    folder_id: z.string().optional().describe("Show contents of a specific folder (omit for root-level)"),
    asset_type: z.string().optional().describe("Comma-separated filter: image, video, audio, folder"),
    search: z.string().optional().describe("Search assets by name"),
    order: z.string().optional().describe("Sort order: 'recent' for newest first"),
    page: z.string().optional().describe("Page number (default 1)"),
    page_size: z.string().optional().describe("Items per page (default 20)"),
  },
  async ({ agent_id, folder_id, asset_type, search, order, page, page_size }) => {
    const params = new URLSearchParams({ agent_id });
    if (folder_id) params.set("folder_id", folder_id);
    if (asset_type) params.set("asset_type", asset_type);
    if (search) params.set("search", search);
    if (order) params.set("order", order);
    if (page) params.set("page", page);
    if (page_size) params.set("page_size", page_size);
    const data = await apiCall("GET", `/asset_libraries?${params.toString()}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_direct_upload",
  "Get a pre-signed S3 URL for direct file upload (use the returned signed_id with gen_create_content_resource)",
  {
    filename: z.string().describe("Original filename including extension"),
    byte_size: z.number().describe("File size in bytes (max 1 GB)"),
    checksum: z.string().describe("Base64-encoded MD5 checksum of the file"),
    content_type: z.string().describe("MIME type (e.g. image/png, video/mp4)"),
  },
  async ({ filename, byte_size, checksum, content_type }) => {
    const data = await apiCall("POST", "/direct_upload", {
      blob: { filename, byte_size, checksum, content_type },
    });
    return jsonResult(data);
  }
);

// ── Column tools ─────────────────────────────────────────────────────────────

server.tool(
  "gen_list_columns",
  "List all columns in an Auto Content Engine",
  {
    engine_id: z.string().describe("The engine ID"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, agent_id }) => {
    const data = await apiCall("GET", `/autocontentengine/${engine_id}/columns?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_column",
  "Create a new column in an Auto Content Engine. Valid types: 'text' (scripts/prompts), 'image', 'video', 'audio'. Only 'ingredient' role columns can be created by users — system columns (video, final_video, stats) are created automatically with templates.",
  {
    engine_id: z.string().describe("The engine ID"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
    title: z.string().describe("Column title"),
    type: z.string().describe("Column type: text | image | video | audio"),
    position: z.number().optional().describe("Column position (0-indexed)"),
  },
  async ({ engine_id, agent_id, title, type, position }) => {
    const body: Record<string, unknown> = { agent_id, title, type };
    if (position !== undefined) body.position = position;
    const data = await apiCall("POST", `/autocontentengine/${engine_id}/columns`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_column",
  "Update a column's title, type, or position. Only ingredient-role columns can be modified.",
  {
    engine_id: z.string().describe("The engine ID"),
    column_id: z.string().describe("The column ID to update"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
    title: z.string().optional().describe("New column title"),
    type: z.string().optional().describe("New column type: text | image | video | audio"),
    position: z.number().optional().describe("New position (0-indexed)"),
  },
  async ({ engine_id, column_id, agent_id, title, type, position }) => {
    const body: Record<string, unknown> = { agent_id };
    const spreadsheet_column: Record<string, unknown> = {};
    if (title !== undefined) spreadsheet_column.title = title;
    if (type !== undefined) spreadsheet_column.type = type;
    if (position !== undefined) spreadsheet_column.position = position;
    body.spreadsheet_column = spreadsheet_column;
    const data = await apiCall("PATCH", `/autocontentengine/${engine_id}/columns/${column_id}`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_delete_column",
  "Delete a column from an engine. Only ingredient-role columns can be deleted.",
  {
    engine_id: z.string().describe("The engine ID"),
    column_id: z.string().describe("The column ID to delete"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, column_id, agent_id }) => {
    const data = await apiCall(
      "DELETE",
      `/autocontentengine/${engine_id}/columns/${column_id}?agent_id=${agent_id}`
    );
    return jsonResult(data);
  }
);

// ── API Key tools ───────────────────────────────────────────────────────────

server.tool(
  "gen_list_api_keys",
  "List all Personal Access Tokens (API keys) for the authenticated user",
  {},
  async () => {
    const data = await apiCall("GET", "/persisted_tokens");
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_api_key",
  "Create a new Personal Access Token. The plain-text token is returned ONCE — store it securely.",
  {
    name: z.string().optional().describe("Descriptive name for the API key"),
  },
  async ({ name }) => {
    const body: Record<string, unknown> = {};
    if (name) body.name = name;
    const data = await apiCall("POST", "/persisted_tokens", body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_revoke_api_key",
  "Revoke (delete) a Personal Access Token",
  {
    token_id: z.string().describe("The token ID to revoke"),
  },
  async ({ token_id }) => {
    const data = await apiCall("DELETE", `/persisted_tokens/${token_id}/revoke`);
    return jsonResult(data);
  }
);

// ── Content Monitoring tools ─────────────────────────────────────────────────

server.tool(
  "gen_create_monitoring_job",
  "Start monitoring or scraping social media content. Supports 3 platforms: tiktok, instagram, youtube. Search types: username (@creator), hashtag (#topic), keyword (plain text). Not all platform/type combos are valid — TikTok and YouTube support all three, Instagram supports username+hashtag only. Set monitoring=true for ongoing scheduled scraping, false for one-time (default). Scraped data is queried through the agent chat, not returned directly. This is a paid operation ($0.015/post, $0.002/comment).",
  {
    agent_id: z.string().describe("The agent ID"),
    platform: z.enum(["tiktok", "instagram", "youtube"]).describe("Target platform"),
    search_type: z.enum(["username", "hashtag", "keyword"]).describe("Search type — must be supported by the chosen platform"),
    value: z.string().describe("Search value: @username, #hashtag, or keyword text"),
    days: z.number().optional().describe("Filter to content from last N days: 0 (no filter), 1, 7, 30, 90, or 180"),
    country: z.string().optional().describe("Two-letter country code (e.g. us, gb) to filter by region"),
    max_results: z.number().optional().describe("Max results per scrape (1-50)"),
    monitoring: z.boolean().optional().describe("true for ongoing monitoring, false for one-time scrape (default)"),
    comment_monitoring: z.boolean().optional().describe("true to also scrape comments (adds per-comment cost)"),
  },
  async ({ agent_id, platform, search_type, value, days, country, max_results, monitoring, comment_monitoring }) => {
    const jobData: Record<string, unknown> = {
      platform,
      type: search_type,
      value,
    };
    if (days !== undefined) jobData.days = days;
    if (country) jobData.country = country;
    if (max_results !== undefined) jobData.max_results = max_results;
    if (monitoring !== undefined) jobData.monitoring = monitoring;
    if (comment_monitoring !== undefined) jobData.comment_monitoring = comment_monitoring;

    const formData = new URLSearchParams();
    formData.set("agent_id", agent_id);
    formData.set("user_job[user_job_type]", "train_social");
    formData.set("user_job[data]", JSON.stringify(jobData));

    const response = await fetch(`${BASE_URL}/user_jobs?agent_id=${agent_id}`, {
      method: "POST",
      headers: {
        "X-API-Key": API_KEY!,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    const data = await response.json();
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_monitoring_job",
  "Update an existing content monitoring job. Only jobs with pending or processing status can be updated.",
  {
    agent_id: z.string().describe("The agent ID"),
    job_id: z.string().describe("The monitoring job ID to update"),
    platform: z.enum(["tiktok", "instagram", "youtube"]).describe("Target platform"),
    search_type: z.enum(["username", "hashtag", "keyword"]).describe("Search type"),
    value: z.string().describe("Search value: @username, #hashtag, or keyword text"),
    days: z.number().optional().describe("Filter to content from last N days"),
    country: z.string().optional().describe("Two-letter country code"),
    max_results: z.number().optional().describe("Max results per scrape (1-50)"),
    monitoring: z.boolean().optional().describe("true for ongoing, false for one-time"),
    comment_monitoring: z.boolean().optional().describe("true to also scrape comments"),
  },
  async ({ agent_id, job_id, platform, search_type, value, days, country, max_results, monitoring, comment_monitoring }) => {
    const formData = new URLSearchParams();
    formData.set("agent_id", agent_id);
    formData.set("platform", platform);
    formData.set("type", search_type);
    formData.set("value", value);
    if (days !== undefined) formData.set("days", String(days));
    if (country) formData.set("country", country);
    if (max_results !== undefined) formData.set("max_results", String(max_results));
    if (monitoring !== undefined) formData.set("monitoring", String(monitoring));
    if (comment_monitoring !== undefined) formData.set("comment_monitoring", String(comment_monitoring));

    const response = await fetch(`${BASE_URL}/user_jobs/${job_id}?agent_id=${agent_id}`, {
      method: "PUT",
      headers: {
        "X-API-Key": API_KEY!,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    const data = await response.json();
    return jsonResult(data);
  }
);

// ── Publishing tools ─────────────────────────────────────────────────────────

server.tool(
  "gen_publish_content",
  "Publish or schedule content to a social media platform. Currently supports TikTok. The agent must have a connected TikTok social account. For immediate posting use schedule_type='now'. For scheduled posting use schedule_type='scheduled' with a future scheduled_time. This is a paid operation.",
  {
    agent_id: z.string().describe("The agent ID"),
    platform: z.enum(["tiktok"]).describe("Target platform (currently only tiktok)"),
    media_url: z.string().describe("Public URL to the media file (must be accessible at post time)"),
    description: z.string().describe("Post caption/description. Max ~2200 chars for TikTok. Include hashtags inline."),
    schedule_type: z.enum(["now", "scheduled"]).describe("'now' for immediate posting, 'scheduled' for future posting"),
    title: z.string().optional().describe("Post title"),
    media_type: z.enum(["VIDEO", "IMAGE"]).optional().describe("Media type (default VIDEO)"),
    scheduled_time: z.string().optional().describe("ISO 8601 UTC datetime (e.g. 2026-03-16T15:00:00Z). Required when schedule_type is 'scheduled'."),
    thumbnail_url: z.string().optional().describe("Custom thumbnail URL"),
    timezone_offset: z.number().optional().describe("Timezone offset in minutes from UTC (default 0)"),
  },
  async ({ agent_id, platform, media_url, description, schedule_type, title, media_type, scheduled_time, thumbnail_url, timezone_offset }) => {
    const publishData: Record<string, unknown> = {
      platform,
      media_url,
      description,
      schedule_type,
    };
    if (title) publishData.title = title;
    if (media_type) publishData.media_type = media_type;
    if (scheduled_time) publishData.scheduled_time = scheduled_time;
    if (thumbnail_url) publishData.thumbnail_url = thumbnail_url;
    if (timezone_offset !== undefined) publishData.timezone_offset = timezone_offset;

    const data = await apiCall("POST", `/user_jobs?agent_id=${agent_id}`, {
      user_job_type: "publish_content",
      data: JSON.stringify(publishData),
    });
    return jsonResult(data);
  }
);

// ── Agent Profile tools (agent.gen.pro) ─────────────────────────────────────

server.tool(
  "gen_get_agent_profile",
  "Get the full agent profile including identity, voice settings, and brand configuration. Returns grouped sections: identity (name, avatar, persona), voice (ElevenLabs key, default voice), and brand (keywords, platforms, linked accounts, content_idea_preferences). Use this to check current agent setup before making changes.",
  {
    agent_id: z.string().describe("The agent ID"),
  },
  async ({ agent_id }) => {
    const data = await agentApiCall("GET", `/agent/profile?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_agent_profile",
  "Set up an agent's profile for the first time. Send any combination of identity, voice, and brand sections. Identity: name, description, persona. Voice: eleven_lab_api_key, hume_ai_api_key, default_voice. Brand: brand_name, description, goal, keywords, target_platforms, shortform, longform, linked_accounts, content_idea_preferences.",
  {
    agent_id: z.string().describe("The agent ID"),
    identity: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      persona: z.string().optional(),
    }).optional().describe("Identity: name, description, persona"),
    voice: z.object({
      eleven_lab_api_key: z.string().optional(),
      hume_ai_api_key: z.string().optional(),
      default_voice: z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        provider: z.string().optional(),
      }).optional(),
    }).optional().describe("Voice: API keys and default voice config"),
    brand: z.object({
      brand_name: z.string().optional(),
      description: z.string().optional(),
      goal: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      target_platforms: z.array(z.string()).optional(),
      shortform: z.boolean().optional(),
      longform: z.boolean().optional(),
      linked_accounts: z.array(z.object({
        id: z.number().optional(),
        platform: z.string(),
        url: z.string(),
      })).optional(),
      content_idea_preferences: z.string().optional().describe("Persistent rules, newline-separated: '- always use statement hooks\\n- never mention competitors'"),
    }).optional().describe("Brand: config, keywords, platforms, preferences"),
  },
  async ({ agent_id, identity, voice, brand }) => {
    const body: Record<string, unknown> = {};
    if (identity) body.identity = identity;
    if (voice) body.voice = voice;
    if (brand) body.brand = brand;
    const data = await agentApiCall("POST", `/agent/profile?agent_id=${agent_id}`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_agent_profile",
  "Update an existing agent profile. Only send the sections and fields you want to change. Array fields (keywords, platforms, linked_accounts) are replaced entirely, not appended.",
  {
    agent_id: z.string().describe("The agent ID"),
    identity: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      persona: z.string().optional(),
    }).optional(),
    voice: z.object({
      eleven_lab_api_key: z.string().optional(),
      hume_ai_api_key: z.string().optional(),
      default_voice: z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        provider: z.string().optional(),
      }).optional(),
    }).optional(),
    brand: z.object({
      brand_name: z.string().optional(),
      description: z.string().optional(),
      goal: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      target_platforms: z.array(z.string()).optional(),
      shortform: z.boolean().optional(),
      longform: z.boolean().optional(),
      linked_accounts: z.array(z.object({
        id: z.number().optional(),
        platform: z.string(),
        url: z.string(),
      })).optional(),
      content_idea_preferences: z.string().optional().describe("Persistent rules, newline-separated"),
    }).optional(),
  },
  async ({ agent_id, identity, voice, brand }) => {
    const body: Record<string, unknown> = {};
    if (identity) body.identity = identity;
    if (voice) body.voice = voice;
    if (brand) body.brand = brand;
    const data = await agentApiCall("PUT", `/agent/profile?agent_id=${agent_id}`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_reset_agent_profile",
  "Reset the agent's brand configuration (TrendPulse config). Clears brand name, keywords, platforms, linked accounts, and content preferences. Does NOT delete the agent or voice settings.",
  {
    agent_id: z.string().describe("The agent ID"),
  },
  async ({ agent_id }) => {
    const data = await agentApiCall("DELETE", `/agent/profile?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

// ── Content Ideas (agent.gen.pro) ─────────────────────────────────────────

server.tool(
  "gen_generate_content_ideas",
  "Generate data-driven video content ideas for an agent. Analyzes trending videos with engagement-weighted hooks and transcripts. Specify num_ideas (default 5), video_type filter, and per-batch requirements. Returns run_id — poll with gen_get_run_status until completed.",
  {
    agent_id: z.string().describe("The agent ID to generate ideas for"),
    message: z.string().optional().describe("Natural language request, e.g. 'generate 10 montage ideas focused on before/after transformations'"),
    num_ideas: z.number().optional().describe("Number of ideas (1-50, default 5)"),
    requirements: z.array(z.string()).optional().describe("Per-batch constraints: ['focus on before/after', 'under 12 seconds']"),
    video_type: z.string().optional().describe("Filter: talking_avatar | green_screen | montage | text_driven | pov_object | voiceover | split_screen | skit"),
    conversation_id: z.string().optional().describe("Continue existing conversation to refine ideas"),
  },
  async ({ agent_id, message, num_ideas, requirements, video_type, conversation_id }) => {
    let msg = message || `generate ${num_ideas || 5} content ideas`;
    if (requirements?.length) msg += ". Requirements: " + requirements.join(". ");
    if (video_type) msg += `. Use ${video_type} format only.`;
    const body: Record<string, unknown> = { message: msg, agent_id };
    if (conversation_id) body.conversation_id = conversation_id;
    const data = await agentApiCall("POST", "/agent/run", body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_refine_content_ideas",
  "Give feedback on previously generated content ideas to get revised versions. Must pass the conversation_id from the original generation.",
  {
    agent_id: z.string().describe("The agent ID"),
    conversation_id: z.string().describe("The conversation_id from the original generation"),
    feedback: z.string().describe("Feedback, e.g. 'make idea 1 hook shorter' or 'redo ideas 2 and 4 as montage'"),
  },
  async ({ agent_id, conversation_id, feedback }) => {
    const data = await agentApiCall("POST", "/agent/run", { message: feedback, agent_id, conversation_id });
    return jsonResult(data);
  }
);

server.tool(
  "gen_set_content_preference",
  "Set a persistent content generation rule for an agent. Applies to ALL future generations. Different from per-batch requirements which only apply once.",
  {
    agent_id: z.string().describe("The agent ID"),
    preference: z.string().describe("Rule to save, e.g. 'always use statement hooks' or 'target women 25-34'"),
    conversation_id: z.string().optional().describe("Optional conversation context"),
  },
  async ({ agent_id, preference, conversation_id }) => {
    const body: Record<string, unknown> = { message: `Remember this content preference for all future ideas: ${preference}`, agent_id };
    if (conversation_id) body.conversation_id = conversation_id;
    const data = await agentApiCall("POST", "/agent/run", body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_run_status",
  "Poll the status of an agent run. Returns 'running', 'completed', or 'failed'. When completed, messages array has the result. Poll every 5 seconds.",
  {
    run_id: z.string().describe("The run_id from gen_generate_content_ideas or gen_refine_content_ideas"),
  },
  async ({ run_id }) => {
    const data = await agentApiCall("GET", `/agent/runs/${run_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_list_content_ideas",
  "List all generated content ideas for an agent. Filter by status: generated, approve_to_create, ready_for_review, approved, published.",
  {
    agent_id: z.string().describe("The agent ID"),
    status: z.string().optional().describe("Filter by status"),
  },
  async ({ agent_id, status }) => {
    let path = `/agent/ideas?agent_id=${agent_id}`;
    if (status) path += `&status=${status}`;
    const data = await agentApiCall("GET", path);
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_idea_status",
  "Update the status of a content idea. Flow: generated → approve_to_create → ready_for_review → approved → published.",
  {
    idea_id: z.string().describe("The idea ID"),
    status: z.string().describe("New status value"),
  },
  async ({ idea_id, status }) => {
    const data = await agentApiCall("PUT", `/agent/ideas/${idea_id}/status/${status}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_list_conversations",
  "List agent chat conversations with titles and metadata.",
  {
    agent_id: z.string().optional().describe("Filter by agent ID"),
  },
  async ({ agent_id }) => {
    let path = "/agent/conversations";
    if (agent_id) path += `?agent_id=${agent_id}`;
    const data = await agentApiCall("GET", path);
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_conversation",
  "Get a conversation with all messages. Use to review chat history and previously generated ideas before refining.",
  {
    conversation_id: z.string().describe("The conversation ID"),
  },
  async ({ conversation_id }) => {
    const data = await agentApiCall("GET", `/agent/conversations/${conversation_id}`);
    return jsonResult(data);
  }
);

// ── Research ──────────────────────────────────────────────────────────────────

server.tool(
  "gen_run_research",
  "Research a topic across 10+ platforms (Reddit, X, YouTube, TikTok, Instagram, HN, Perplexity, Gemini). Returns structured findings with source counts, citations, and AI synthesis. Use for trend analysis, competitive research, or grounding content ideas in real data.",
  {
    topic: z.string().describe("Research topic (e.g. 'tariffs on beauty imports 2026', 'skincare routine trends')"),
    depth: z.enum(["quick", "default", "deep"]).optional().describe("Research depth — quick (~30s), default (~2min), deep (~5min)"),
    agent_id: z.string().describe("The agent ID"),
  },
  async ({ topic, depth, agent_id }) => {
    const body: Record<string, unknown> = { topic, agent_id };
    if (depth) body.depth = depth;
    const data = await agentApiCall("POST", "/research", body);
    return jsonResult(data);
  }
);

// ── Start server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
