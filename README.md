# Auto Content Engine MCP Server

MCP (Model Context Protocol) server for the GEN Auto Content Engine API. Lets Claude Code interact with GEN engines, rows, cells, columns, layers, and content generation directly.

## Install

```bash
npm install -g @poweredbygen/autocontentengine-mcp-server
```

Or run directly with npx:

```bash
npx @poweredbygen/autocontentengine-mcp-server
```

## Configure Claude Code

Add the MCP server:

```bash
claude mcp add autocontentengine -- npx @poweredbygen/autocontentengine-mcp-server
```

Set your API key (Personal Access Token from gen.pro):

```bash
export GEN_API_KEY=your-api-key
```

Optionally override the base URL:

```bash
export GEN_API_BASE_URL=https://stagingapi.gen.pro/v1
```

## Available Tools

### Discovery
- `gen_get_me` — Get authenticated user profile
- `gen_list_workspaces` — List workspaces
- `gen_list_agents` — List agents (optional workspace filter)

### Engines
- `gen_create_engine` — Create a new Auto Content Engine
- `gen_get_engine` — Get engine details
- `gen_clone_engine` — Clone an engine

### Rows
- `gen_list_rows` — List rows in an engine
- `gen_create_row` — Create a new row
- `gen_duplicate_row` — Duplicate a row

### Cells
- `gen_get_cell` — Get cell value and metadata
- `gen_update_cell` — Update a cell value

### Generation
- `gen_generate_content` — Trigger content generation for a cell
- `gen_generate_layer` — Generate a specific layer
- `gen_get_generation` — Check generation status
- `gen_stop_generation` — Stop a running generation

### Layers
- `gen_create_layer` — Add a layer to a cell
- `gen_delete_layer` — Remove a layer

### Columns
- `gen_list_columns` — List columns in an engine
- `gen_create_column` — Add a new column

## Development

```bash
git clone https://github.com/poweredbyGEN/autocontentengine-mcp-server.git
cd autocontentengine-mcp-server
npm install
npm run build
GEN_API_KEY=your-key npm start
```

## See also

- **TypeScript SDK:** [github.com/poweredbyGEN/autocontentengine-typescript-sdk](https://github.com/poweredbyGEN/autocontentengine-typescript-sdk) — Type-safe client for Node.js and TypeScript projects
- **API Docs:** [dev.gen.pro](https://dev.gen.pro) — Full API reference and guides

## License

MIT
