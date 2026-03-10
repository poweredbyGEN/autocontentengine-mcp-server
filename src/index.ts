#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.GEN_API_KEY;
const BASE_URL = process.env.GEN_API_BASE_URL || "https://api.gen.pro/v1";

if (!API_KEY) {
  console.error("GEN_API_KEY environment variable is required");
  process.exit(1);
}

const API_REFERENCE = `# GEN Auto Content Engine API Reference

Base URL: ${BASE_URL}
Auth: X-API-Key header (Personal Access Token)

## Getting a Personal Access Token (PAT)

1. Log in to GEN at https://gen.pro
2. Go to Settings → API Keys (or navigate to the API Keys section)
3. Click "Create API Key", give it a name
4. Copy the token immediately — it's only shown once
5. Use it as: X-API-Key: ref_your_token_here

Alternatively, create via API (requires existing auth):
POST /v1/persisted_tokens with body { "name": "my-key" }

## Concepts

- **Workspace/Organization**: Top-level container for a company or brand
- **Agent**: A brand identity with voice, personality, and strategy. All API calls are scoped to an agent via agent_id.
- **Auto Content Engine (ACE)**: A spreadsheet-like workspace with columns, rows, and cells for batch content production
- **Column**: Defines a content type (text, image, video, speech, etc.) via its creation card type
- **Row**: One piece of content across all columns
- **Cell**: Intersection of row + column. Contains the generated content.
- **Layer**: Video composition layer within a cell (text overlay, sound, clip)
- **Generation**: An async AI job that produces content in a cell or layer

## Typical Workflow

1. gen_list_agents → pick an agent_id
2. gen_get_engine or gen_create_engine → get/create an engine
3. gen_list_columns → see what content types exist
4. gen_create_row → add a new content row
5. gen_update_cell → set cell values (e.g. script text)
6. gen_generate_content → trigger AI generation
7. gen_get_generation → poll until status is "completed"

## Generation Types (for gen_generate_content)

### Text
generation_type: "text_generation"
data: { model: "gemini" | "openai", prompt: "Write a 30-second script about..." }

### Image from Text
generation_type: "gemini_image_generation"
data: { prompt: "...", model: "gemini" | "gemini_pro", aspect_ratio: "1024:1024" | "576:1024" | "1024:576", number_of_images: 1 }

generation_type: "midjourney"
data: { prompt: "..." }

### Video from Text
generation_type: "gemini_video_generation"
data: { prompt: "...", model: "veo3" | "veo3-fast" | "veo3-1" | "veo3-1-fast", aspect_ratio: "1024:576", duration: 8, negative_prompt: "..." }

generation_type: "sora2_video_generation"
data: { prompt: "...", aspect_ratio: "1024:576", duration: 10 }

generation_type: "kling"
data: { prompt: "...", model: "kling-v1-6", aspect_ratio: "576:1024", duration: 5 }

generation_type: "seedance_video_generation"
data: { prompt: "...", model: "seedance-1.0-pro" | "seedance-1.5-pro", aspect_ratio: "576:1024", duration: 5 }

### Video from Image
generation_type: "kling_image_video"
data: { prompt: "...", model: "kling-v2-1" | "kling-v2-6", image_content_resource_id: 123, aspect_ratio: "576:1024", duration: 5 }

### Speech from Text (ElevenLabs)
generation_type: "eleven_labs"
data: { voice_id: "...", script: "Text to speak", enhance_voice: true }

### Lipsync
generation_type: "lipsync"
data: { model: "sync.so" | "gen", video_content_resource_id: 123, audio_content_resource_id: 456 }

### Captions
generation_type: "captions"
data: { audio_content_resource_id: 123 }

## Generation Status Flow
pending → processing → completed | failed | stopped

Poll GET /v1/generations/{id} until status is "completed".
On completion: result (text) or output_resources (media URLs).
Credits are pre-charged; refunded on failure/stop.

## All Endpoints

### Discovery
- GET /v1/me → user profile
- GET /v1/workspaces → [{id, name}]
- GET /v1/agents?workspace_id={id} → [{id, name, role, organization}]

### Agents (CRUD)
- POST /v1/agents → create agent
- GET /v1/agents/{id} → agent details
- PATCH /v1/agents/{id} → update agent
- DELETE /v1/agents/{id} → soft-delete agent
- GET /v1/agents/{id}/avatars → list avatars
- POST /v1/agents/{id}/avatars → upload avatar
- DELETE /v1/agents/{id}/avatars/{avatar_id} → delete avatar

### Organizations (CRUD)
- GET /v1/organizations → list orgs with credits, role, plan
- POST /v1/organizations → create org
- GET /v1/organizations/{id} → org details
- PATCH /v1/organizations/{id} → update org (owner/manager)
- DELETE /v1/organizations/{id} → delete org (owner only, irreversible)

### Auto Content Engine
- POST /v1/autocontentengine?agent_id={id} → create engine
- GET /v1/autocontentengine/{id}?agent_id={id} → get engine with all data
- POST /v1/autocontentengine/{id}/clone?agent_id={id} → clone engine

### Rows, Columns, Cells, Layers
- Standard CRUD on /v1/autocontentengine/{id}/rows|columns|cells|layers
- All require agent_id query parameter

### Content Resources
- GET /v1/content_resources?agent_id={id} → list files (images, videos, audio)
- POST /v1/content_resources?agent_id={id} → upload file
- GET /v1/content_resources/{id}?agent_id={id} → file details
- DELETE /v1/content_resources/{id}?agent_id={id} → delete file
- GET /v1/asset_libraries?agent_id={id} → browse asset library (files + folders)
- POST /v1/direct_upload → get pre-signed S3 URL for large uploads

### API Keys
- POST /v1/persisted_tokens → create PAT (token shown once)
- GET /v1/persisted_tokens → list PATs
- DELETE /v1/persisted_tokens/{id}/revoke → revoke PAT

## Error Format
{ error: "message", error_code: "machine_code" }
Common: 401 unauthorized, 404 not_found, 422 usable_gen_credit_required, 422 agent_not_found
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

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({
  name: "autocontentengine",
  version: "0.2.0",
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

// ── Engine tools ─────────────────────────────────────────────────────────────

server.tool(
  "gen_create_engine",
  "Create a new Auto Content Engine for an agent",
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

// ── Generation tools ─────────────────────────────────────────────────────────

server.tool(
  "gen_generate_content",
  `Trigger AI content generation for a cell. Returns a generation_id — poll with gen_get_generation until status is "completed".

