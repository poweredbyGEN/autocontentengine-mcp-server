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
  version: "0.1.0",
});

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
  "Trigger content generation for a cell (e.g. script, image, video)",
  {
    engine_id: z.string().describe("The engine ID"),
    cell_id: z.string().describe("The cell ID to generate content for"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
    generation_type: z.string().describe("Type of generation (e.g. 'script', 'image', 'video')"),
    data: z.record(z.string(), z.unknown()).optional().describe("Additional generation parameters"),
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
  "Get the status and result of a generation job",
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
