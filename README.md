# GEN MCP Server

MCP (Model Context Protocol) server for the GEN platform. Lets Claude Code
and any MCP-compatible AI interact with the GEN Auto Content Engine + Agent
Core directly.

**This server is organized around the 5-step user journey** every GEN user
follows, from onboarding an agent to publishing a video. Tool descriptions
start with the step name (e.g. "Step 4 (Edit & Generate): …") so AI tooling
can route quickly.

## Install

```bash
npm install -g @poweredbygen/gen-mcp-server
```

Or run directly with npx:

```bash
npx @poweredbygen/gen-mcp-server
```

## Configure Claude Code

Add the MCP server:

```bash
claude mcp add gen -- npx @poweredbygen/gen-mcp-server
```

Set your API key (Personal Access Token from https://gen.pro — log in, pick
an agent, open the **API** page in the sidebar, click **Create API Key**):

```bash
export GEN_API_KEY=your-api-key
```

Optional base-URL overrides:

```bash
export GEN_API_BASE_URL=https://api.gen.pro/v1
export GEN_AGENT_API_URL=https://agent.gen.pro/v1
```

## The 5-Step Journey

```
Step 1           Step 2            Step 3              Step 4             Step 5
──────           ──────            ──────              ──────             ──────
Set Up    →    Generate    →     Idea to      →     Edit &      →     Export &
Agent          Ideas             Vidsheet            Generate           Publish
```

Read `gen://api-reference` (an MCP resource exposed by this server) for the
full teaching document — it walks through each step with narrative, top
tools, and chained curl examples.

## Available Tools

### Step 1 — Set Up Your Agent

Discovery, workspaces, agent CRUD, identity/overview/personality/voice setup,
API keys.

- `gen_get_me`, `gen_list_workspaces`, `gen_list_agents`
- `gen_list_organizations`, `gen_create_organization`, `gen_get_organization`, `gen_update_organization`, `gen_delete_organization`
- `gen_create_agent`, `gen_get_agent`, `gen_update_agent`, `gen_delete_agent`
- `gen_list_agent_avatars`, `gen_create_agent_avatar`, `gen_delete_agent_avatar`
- **`gen_get_agent_core`** / **`gen_update_agent_core`** — STAR tools (one call reads or writes every setup section)
- `gen_add_agent_account`, `gen_add_agent_inspiration`
- `gen_get_agent_profile`, `gen_create_agent_profile`, `gen_update_agent_profile`, `gen_reset_agent_profile`
- `gen_connect_agent_elevenlabs`, `gen_list_agent_voices`
- Voice design flow: `gen_generate_voice_script` → `gen_generate_voice_description` → `gen_generate_voice_samples` → `gen_design_voice`
- `gen_clone_voice`, `gen_preview_voice`, `gen_get_voice_preview_status`, `gen_delete_voice`
- `gen_list_api_keys`, `gen_create_api_key`, `gen_revoke_api_key`

### Step 2 — Generate Content Ideas

AI-driven idea generation grounded in trend data, refinement, preferences,
research, conversations, and monitoring jobs.

- **`gen_generate_content_ideas`** — starting point
- `gen_get_run_status`, `gen_list_content_ideas`, `gen_update_idea_status`
- `gen_refine_content_ideas`, `gen_set_content_preference`
- `gen_list_conversations`, `gen_get_conversation`
- `gen_run_research`
- `gen_create_monitoring_job`, `gen_update_monitoring_job`

### Step 3 — Convert Idea to Vidsheet

Clone a template or build from scratch. After cloning, PATCH cells to inject the idea's script / hook / variables.

- `gen_list_templates`, `gen_get_template`, **`gen_clone_template`**
- `gen_create_engine`, `gen_get_engine`, `gen_clone_engine`

### Step 4 — Edit & Generate

Columns, rows, cells, layers, variables, content resources, and AI
generations (text/image/video/speech/lipsync/captions).

- `gen_list_columns`, `gen_create_column`, `gen_update_column`, `gen_delete_column`
- `gen_list_rows`, `gen_create_row`, `gen_duplicate_row`
- `gen_get_cell`, `gen_update_cell`
- `gen_create_layer`, `gen_get_layer`, `gen_update_layer`, `gen_delete_layer`
- `gen_list_variables`
- `gen_list_content_resources`, `gen_create_content_resource`, `gen_get_content_resource`, `gen_update_content_resource`, `gen_delete_content_resource`
- `gen_list_asset_libraries`, `gen_create_direct_upload`
- **`gen_generate_content`** — the workhorse (all canonical generation types)
- `gen_generate_layer`, `gen_get_generation`, `gen_stop_generation`, `gen_continue_generation`

### Step 5 — Export & Publish

- **`gen_render_video`** — composite the final MP4
- **`gen_publish_content`** — post or schedule to a connected social account

## Development

```bash
git clone https://github.com/poweredbyGEN/gen-mcp-server.git
cd gen-mcp-server
npm install
npm run build
GEN_API_KEY=your-key npm start
```

## See also

- **TypeScript SDK:** [github.com/poweredbyGEN/gen-typescript-sdk](https://github.com/poweredbyGEN/gen-typescript-sdk) — type-safe client for Node.js and TypeScript projects
- **API Docs:** [api.gen.pro](https://api.gen.pro) — full API reference and guides

## Changelog

### 0.5.0
- Restructured all 81 tools around the 5-step user journey (GEN-2879)
- Rewrote the embedded `gen://api-reference` resource as a step-by-step teaching document with chained curl examples
- Tool descriptions now start with the phase (e.g. "Step 1 (Agent Setup): …") so AI tooling can route quickly

### 0.4.x
- Added Agent Core flat endpoints (GEN-2755)
- Stripped vendor branding from tool descriptions
- Added `gen_run_research`, expanded API_REFERENCE with agentic chat docs
- Content monitoring + publishing tools

## License

MIT