Generation types and their data params:
- TEXT: generation_type="text_generation", data={model:"gemini"|"openai", prompt:"..."}
- IMAGE: generation_type="gemini_image_generation", data={prompt:"...", model:"gemini"|"gemini_pro", aspect_ratio:"1024:1024"|"576:1024"|"1024:576", number_of_images:1}
- IMAGE (Midjourney): generation_type="midjourney", data={prompt:"..."}
- VIDEO (Veo): generation_type="gemini_video_generation", data={prompt:"...", model:"veo3"|"veo3-fast"|"veo3-1"|"veo3-1-fast", duration:8, negative_prompt:"..."}
- VIDEO (Sora): generation_type="sora2_video_generation", data={prompt:"...", duration:10}
- VIDEO (Kling): generation_type="kling", data={prompt:"...", model:"kling-v1-6", duration:5}
- VIDEO (Seedance): generation_type="seedance_video_generation", data={prompt:"...", model:"seedance-1.0-pro"|"seedance-1.5-pro"}
- SPEECH: generation_type="eleven_labs", data={voice_id:"...", script:"...", enhance_voice:true}
- LIPSYNC: generation_type="lipsync", data={model:"sync.so"|"gen", video_content_resource_id:123, audio_content_resource_id:456}
- CAPTIONS: generation_type="captions", data={audio_content_resource_id:123}

Credits are pre-charged and refunded on failure/stop.`,
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID to generate content for"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
    generation_type: z.string().describe("text_generation | gemini_image_generation | midjourney | gemini_video_generation | sora2_video_generation | kling | seedance_video_generation | eleven_labs | lipsync | captions"),
    data: z.record(z.string(), z.unknown()).optional().describe("Generation-specific parameters (prompt, model, aspect_ratio, duration, voice_id, etc.)"),
  },
  async ({ engine_id, cell_id, agent_id, generation_type, data: extraData }) => {
    const body: Record<string, unknown> = { agent_id, generation_type };
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
  "Create a new column in an Auto Content Engine",
  {
    engine_id: z.string().describe("The engine ID"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
    title: z.string().describe("Column title"),
    type: z.string().describe("Column type"),
    position: z.number().optional().describe("Column position (0-indexed)"),
  },
  async ({ engine_id, agent_id, title, type, position }) => {
    const body: Record<string, unknown> = { agent_id, title, type };
    if (position !== undefined) body.position = position;
    const data = await apiCall("POST", `/autocontentengine/${engine_id}/columns`, body);
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
