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

// ─────────────────────────────────────────────────────────────────────────────
// API_REFERENCE — The system prompt served at gen://api-reference
// Teaches AI the 5-step user journey. Read this first before using any tool.
// ─────────────────────────────────────────────────────────────────────────────

const API_REFERENCE = `# GEN MCP — System Prompt & API Reference

## About GEN

GEN is an Autonomous Social Media Agent platform. An *agent* is a brand identity
that detects trends, generates video content (text, images, video, speech,
lipsync, captions), publishes across platforms, and improves automatically.

This MCP server gives you programmatic access to the whole loop. You are
interacting with GEN through MCP tools. This reference teaches you **the
5-step journey** every user takes, and which tools belong to each step.

## Authentication

All calls use a Personal Access Token (PAT) sent as \`X-API-Key\`.

1. Log in at https://gen.pro
2. Pick an agent
3. Go to the **API** page in the sidebar
4. Click **Create API Key**
5. Copy the token (shown once) → set as \`GEN_API_KEY\`

Manage PATs programmatically with \`gen_list_api_keys\`,
\`gen_create_api_key\`, \`gen_revoke_api_key\`.

## Mental Model

Think of GEN as a hierarchy:

1. **Workspace (Organization)** — a company or brand container. Holds billing,
   team members, and credits.
2. **Agent** — a brand identity inside a workspace. Has a name, personality,
   voice, inspiration sources, and its own social accounts. **Every content
   operation is scoped to an agent via \`agent_id\`.**
3. **Vidsheet (Auto Content Engine)** — a spreadsheet-like production pipeline
   attached to an agent. Each column is a content type, each row is one piece
   of content, each cell holds generated or user-supplied media.
4. **Creation Cards** — the generation recipes inside cells. A creation card
   says "generate a video from this text with this model at this aspect ratio".

Within a vidsheet:
- **Columns** define content types (text script, hero image, video clip, VO, etc.)
- **Rows** represent one piece of content across all columns
- **Cells** are the intersection of a row and column — where content lives
- **Layers** are composition elements within a video cell (overlays, tracks, clips)
- **Generations** are async AI jobs that produce content in a cell or layer

─────────────────────────────────────────────────────────────────────────────

# The 5-Step Journey

Every user of GEN — human or AI — follows the same 5-step arc. This server's
80+ tools are organized around it. **Always know which step you're in.**

\`\`\`
  Step 1           Step 2            Step 3             Step 4            Step 5
  ──────           ──────            ──────             ──────            ──────
  Set Up    →    Generate    →     Idea to      →     Edit &     →     Export &
  Agent          Ideas             Vidsheet           Generate          Publish
\`\`\`

─────────────────────────────────────────────────────────────────────────────

## Step 1 — Set Up Your Agent

**What this step does.** Before content can be made, the agent needs identity.
You create a workspace (organization), create an agent inside it, teach it who
it is (overview, personality, inspiration sources, look, voice), and attach the
API keys (PAT + voice provider) it needs to generate content.

Think of this as onboarding. Do it once per agent. Do it well — the downstream
ideas and videos are only as good as the identity and voice set here.

**Top tools for this step:**

| Tool | When to use |
|---|---|
| \`gen_get_me\` | Start here. Verify your PAT works and see which workspaces you belong to. |
| \`gen_list_organizations\` | List workspaces. Each agent lives inside one. |
| \`gen_create_organization\` | New workspace. Needed only if the user doesn't already have one. |
| \`gen_list_agents\` | List agents in a workspace. Use the returned \`agent_id\` for everything else. |
| \`gen_create_agent\` | New agent inside a workspace. Pass \`organization_id\`. |
| \`gen_get_agent_core\` | **STAR tool for reads.** Returns identity + overview + personality + inspiration + voice + look + accounts in one call. Always read before updating. |
| \`gen_update_agent_core\` | **STAR tool for writes.** Set identity/overview/personality/voice in one call. Merge semantics for identity and overview; replace semantics for personality, inspiration, voice, accounts. |
| \`gen_list_agent_voices\` | Browse available voices (public + user_designed + user_trained + user_elevenlabs). Pick one, then bind it via \`gen_update_agent_core\` voice section. |
| \`gen_connect_agent_elevenlabs\` | Attach the user's ElevenLabs key so custom voices appear in the voice library. |
| \`gen_create_api_key\` | Issue a PAT the agent or its downstream tools can use. Returned plain text ONCE. |

**Voice design flow** (only if the user wants to design a new voice here
rather than using the web UI):
\`gen_generate_voice_script\` → \`gen_generate_voice_description\` →
\`gen_generate_voice_samples\` → \`gen_design_voice\`.
For cloning from a sample clip, use \`gen_clone_voice\` (synchronous). To
audition any voice, \`gen_preview_voice\` + \`gen_get_voice_preview_status\`.

**Example — from zero to a ready agent:**

\`\`\`bash
# 1. Verify auth and pick a workspace
curl https://api.gen.pro/v1/me \\
  -H "X-API-Key: \$GEN_API_KEY"

# 2. Create an agent in that workspace
curl -X POST https://api.gen.pro/v1/agents \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{"organization_id":"<workspace_id>","agent":{"name":"Santiago"}}'
# → returns {"id":"<agent_id>", ...}

# 3. Fill in identity + overview + personality in one call
curl -X PATCH https://api.gen.pro/v1/agents/<agent_id>/core \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{
    "identity": {"name": "Santiago", "profile_photo_url": "https://..."},
    "overview": {
      "brand_name": "Santiago Fitness",
      "description": "Home workouts for busy parents",
      "identity_type": "character",
      "goal": "growth",
      "keywords": ["home workouts","busy parents","no equipment"],
      "target_platforms": ["tiktok","instagram"],
      "shortform": true
    },
    "personality": "Warm, disciplined, early-morning energy. Never preachy.",
    "inspiration": [
      {"url": "https://tiktok.com/@some_creator", "platform": "tiktok"}
    ]
  }'
\`\`\`

→ Continue to Step 2 with the \`agent_id\` in hand.

─────────────────────────────────────────────────────────────────────────────

## Step 2 — Generate Content Ideas

**What this step does.** The agent has an identity. Now you ask it for ideas.
Ideas aren't just titles — each one is a full video concept grounded in real
trend data (Reddit, X, TikTok, Instagram, YouTube, HN, Perplexity, Gemini),
with a hook, full script, estimated duration, video type, pre-selected assets,
and a timeline manifest. You can refine iteratively in conversation, set
persistent preferences, and optionally trigger content monitoring jobs that
keep scraping trending posts in the background.

This step is powered by the **agent.gen.pro** service (a separate base URL
from Rails). Tools that hit it live under "Agent Ideas" below.

**Top tools for this step:**

| Tool | When to use |
|---|---|
| \`gen_generate_content_ideas\` | **Starting point.** Generates N video ideas for an agent. Returns a \`run_id\` — poll with \`gen_get_run_status\`. |
| \`gen_get_run_status\` | Poll every 5s until \`completed\`. Ideas arrive in the messages array. |
| \`gen_list_content_ideas\` | List all ideas for the agent (across runs). Filter by status. |
| \`gen_refine_content_ideas\` | Feedback on existing ideas — "redo idea 2 as a montage". Requires the \`conversation_id\` from the original run. |
| \`gen_set_content_preference\` | Persistent rules that apply to EVERY future generation ("always use statement hooks", "never mention competitors"). Different from per-batch \`requirements\`. |
| \`gen_update_idea_status\` | Promote an idea: generated → approve_to_create → ready_for_review → approved → published. |
| \`gen_run_research\` | Standalone research on any topic. Use for trend hunts before generating ideas. |
| \`gen_create_monitoring_job\` | Schedule ongoing scrapes of a hashtag/creator/keyword — the data feeds back into future idea generation. |
| \`gen_list_conversations\` / \`gen_get_conversation\` | Review chat history before refining. |

**Three layers of control**

- **Per-batch requirements** — one-time constraints passed to
  \`gen_generate_content_ideas\` (\`requirements: ["under 12 seconds"]\`).
- **Long-term preferences** — persistent rules via
  \`gen_set_content_preference\`. Apply to ALL future runs.
- **Feedback/refinement** — iterate on specific ideas in the same conversation
  via \`gen_refine_content_ideas\`.

**Video types** (pass as \`video_type\` filter):
\`talking_avatar\`, \`green_screen\`, \`montage\`, \`text_driven\`, \`pov_object\`,
\`voiceover\`, \`split_screen\`, \`skit\`.

**Each idea returns:** \`title\`, \`hook\`, \`full_script\`, \`video_type\`,
\`estimated_duration\`, \`selected_assets[]\` (pre-picked images/videos/audio with
\`clip_range\` and recommended \`usage\`), \`project_manifest\` (timeline_layers),
\`inspiration_sources[]\`, \`rationale\`.

**Example — generate 5 ideas and poll to completion:**

\`\`\`bash
# 1. Kick off a run
curl -X POST https://agent.gen.pro/v1/agent/run \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{"agent_id":"<agent_id>","message":"generate 5 montage ideas focused on before/after"}'
# → {"run_id":"<run_id>", "conversation_id":"<conv_id>"}

# 2. Poll
curl "https://agent.gen.pro/v1/agent/runs/<run_id>" \\
  -H "X-API-Key: \$GEN_API_KEY"
# → {"status":"completed", "messages":[{"ideas":[...]}]}

# 3. Approve the best one
curl -X PUT "https://agent.gen.pro/v1/agent/ideas/<idea_id>/status/approve_to_create" \\
  -H "X-API-Key: \$GEN_API_KEY"
\`\`\`

→ Continue to Step 3 carrying the approved \`idea_id\`.

─────────────────────────────────────────────────────────────────────────────

## Step 3 — Convert Idea to Vidsheet

**What this step does.** An approved idea is still abstract — it has a script
and an asset list but nothing to edit or render yet. This step materializes the
idea into a **vidsheet** (Auto Content Engine): a spreadsheet-like pipeline
pre-populated with the right columns (text, image, video, audio, final_video,
stats) and rows.

Two paths:
- **Template path** (fastest): clone a pre-configured template into the agent.
  Templates come with columns and example rows wired up for common formats
  like "Talking Avatar", "Montage", "Split Screen". Use this 80% of the time.
- **From-idea path** (one call): \`gen_create_vidsheet_from_idea\` takes an
  approved \`idea_id\` and creates a vidsheet with the right columns and a first
  row pre-filled from the idea's script and selected assets. This is the
  single-call bridge between Step 2 and Step 4.
- **From-scratch path**: create an empty engine and build columns manually.
  Only reach for this if neither template nor idea bridge fits.

**Top tools for this step:**

| Tool | When to use |
|---|---|
| \`gen_list_templates\` | Browse pre-built vidsheet templates. Check here FIRST. |
| \`gen_get_template\` | Inspect a template's columns and structure before cloning. |
| \`gen_clone_template\` | Clone a template into the agent. Returns a ready-to-edit vidsheet. The **fastest** path to production. |
| \`gen_create_vidsheet_from_idea\` | **The idea → vidsheet bridge.** Pass \`idea_id\` + \`agent_id\`. Creates a vidsheet pre-configured from the approved idea (script, selected assets, video_type-appropriate columns). |
| \`gen_create_engine\` | Create an empty engine. Use only if templates and the idea bridge don't fit. |
| \`gen_get_engine\` | Fetch an engine with all columns, rows, cells in one call — do this before editing. |
| \`gen_clone_engine\` | Duplicate an existing engine (same agent or cross-agent). |

**Example — from approved idea to ready vidsheet:**

\`\`\`bash
# Option A: single-call bridge (preferred)
curl -X POST https://api.gen.pro/v1/vidsheet/from_idea \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{"agent_id":"<agent_id>","idea_id":"<idea_id>"}'
# → {"engine_id":"<engine_id>", "columns":[...], "rows":[{"id":"<row_id>", ...}]}

# Option B: template path
curl https://api.gen.pro/v1/templates/projects \\
  -H "X-API-Key: \$GEN_API_KEY"
# → pick a slug like "tiktok-montage-v2"

curl -X POST https://api.gen.pro/v1/templates/spreadsheets/tiktok-montage-v2/clone \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{"agent_id":"<agent_id>"}'
# → {"engine_id":"<engine_id>", ...}
\`\`\`

→ Continue to Step 4 with \`engine_id\` + \`agent_id\`.

─────────────────────────────────────────────────────────────────────────────

## Step 4 — Edit & Generate

**What this step does.** The vidsheet exists, rows exist, columns exist. Now
you fill the ingredient cells (scripts, prompts, reference images) and trigger
AI generations to produce text, images, video clips, speech, lipsync, and
captions. You can stack **layers** inside a video cell to compose overlays,
tracks, and clips. Every generation returns a \`generation_id\` you poll until
\`completed\`; completed generations expose \`result\` (text) or \`output_resources\`
(media URLs).

This is the biggest step and where most tool calls happen.

**Column types:** \`text\`, \`image\`, \`video\`, \`audio\`.
**Column roles:** only \`ingredient\` role columns can be user-created or
deleted. \`video\`, \`final_video\`, \`stats\`, and \`global_variable_*\` roles are
system-managed.

**Top tools for this step:**

| Tool | When to use |
|---|---|
| \`gen_list_columns\` / \`gen_create_column\` / \`gen_update_column\` / \`gen_delete_column\` | Shape the vidsheet. Only ingredient columns are editable. |
| \`gen_list_rows\` / \`gen_create_row\` / \`gen_duplicate_row\` | One row = one piece of content. Duplicate to batch-generate variants. |
| \`gen_get_cell\` / \`gen_update_cell\` | Fill in scripts, prompts, ingredient values. Text cells are the inputs that drive AI generations. |
| \`gen_generate_content\` | **The workhorse.** Trigger a generation inside a cell. Pass \`generation_type\` + \`data\`. See canonical types below. Returns \`generation_id\`. |
| \`gen_get_generation\` | Poll a generation until \`status\` is \`completed\`. Every 5–10s for video, every 2–5s for text/image. |
| \`gen_stop_generation\` / \`gen_continue_generation\` | Cancel a running job (credits refund) or resume a stopped one (credits re-charge). |
| \`gen_create_layer\` / \`gen_get_layer\` / \`gen_update_layer\` / \`gen_delete_layer\` | Compose video cells. Layers stack overlays, tracks, clips with a position and additional_attributes. |
| \`gen_generate_layer\` | Trigger generation inside a specific layer (sub-generation inside a cell). |
| \`gen_list_variables\` | Global variables available for template substitution in prompts (\`{{variable_name}}\`). |
| \`gen_list_content_resources\` / \`gen_create_content_resource\` | Files the agent can reference. Images for image-to-video, audio for lipsync, etc. |
| \`gen_create_direct_upload\` | Two-step upload: get a pre-signed URL, PUT the file, then pass the \`signed_id\` to \`gen_create_content_resource\`. |
| \`gen_list_asset_libraries\` | Browse the agent's full asset library with folders, search, type filter. |

**Canonical generation types.** Pass these to \`gen_generate_content\`.
The server maps canonical → internal names automatically:

| Canonical type | \`data\` params | Notes |
|---|---|---|
| \`text\` | \`{ prompt, model, variables? }\` | Models: \`gemini_2_0_flash\`, \`gemini_2_5_pro\`, \`gpt_4o\`, \`gpt_4o_mini\`, \`o3_mini\`, \`o4_mini\`, \`claude_sonnet_4\`. Output in \`result\`. |
| \`image_from_text\` | \`{ prompt, model, aspect_ratio }\` | Models: \`gemini_image\`, \`gemini_pro_image\`, \`midjourney\`. Aspect: \`1:1\`, \`9:16\`, \`16:9\`, \`4:3\`, \`3:4\`. |
| \`video_from_text\` | \`{ prompt, model, aspect_ratio, duration, negative_prompt? }\` | Models: \`veo_3\`, \`veo_3_fast\`, \`veo_3_1\`, \`veo_3_1_fast\`, \`sora_2\`, \`kling_1_6\`, \`seedance_pro\`, \`seedance_pro_1_5\`. Duration 5 or 10. |
| \`video_from_image\` | \`{ prompt, model, image_resource_id, image_tail_resource_id?, aspect_ratio, duration }\` | Models: \`kling_2_1\`, \`kling_2_6\`, \`veo_3\`, \`veo_3_1\`, \`sora_2\`, \`seedance_lite\`, \`seedance_pro\`, \`seedance_pro_1_5\`. |
| \`video_from_ingredients\` | \`{ prompt, model, asset_resource_ids, aspect_ratio, duration }\` | Models: \`pika\`, \`kling_1_6\`, \`seedance_lite\`, \`veo_3_1\`, \`veo_3_1_fast\`. |
| \`speech_from_text\` | \`{ script, voice_method, voice_id?, language?, gender?, enhance_voice?, speed? }\` | \`voice_method\`: \`my_voices\`, \`design_voice\`, \`clone_voice\`. |
| \`lipsync\` | \`{ model, video_resource_id, audio_resource_id }\` | Models: \`sync_so\`, \`gen\`. |
| \`captions\` | \`{ model, source_resource_id }\` | Model: \`gemini\`. |
| \`media\` | \`{ content_resource_id }\` | Attach an existing upload to a cell. |

**Generation status flow.** \`pending → processing → completed | failed | stopped\`.
Credits are pre-charged and refunded on failure/stop.

**Example — generate a text script, then a video from it:**

\`\`\`bash
# 1. Fill the script cell (ingredient text column)
curl -X PATCH https://api.gen.pro/v1/autocontentengine/<engine_id>/cells/<text_cell_id> \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{"agent_id":"<agent_id>","value":"30-second TikTok about 5am workouts, hook then 3 tips."}'

# 2. Run text generation (refines into a polished script)
curl -X POST https://api.gen.pro/v1/autocontentengine/<engine_id>/cells/<text_cell_id>/generate \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "<agent_id>",
    "generation_type": "text",
    "data": {"model":"gpt_4o","prompt":"Write a 30s TikTok script, hook + 3 tips about 5am workouts."}
  }'
# → {"generation_id":"<gen_id>"}

# 3. Poll
curl "https://api.gen.pro/v1/generations/<gen_id>" \\
  -H "X-API-Key: \$GEN_API_KEY"
# → {"status":"completed","result":"Pov: You wake up at 4:55..."}

# 4. Then a video in a different cell, using the polished script
curl -X POST https://api.gen.pro/v1/autocontentengine/<engine_id>/cells/<video_cell_id>/generate \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "<agent_id>",
    "generation_type": "video_from_text",
    "data": {"model":"veo_3","prompt":"cinematic drone shot of a sunrise run","aspect_ratio":"9:16","duration":8}
  }'
\`\`\`

→ Continue to Step 5 once every ingredient cell you care about has a completed
generation.

─────────────────────────────────────────────────────────────────────────────

## Step 5 — Export & Publish

**What this step does.** All the ingredient cells are filled — scripts written,
clips generated, voiceover produced, lipsync resolved, captions timed. Step 5
composites the layers into the final video (render) and optionally posts it to
connected social accounts.

**Top tools for this step:**

| Tool | When to use |
|---|---|
| \`gen_render_video\` | Render the final composed video for a cell in a \`final_video\` column. Combines all layers (video, audio, text overlays, captions) into one deliverable. Returns a \`generation_id\`. |
| \`gen_get_generation\` | Poll the render until \`completed\`. The final MP4 URL is in \`output_resources\`. |
| \`gen_publish_content\` | Post to a connected social account. \`schedule_type: "now"\` for immediate, \`"scheduled"\` with \`scheduled_time\` (ISO 8601 UTC) for future. Requires the agent has a connected account for the platform. |
| \`gen_get_content_resource\` | Confirm the final file exists and grab its public URL for downstream use. |

**Example — render a final video and publish to TikTok:**

\`\`\`bash
# 1. Render the final cell
curl -X POST https://api.gen.pro/v1/autocontentengine/<engine_id>/cells/<final_cell_id>/render \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{"agent_id":"<agent_id>"}'
# → {"generation_id":"<gen_id>"}

# 2. Poll
curl "https://api.gen.pro/v1/generations/<gen_id>" \\
  -H "X-API-Key: \$GEN_API_KEY"
# → {"status":"completed","output_resources":[{"url":"https://.../final.mp4"}]}

# 3. Publish
curl -X POST "https://api.gen.pro/v1/user_jobs?agent_id=<agent_id>" \\
  -H "X-API-Key: \$GEN_API_KEY" -H "Content-Type: application/json" \\
  -d '{
    "user_job_type": "publish_content",
    "data": "{\\"platform\\":\\"tiktok\\",\\"media_url\\":\\"https://.../final.mp4\\",\\"description\\":\\"morning workout tip #fitness\\",\\"schedule_type\\":\\"now\\"}"
  }'
\`\`\`

That's the full loop: identity → ideas → vidsheet → edit + generate → publish.

─────────────────────────────────────────────────────────────────────────────

# Creation Card Types Reference

A **creation card** is the recipe on a generation. When you call
\`gen_generate_content\`, the \`generation_type\` + \`data\` together form the card.
All canonical names below are accepted; the server maps to internal names.

### text
- Canonical: \`text\`
- Models: \`gemini_2_0_flash\`, \`gemini_2_5_pro\`, \`gpt_4o\`, \`gpt_4o_mini\`,
  \`o3_mini\`, \`o4_mini\`, \`claude_sonnet_4\`
- \`data\`: \`{ prompt, model, variables?: {key: value} }\`
- Output: text in \`result\`

### image_from_text
- Canonical: \`image_from_text\`
- Models: \`gemini_image\`, \`gemini_pro_image\`, \`midjourney\`
- \`data\`: \`{ prompt, model, aspect_ratio: "1:1" | "9:16" | "16:9" | "4:3" | "3:4" }\`
- Output: image URLs in \`output_resources\`

### video_from_text
- Canonical: \`video_from_text\`
- Models: \`veo_3\`, \`veo_3_fast\`, \`veo_3_1\`, \`veo_3_1_fast\`, \`sora_2\`,
  \`kling_1_6\`, \`seedance_pro\`, \`seedance_pro_1_5\`
- \`data\`: \`{ prompt, model, aspect_ratio: "1:1" | "9:16" | "16:9", duration: 5 | 10, negative_prompt? }\`

### video_from_image
- Canonical: \`video_from_image\`
- Models: \`kling_2_1\`, \`kling_2_6\`, \`veo_3\`, \`veo_3_1\`, \`sora_2\`,
  \`seedance_lite\`, \`seedance_pro\`, \`seedance_pro_1_5\`
- \`data\`: \`{ prompt, model, image_resource_id, image_tail_resource_id?, aspect_ratio, duration }\`

### video_from_ingredients
- Canonical: \`video_from_ingredients\`
- Models: \`pika\`, \`kling_1_6\`, \`seedance_lite\`, \`veo_3_1\`, \`veo_3_1_fast\`
- \`data\`: \`{ prompt, model, asset_resource_ids: [], aspect_ratio, duration }\`

### speech_from_text
- Canonical: \`speech_from_text\`
- Voice methods: \`my_voices\`, \`design_voice\`, \`clone_voice\`
- \`data\`: \`{ script, voice_method, voice_id?, language?, gender?, enhance_voice?, speed? }\`

### lipsync
- Canonical: \`lipsync\`
- Models: \`sync_so\`, \`gen\`
- \`data\`: \`{ model, video_resource_id, audio_resource_id }\`

### captions
- Canonical: \`captions\`
- Models: \`gemini\`
- \`data\`: \`{ model, source_resource_id }\`

### media (Upload attach)
- Canonical: \`media\`
- \`data\`: \`{ content_resource_id }\`

### render (Final composite)
- Canonical: \`render\`
- Endpoint: \`POST /v1/autocontentengine/{id}/cells/{cell_id}/render?agent_id={id}\`
- Use \`gen_render_video\` — composites all layers into the final video.

# Column Types & Roles

| Type | Description |
|---|---|
| \`text\` | Text content (scripts, prompts, notes) |
| \`image\` | Image content |
| \`video\` | Video content |
| \`audio\` | Audio content |

| Role | Description | User-creatable? |
|---|---|---|
| \`ingredient\` | User-editable input columns | Yes |
| \`video\` | Generated video layer | No (system) |
| \`final_video\` | Final composite video | No (system) |
| \`stats\` | Statistics/metadata | No (system) |
| \`global_variable_name\` | Variable name column | No (system) |
| \`global_variable_value\` | Variable value column | No (system) |

# Error Format

All errors return:

\`\`\`json
{ "error": "Human-readable message", "error_code": "machine_code" }
\`\`\`

Common codes:
- \`401 unauthorized\` — invalid or missing API key
- \`404 not_found\` — resource does not exist or access denied
- \`422 usable_gen_credit_required\` — insufficient credits for the operation
- \`422 agent_not_found\` — invalid \`agent_id\` or no access
- \`422 validation_error\` — request body failed validation
- \`429 rate_limited\` — too many requests, slow down

# Tips for AI Agents

1. **Always start at Step 1** — run \`gen_get_me\` + \`gen_list_agents\` to get a
   valid \`agent_id\` before anything else.
2. **Check templates before building from scratch** in Step 3 — \`gen_list_templates\`
   and \`gen_clone_template\` save hours.
3. **Prefer \`gen_create_vidsheet_from_idea\`** when you already have an approved
   idea — one call gets you from Step 2 → Step 4 ready.
4. **Poll patiently** — video generation runs 30–120s. Poll every 5–10s.
5. **Use \`gen_get_engine\` liberally** — it returns all columns, rows, and cells
   in one call; cheap and fast.
6. **Content resource IDs link media** — when a tool needs an existing media
   file, get the \`content_resource_id\` from a completed generation's
   \`output_resources\`.
7. **Render last.** \`gen_render_video\` is the Step 5 entry point — never call
   it before every ingredient cell is \`completed\`.
`;

// ─────────────────────────────────────────────────────────────────────────────
// API clients. apiCall = Rails (api.gen.pro). agentApiCall = agent.gen.pro.
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Generation type mapping (canonical → Rails internal)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "gen",
  version: "0.5.0",
});

// API Reference resource — Claude reads this first to understand the 5-step journey.
server.resource(
  "api-reference",
  "gen://api-reference",
  {
    description:
      "Full GEN API reference organized around the 5-step user journey (set up agent → generate ideas → idea to vidsheet → edit & generate → export & publish). Read this first before using any tool.",
  },
  async () => ({
    contents: [
      {
        uri: "gen://api-reference",
        mimeType: "text/plain",
        text: API_REFERENCE,
      },
    ],
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1: SET UP YOUR AGENT
//
// Create/inspect workspaces and agents. Configure agent identity, voice,
// inspiration, and API keys. Run this step once per agent before any content
// work begins.
// ═════════════════════════════════════════════════════════════════════════════

// ── Discovery ───────────────────────────────────────────────────────────────

server.tool(
  "gen_get_me",
  "Step 1 (Agent Setup): Get the authenticated user's profile and workspace memberships. Always call first to verify your PAT and discover which workspaces you have access to.",
  {},
  async () => {
    const data = await apiCall("GET", "/me");
    return jsonResult(data);
  }
);

server.tool(
  "gen_list_workspaces",
  "Step 1 (Agent Setup): List all workspaces the authenticated user has access to. A workspace is the billing container; every agent lives inside one.",
  {},
  async () => {
    const data = await apiCall("GET", "/workspaces");
    return jsonResult(data);
  }
);

server.tool(
  "gen_list_agents",
  "Step 1 (Agent Setup): List agents, optionally filtered by workspace. Use the returned agent_id for ALL downstream content operations (ideas, vidsheets, generations).",
  {
    workspace_id: z.string().optional().describe("Filter agents by workspace ID"),
  },
  async ({ workspace_id }) => {
    const params = workspace_id ? `?workspace_id=${workspace_id}` : "";
    const data = await apiCall("GET", `/agents${params}`);
    return jsonResult(data);
  }
);

// ── Organizations (Workspaces) ──────────────────────────────────────────────

server.tool(
  "gen_list_organizations",
  "Step 1 (Agent Setup): List all organizations/workspaces the authenticated user is a member of, including credits, role, and plan.",
  {},
  async () => {
    const data = await apiCall("GET", "/organizations");
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_organization",
  "Step 1 (Agent Setup): Create a new organization/workspace. You become owner automatically. Only needed if the user doesn't already have a workspace.",
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
  "Step 1 (Agent Setup): Get details of a specific organization by ID.",
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
  "Step 1 (Agent Setup): Update an organization's name (requires owner or manager role).",
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
  "Step 1 (Agent Setup): Permanently delete an organization and all associated data (requires owner role, irreversible).",
  {
    organization_id: z.string().describe("The organization ID to delete"),
  },
  async ({ organization_id }) => {
    const data = await apiCall("DELETE", `/organizations/${organization_id}`);
    return jsonResult(data);
  }
);

// ── Agent CRUD ──────────────────────────────────────────────────────────────

server.tool(
  "gen_create_agent",
  "Step 1 (Agent Setup): Create a new agent inside a workspace. After creation, use gen_update_agent_core to fill in identity, overview, personality, voice, and inspiration sources.",
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
  "Step 1 (Agent Setup): Get full details of a specific agent by ID. For reading full setup state (identity + overview + personality + voice + inspiration + accounts), prefer gen_get_agent_core.",
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
  "Step 1 (Agent Setup): Update an existing agent's name, description, time zone, or voice keys. For richer setup updates (personality, inspiration, accounts, voice binding), use gen_update_agent_core.",
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
  "Step 1 (Agent Setup): Soft-delete an agent (requires owner/manager role or being the creator).",
  {
    agent_id: z.string().describe("The agent ID to delete"),
  },
  async ({ agent_id }) => {
    const data = await apiCall("DELETE", `/agents/${agent_id}`);
    return jsonResult(data);
  }
);

// ── Agent Avatars ───────────────────────────────────────────────────────────

server.tool(
  "gen_list_agent_avatars",
  "Step 1 (Agent Setup): List avatar images for an agent, with the primary avatar first.",
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
  "Step 1 (Agent Setup): Create an avatar for an agent using a DeGod avatar ID (for file uploads, use the API directly via direct_upload + a PATCH to the agent).",
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
  "Step 1 (Agent Setup): Delete one or more avatars from an agent (separate multiple IDs with underscores).",
  {
    agent_id: z.string().describe("The agent ID"),
    avatar_id: z.string().describe("The avatar ID to delete (use underscores for multiple, e.g. '7_8_9')"),
  },
  async ({ agent_id, avatar_id }) => {
    const data = await apiCall("DELETE", `/agents/${agent_id}/avatars/${avatar_id}`);
    return jsonResult(data);
  }
);

// ── Agent Core (flat identity/overview/personality/voice endpoint) ──────────

server.tool(
  "gen_get_agent_core",
  "Step 1 (Agent Setup): STAR READ TOOL. Returns all agent setup sections in one call: identity (name + profile photo), overview (brand name, description, identity type, goal, keywords, target platforms), personality, inspiration sources, voice, look (description + reference images), and accounts (the agent's own socials). Always call before gen_update_agent_core.",
  {
    agent_id: z.string().describe("The agent ID"),
  },
  async ({ agent_id }) => {
    const data = await apiCall("GET", `/agents/${agent_id}/core`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_update_agent_core",
  "Step 1 (Agent Setup): STAR WRITE TOOL. Update any combination of agent setup sections in one call: identity, overview, personality, inspiration, voice, look, accounts. Merge semantics for identity + overview + look.description; replace semantics for personality + inspiration + voice + accounts. Returns 200 on full success or 207 with per-section results on partial failure. This is the only supported path for agent setup writes.",
  {
    agent_id: z.string().describe("The agent ID"),
    identity: z.object({
      name: z.string().optional(),
      profile_photo_url: z.string().optional(),
    }).optional().describe("Identity merge-patch"),
    overview: z.object({
      brand_name: z.string().optional(),
      description: z.string().optional(),
      identity_type: z.enum(["brand", "character"]).optional(),
      goal: z.string().optional().describe("e.g. 'growth', 'authority', 'sales'"),
      keywords: z.array(z.string()).optional(),
      target_platforms: z.array(z.string()).optional(),
      shortform: z.boolean().optional(),
      longform: z.boolean().optional(),
      onboarding_status: z.string().optional(),
    }).optional().describe("Brand profile merge-patch"),
    personality: z.string().optional().describe("Full personality / backstory text — replaces existing"),
    inspiration: z.array(z.object({
      url: z.string(),
      platform: z.string().optional(),
    })).optional().describe("Inspiration source URLs — replaces full list"),
    look: z.object({
      description: z.string().optional(),
    }).optional().describe("Look description merge-patch (reference_images managed via item-level tools)"),
    voice: z.object({
      voice_id: z.string(),
      source: z.enum(["public", "user_designed", "user_trained", "user_elevenlabs"]).optional(),
    }).optional().describe("Voice reference — replaces default"),
    accounts: z.array(z.object({
      url: z.string(),
      platform: z.string().optional(),
      display_name: z.string().optional(),
    })).optional().describe("Agent's own socials — replaces full list"),
  },
  async ({ agent_id, ...patch }) => {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) body[key] = value;
    }
    const data = await apiCall("PATCH", `/agents/${agent_id}/core`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_add_agent_account",
  "Step 1 (Agent Setup): Add one social account to the agent (the agent's OWN account, not an inspiration source). Detects platform from URL if not provided.",
  {
    agent_id: z.string().describe("The agent ID"),
    url: z.string().describe("Full social URL"),
    platform: z.string().optional().describe("Override platform detection (e.g. 'tiktok', 'instagram')"),
    display_name: z.string().optional(),
  },
  async ({ agent_id, url, platform, display_name }) => {
    const body: Record<string, unknown> = { url };
    if (platform) body.platform = platform;
    if (display_name) body.display_name = display_name;
    const data = await apiCall("POST", `/agents/${agent_id}/core/accounts`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_add_agent_inspiration",
  "Step 1 (Agent Setup): Add one inspiration source URL to the agent. These are creators/accounts the agent draws style from — NOT the agent's own socials.",
  {
    agent_id: z.string().describe("The agent ID"),
    url: z.string().describe("Full URL of the inspiration source"),
    platform: z.string().optional().describe("e.g. 'tiktok', 'instagram', 'youtube'"),
  },
  async ({ agent_id, url, platform }) => {
    const body: Record<string, unknown> = { url };
    if (platform) body.platform = platform;
    const data = await apiCall("POST", `/agents/${agent_id}/core/inspiration`, body);
    return jsonResult(data);
  }
);

// ── Agent Profile (agent.gen.pro — legacy/alternate profile API) ────────────

server.tool(
  "gen_get_agent_profile",
  "Step 1 (Agent Setup): Get the agent profile from the agentic service (alternate to gen_get_agent_core). Returns grouped sections: identity (name, avatar, persona), voice (API keys, default voice), and brand (keywords, platforms, linked accounts, content_idea_preferences). Useful when agent.gen.pro is the canonical source (content idea preferences live here).",
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
  "Step 1 (Agent Setup): Initialize an agent's profile on the agentic service. Send any combination of identity, voice, and brand sections. Identity: name, description, persona. Voice: API keys and default_voice. Brand: brand_name, description, goal, keywords, target_platforms, shortform, longform, linked_accounts, content_idea_preferences.",
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
  "Step 1 (Agent Setup): Update an existing agent profile on the agentic service. Only send the sections and fields you want to change. Array fields (keywords, platforms, linked_accounts) are replaced entirely, not appended.",
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
  "Step 1 (Agent Setup): Reset the agent's brand configuration on the agentic service. Clears brand name, keywords, platforms, linked accounts, and content preferences. Does NOT delete the agent or voice settings.",
  {
    agent_id: z.string().describe("The agent ID"),
  },
  async ({ agent_id }) => {
    const data = await agentApiCall("DELETE", `/agent/profile?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

// ── Voice library + design + preview ────────────────────────────────────────

server.tool(
  "gen_connect_agent_elevenlabs",
  "Step 1 (Agent Setup): Connect the user's ElevenLabs API key to the agent. Validates the key before saving. Once connected, gen_list_agent_voices includes the user's ElevenLabs voices as source=user_elevenlabs.",
  {
    agent_id: z.string().describe("The agent ID"),
    api_key: z.string().describe("The user's ElevenLabs API key"),
  },
  async ({ agent_id, api_key }) => {
    const data = await apiCall("POST", `/agents/${agent_id}/voice/integrations/elevenlabs`, { api_key });
    return jsonResult(data);
  }
);

server.tool(
  "gen_list_agent_voices",
  "Step 1 (Agent Setup): List available voices for the agent. Sources: public (shared catalog), user_designed (via prompt flow), user_trained (from audio clone), user_elevenlabs (from connected key). Filter with `source` to narrow. Pick a voice and bind it via gen_update_agent_core voice section.",
  {
    agent_id: z.string().describe("The agent ID"),
    source: z.enum(["public", "user_designed", "user_trained", "user_elevenlabs"]).optional().describe("Filter by source"),
  },
  async ({ agent_id, source }) => {
    const suffix = source ? `?source=${source}` : "";
    const data = await apiCall("GET", `/agents/${agent_id}/voice/library${suffix}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_generate_voice_script",
  "Step 1 (Agent Setup) — Voice design 1/4: generate a read-aloud script (the text the candidate voice will speak in step 3). Only needed when designing a new voice programmatically; most users do this in the web UI.",
  {
    agent_id: z.string().describe("The agent ID"),
    language: z.string().optional().describe("Target language (e.g. 'en', 'es')"),
  },
  async ({ agent_id, language }) => {
    const body: Record<string, unknown> = {};
    if (language) body.language = language;
    const data = await apiCall("POST", `/agents/${agent_id}/voice/design/generate-script`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_generate_voice_description",
  "Step 1 (Agent Setup) — Voice design 2/4: generate style descriptors (tone, pace, energy). Requires gender.",
  {
    agent_id: z.string().describe("The agent ID"),
    gender: z.string().describe("REQUIRED — e.g. 'male', 'female', 'non-binary'"),
    voice_description: z.string().optional().describe("Optional user hint like 'warm and confident'"),
    language: z.string().optional(),
    script: z.string().optional().describe("The script from step 1 (helps tune the description)"),
  },
  async ({ agent_id, ...body }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
    const data = await apiCall("POST", `/agents/${agent_id}/voice/design/generate-description`, clean);
    return jsonResult(data);
  }
);

server.tool(
  "gen_generate_voice_samples",
  "Step 1 (Agent Setup) — Voice design 3/4: generate 3 candidate audio samples. Returns `{samples: [{generation_id, audio}, ...]}` — pick one and pass its `generation_id` to gen_design_voice to finalize.",
  {
    agent_id: z.string().describe("The agent ID"),
    text: z.string().describe("REQUIRED — the script to speak (from step 1)"),
    description: z.string().optional().describe("Style descriptor from step 2"),
  },
  async ({ agent_id, text, description }) => {
    const body: Record<string, unknown> = { text };
    if (description) body.description = description;
    const data = await apiCall("POST", `/agents/${agent_id}/voice/design/generate-samples`, body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_design_voice",
  "Step 1 (Agent Setup) — Voice design 4/4: finalize a designed voice by picking one of the candidates from step 3. Persists the new voice; shows up in gen_list_agent_voices under source=user_designed.",
  {
    agent_id: z.string().describe("The agent ID"),
    generation_id: z.string().describe("REQUIRED — opaque token from gen_generate_voice_samples"),
    name: z.string().describe("REQUIRED — display name for the new voice"),
    gender: z.string().optional(),
    language: z.string().optional(),
    description: z.string().optional(),
  },
  async ({ agent_id, ...body }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
    const data = await apiCall("POST", `/agents/${agent_id}/voice/design`, clean);
    return jsonResult(data);
  }
);

server.tool(
  "gen_clone_voice",
  "Step 1 (Agent Setup): Clone a voice from an existing audio sample. Pass EITHER audio_url (preferred; server downloads it) OR audio_base64 (inline bytes for small clips). Synchronous — returns the created voice immediately. Shows up under source=user_trained.",
  {
    agent_id: z.string().describe("The agent ID"),
    name: z.string().describe("REQUIRED — display name for the cloned voice"),
    audio_url: z.string().optional().describe("URL to an audio sample (mp3/wav). PREFERRED."),
    audio_base64: z.string().optional().describe("Base64-encoded audio bytes. Only for small clips."),
    gender: z.string().optional(),
    language: z.string().optional(),
    description: z.string().optional(),
  },
  async ({ agent_id, ...body }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
    const data = await apiCall("POST", `/agents/${agent_id}/voice/clone`, clean);
    return jsonResult(data);
  }
);

server.tool(
  "gen_preview_voice",
  "Step 1 (Agent Setup): Generate a TTS preview of a voice saying a given text. Use to audition a voice before binding it via gen_update_agent_core. Returns a user_job_id — poll with gen_get_voice_preview_status.",
  {
    agent_id: z.string().describe("The agent ID"),
    voice_id: z.string().describe("The voice ID to preview"),
    text: z.string().describe("The text to speak (keep under 500 chars for fast preview)"),
  },
  async ({ agent_id, voice_id, text }) => {
    const data = await apiCall("POST", `/agents/${agent_id}/voice/${voice_id}/preview`, { text });
    return jsonResult(data);
  }
);

server.tool(
  "gen_get_voice_preview_status",
  "Step 1 (Agent Setup): Poll the status of a TTS preview job from gen_preview_voice. Returns the full user_job — check `.status` (pending/processing/completed/failed) and read the audio from `.output_resources` when completed.",
  {
    agent_id: z.string().describe("The agent ID"),
    job_id: z.string().describe("The user_job_id returned by gen_preview_voice"),
  },
  async ({ agent_id, job_id }) => {
    const data = await apiCall("GET", `/agents/${agent_id}/voice/preview/${job_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_delete_voice",
  "Step 1 (Agent Setup): Delete a user-owned voice (designed or trained). Returns 404 if the voice doesn't belong to the agent.",
  {
    agent_id: z.string().describe("The agent ID"),
    voice_id: z.string().describe("The voice ID to delete"),
  },
  async ({ agent_id, voice_id }) => {
    const data = await apiCall("DELETE", `/agents/${agent_id}/voice/${voice_id}`);
    return jsonResult(data);
  }
);

// ── API Keys (PATs) ─────────────────────────────────────────────────────────

server.tool(
  "gen_list_api_keys",
  "Step 1 (Agent Setup): List all Personal Access Tokens (API keys) for the authenticated user.",
  {},
  async () => {
    const data = await apiCall("GET", "/persisted_tokens");
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_api_key",
  "Step 1 (Agent Setup): Create a new Personal Access Token. The plain-text token is returned ONCE — store it securely.",
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
  "Step 1 (Agent Setup): Revoke (delete) a Personal Access Token.",
  {
    token_id: z.string().describe("The token ID to revoke"),
  },
  async ({ token_id }) => {
    const data = await apiCall("DELETE", `/persisted_tokens/${token_id}/revoke`);
    return jsonResult(data);
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2: GENERATE CONTENT IDEAS
//
// Ask the agent for video ideas grounded in real trend data. Refine in
// conversation, set persistent preferences, optionally run topic research
// or schedule monitoring jobs that feed future idea runs.
//
// Most tools in this step call agent.gen.pro (not api.gen.pro).
// ═════════════════════════════════════════════════════════════════════════════

server.tool(
  "gen_generate_content_ideas",
  "Step 2 (Content Ideas): STARTING POINT. Generates data-driven video content ideas for an agent, analyzing trending videos with engagement-weighted hooks and transcripts. Returns a run_id — poll with gen_get_run_status until completed. Each idea has title, hook, full_script, video_type, estimated_duration, selected_assets[], project_manifest, inspiration_sources, rationale.",
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
  "Step 2 (Content Ideas): Give feedback on previously generated content ideas to get revised versions. Must pass the conversation_id from the original generation.",
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
  "Step 2 (Content Ideas): Set a persistent content generation rule for an agent. Applies to ALL future generations. Different from per-batch requirements which only apply once. Examples: 'always use statement hooks', 'target women 25-34', 'never mention competitors'.",
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
  "Step 2 (Content Ideas): Poll the status of an agent run. Returns 'running', 'completed', or 'failed'. When completed, messages array has the result. Poll every 5 seconds.",
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
  "Step 2 (Content Ideas): List all generated content ideas for an agent. Filter by status: generated, approve_to_create, ready_for_review, approved, published.",
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
  "Step 2 (Content Ideas): Update the status of a content idea. Flow: generated → approve_to_create → ready_for_review → approved → published. Approved ideas are the candidates for gen_create_vidsheet_from_idea in Step 3.",
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
  "Step 2 (Content Ideas): List agent chat conversations with titles and metadata.",
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
  "Step 2 (Content Ideas): Get a conversation with all messages. Use to review chat history and previously generated ideas before refining.",
  {
    conversation_id: z.string().describe("The conversation ID"),
  },
  async ({ conversation_id }) => {
    const data = await agentApiCall("GET", `/agent/conversations/${conversation_id}`);
    return jsonResult(data);
  }
);

server.tool(
  "gen_run_research",
  "Step 2 (Content Ideas): Research a topic across 10+ platforms (Reddit, X, YouTube, TikTok, Instagram, HN, Perplexity, Gemini). Returns structured findings with source counts, citations, and AI synthesis. Use for trend analysis, competitive research, or grounding content ideas in real data.",
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

server.tool(
  "gen_create_monitoring_job",
  "Step 2 (Content Ideas): Start monitoring or scraping social media content to feed future idea generation. Supports 3 platforms: tiktok, instagram, youtube. Search types: username (@creator), hashtag (#topic), keyword (plain text). Not all platform/type combos are valid — TikTok and YouTube support all three; Instagram supports username+hashtag only. Set monitoring=true for ongoing scheduled scraping, false for one-time (default). Scraped data is queried through the agent chat, not returned directly. This is a paid operation.",
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
  "Step 2 (Content Ideas): Update an existing content monitoring job. Only jobs with pending or processing status can be updated.",
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

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3: CONVERT IDEA TO VIDSHEET
//
// Materialize an idea (or a clean template) into a vidsheet — the
// spreadsheet-like Auto Content Engine where editing and generation happen.
// Prefer gen_clone_template or gen_create_vidsheet_from_idea over building
// from scratch.
// ═════════════════════════════════════════════════════════════════════════════

server.tool(
  "gen_list_templates",
  "Step 3 (Idea to Vidsheet): List available vidsheet templates. Templates are pre-configured engines — cloning one is the fastest way to start. ALWAYS check templates before creating an engine from scratch.",
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
  "Step 3 (Idea to Vidsheet): Get details of a specific template by slug, UUID, or ID. Inspect columns and structure before cloning.",
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
  "Step 3 (Idea to Vidsheet): Clone a template into an agent's workspace. FASTEST path to a production-ready vidsheet with pre-configured columns. Returns the new engine with its engine_id.",
  {
    slug: z.string().describe("Template slug to clone"),
    agent_id: z.string().describe("Agent ID to clone the template into"),
  },
  async ({ slug, agent_id }) => {
    const data = await apiCall("POST", `/templates/spreadsheets/${slug}/clone`, { agent_id });
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_vidsheet_from_idea",
  "Step 3 (Idea to Vidsheet): SINGLE-CALL BRIDGE from an approved content idea to a ready-to-edit vidsheet. Takes an idea_id (from Step 2) and creates an Auto Content Engine pre-populated with the right columns for the idea's video_type, plus a first row filled in from the idea's script and selected_assets. Use this instead of gen_clone_template + manual cell updates when you already have an approved idea. Returns the new engine with engine_id, columns, and seeded rows.",
  {
    agent_id: z.string().describe("The agent ID that owns the idea"),
    idea_id: z.string().describe("The approved idea_id from Step 2 (gen_list_content_ideas)"),
    title: z.string().optional().describe("Optional title for the new vidsheet (defaults to the idea's title)"),
  },
  async ({ agent_id, idea_id, title }) => {
    const body: Record<string, unknown> = { agent_id, idea_id };
    if (title) body.title = title;
    const data = await apiCall("POST", "/vidsheet/from_idea", body);
    return jsonResult(data);
  }
);

server.tool(
  "gen_create_engine",
  "Step 3 (Idea to Vidsheet): Create a new empty Auto Content Engine (vidsheet) for an agent. Prefer gen_clone_template (fastest) or gen_create_vidsheet_from_idea (idea bridge) unless neither fits — templates come pre-configured with the right columns for common workflows.",
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
  "Step 3 (Idea to Vidsheet): Get full details of a vidsheet — returns all columns, rows, and cells in one call. Cheap and fast. Use liberally at the start of Step 4.",
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
  "Step 3 (Idea to Vidsheet): Clone an existing engine, optionally to a different agent. Useful for duplicating proven pipelines across brands.",
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

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4: EDIT & GENERATE
//
// Shape the vidsheet (columns/rows), fill ingredient cells, trigger AI
// generations (text/image/video/speech/lipsync/captions), and compose video
// cells with layers. This is the highest-volume step.
// ═════════════════════════════════════════════════════════════════════════════

// ── Columns ─────────────────────────────────────────────────────────────────

server.tool(
  "gen_list_columns",
  "Step 4 (Edit & Generate): List all columns in a vidsheet, including role (ingredient/video/final_video/stats) and type.",
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
  "Step 4 (Edit & Generate): Create a new ingredient column in a vidsheet. Valid types: 'text' (scripts/prompts), 'image', 'video', 'audio'. Only 'ingredient' role columns can be created by users — system columns (video, final_video, stats) are created automatically with templates.",
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
  "Step 4 (Edit & Generate): Update a column's title, type, or position. Only ingredient-role columns can be modified.",
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
  "Step 4 (Edit & Generate): Delete a column from a vidsheet. Only ingredient-role columns can be deleted.",
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

// ── Rows ────────────────────────────────────────────────────────────────────

server.tool(
  "gen_list_rows",
  "Step 4 (Edit & Generate): List all rows in a vidsheet. A row is one piece of content; cells across its columns are its ingredients and generated outputs.",
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
  "Step 4 (Edit & Generate): Create a new row in a vidsheet. Each row is one piece of content.",
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
  "Step 4 (Edit & Generate): Duplicate an existing row, including its ingredient cell values. Useful for batch-generating variants from a known-good row.",
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

// ── Cells ───────────────────────────────────────────────────────────────────

server.tool(
  "gen_get_cell",
  "Step 4 (Edit & Generate): Get the value and metadata of a specific cell, including any layers, generations, and attached content resources.",
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
  "Step 4 (Edit & Generate): Update the value of a specific cell. Use on ingredient cells to set scripts, prompts, or reference values before triggering generation.",
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

// ── Layers ──────────────────────────────────────────────────────────────────

server.tool(
  "gen_create_layer",
  "Step 4 (Edit & Generate): Create a new layer inside a video cell. Layers compose overlays, tracks, and clips with a position. Use additional_attributes for type-specific config.",
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
  "gen_get_layer",
  "Step 4 (Edit & Generate): Get details of a specific layer in a cell, including its type, position, additional_attributes, and generation history.",
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
  "Step 4 (Edit & Generate): Update a layer's name, type, position, or additional_attributes.",
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

server.tool(
  "gen_delete_layer",
  "Step 4 (Edit & Generate): Delete a layer from a cell.",
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

// ── Variables ───────────────────────────────────────────────────────────────

server.tool(
  "gen_list_variables",
  "Step 4 (Edit & Generate): Get global variables for a vidsheet. Variables are key-value pairs used for template substitution in prompts and content (e.g. {{brand_name}}).",
  {
    engine_id: z.string().describe("The engine ID"),
    agent_id: z.string().describe("The agent ID that owns the engine"),
  },
  async ({ engine_id, agent_id }) => {
    const data = await apiCall("GET", `/autocontentengine/${engine_id}/global_variables?agent_id=${agent_id}`);
    return jsonResult(data);
  }
);

// ── Content Resources + Asset Library + Direct Upload ───────────────────────

server.tool(
  "gen_list_content_resources",
  "Step 4 (Edit & Generate): List content resources (files) belonging to an agent, with optional filters. Content resources are the media files (images, videos, audio) referenced by generations like video_from_image or lipsync.",
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
  "Step 4 (Edit & Generate): Create a content resource from a signed_id. Use gen_create_direct_upload first to upload the file, then pass the signed_id here.",
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
  "Step 4 (Edit & Generate): Get full details of a content resource, including its public URL and generator info if AI-generated.",
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
  "Step 4 (Edit & Generate): Rename a content resource file.",
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
  "Step 4 (Edit & Generate): Permanently delete a content resource and its associated file.",
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
  "Step 4 (Edit & Generate): List the agent's asset library (files and folders) with filtering and search.",
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
  "Step 4 (Edit & Generate): Get a pre-signed S3 URL for direct file upload. Two-step: (1) call this, (2) PUT the file to the returned URL, (3) pass the returned signed_id to gen_create_content_resource.",
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

// ── Generations (the workhorses) ────────────────────────────────────────────

server.tool(
  "gen_generate_content",
  `Step 4 (Edit & Generate): THE WORKHORSE. Trigger AI content generation for a cell. Returns a generation_id — poll with gen_get_generation until status is "completed".

Canonical generation types (legacy names also accepted):
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
  "Step 4 (Edit & Generate): Trigger generation for a specific layer within a cell. Use when the layer's generation type and data are already configured on the layer.",
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
  "Step 4 (Edit & Generate): Poll a generation job's status. Flow: pending → processing → completed | failed | stopped. On completion: text in `result`, media URLs in `output_resources`. Poll every 5–10s for video, every 2–5s for text/image.",
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
  "Step 4 (Edit & Generate): Stop a running generation job. Credits are refunded.",
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
  "Step 4 (Edit & Generate): Continue a previously stopped generation. Credits are re-charged.",
  {
    generation_id: z.string().describe("The generation ID to continue"),
  },
  async ({ generation_id }) => {
    const data = await apiCall("POST", `/generations/${generation_id}/continue`);
    return jsonResult(data);
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// STEP 5: EXPORT & PUBLISH
//
// Composite all layers into the final video (render), then publish to a
// connected social account or schedule a future post.
// ═════════════════════════════════════════════════════════════════════════════

server.tool(
  "gen_render_video",
  "Step 5 (Export & Publish): Render the final composed video for a cell in a final_video column. Combines all layers (video, audio, text overlays, captions) into one deliverable. Returns a generation_id — poll with gen_get_generation; the final MP4 URL arrives in output_resources when status is completed.",
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

server.tool(
  "gen_publish_content",
  "Step 5 (Export & Publish): Publish or schedule content to a social media platform. Currently supports TikTok. The agent must have a connected TikTok social account. For immediate posting use schedule_type='now'. For scheduled posting use schedule_type='scheduled' with a future scheduled_time. This is a paid operation.",
  {
    agent_id: z.string().describe("The agent ID"),
    platform: z.enum(["tiktok"]).describe("Target platform (currently only tiktok)"),
    media_url: z.string().describe("Public URL to the media file (must be accessible at post time)"),
    description: z.string().describe("Post caption/description. Max ~2200 chars for TikTok. Include hashtags inline."),
    schedule_type: z.enum(["now", "scheduled"]).describe("'now' for immediate posting, 'scheduled' for future posting"),
    title: z.string().optional().describe("Post title"),
    media_type: z.enum(["VIDEO", "IMAGE"]).optional().describe("Media type (default VIDEO)"),
    scheduled_time: z.string().optional().describe("ISO 8601 UTC datetime. Required when schedule_type is 'scheduled'."),
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

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
