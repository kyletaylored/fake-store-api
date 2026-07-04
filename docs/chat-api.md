# Chat API

A minimal conversation API backed by Claude (`@anthropic-ai/sdk`), with tool access to the store's product/cart/user data via `mcp/tools.js`. Intended for a future frontend to build a chat UI against.

Base path: `/chat`

## Data model

A conversation is a numeric `id` plus an ordered list of messages:

```json
{
  "id": 1,
  "messages": [
    { "role": "user", "content": "What products do you have under $20?", "createdAt": "2026-07-04T22:00:00.000Z" },
    { "role": "assistant", "content": "Here are a few products under $20: ...", "createdAt": "2026-07-04T22:00:02.000Z" }
  ]
}
```

`role` is always `"user"` or `"assistant"` — no tool-call detail is exposed in the stored history; tool use happens internally per request.

## Endpoints

### `POST /chat/conversations`

Create a new, empty conversation.

**Response `200`**
```json
{ "id": 1 }
```

### `GET /chat/conversations/:id`

Fetch a conversation's full message history.

**Response `200`**
```json
{
  "id": 1,
  "messages": [ { "role": "user", "content": "...", "createdAt": "..." } ]
}
```

**Response `404`** if no conversation with that `id` exists:
```json
{ "status": "error", "message": "conversation not found" }
```

### `POST /chat/conversations/:id/messages`

Send a user message and get the assistant's reply. The server runs Claude's tool-use loop internally (calling into the store's data via the same functions the MCP server exposes) until Claude produces a final text answer; only the final reply is returned and persisted.

**Request body**
```json
{ "message": "What's in cart 3?" }
```

**Response `200`**
```json
{ "reply": "Cart 3 contains 2 items: ..." }
```

**Error responses**
| Status | Body | Cause |
|---|---|---|
| `400` | `{ "status": "error", "message": "message is required" }` | missing/empty `message` field |
| `404` | `{ "status": "error", "message": "conversation not found" }` | unknown `:id` |
| `502` | `{ "status": "error", "message": "chat backend error" }` | Claude API call failed |

## What the assistant can answer

The assistant can only answer using data returned by these tools (also exposed as a standalone MCP server — see below):

| Tool | Description |
|---|---|
| `list_products` | List products, optionally filtered by `category`, with an optional `limit` |
| `get_product` | Get one product by numeric `id` |
| `list_carts` | List carts, with an optional `limit` |
| `get_cart` | Get one cart by numeric `id` |
| `list_users` | List users (passwords never included), with an optional `limit` |
| `get_user` | Get one user by numeric `id` (password never included) |

It is instructed to answer only from tool results, not to invent product/user/cart data.

## Model

Configured via `CLAUDE_MODEL` (default `claude-haiku-4-5`). Requires `ANTHROPIC_API_KEY` to be set.

## Standalone MCP server

The same six tools (defined once in `mcp/tools.js`, registered once in `mcp/create-server.js`) are also exposed as a standalone MCP server, in two transport flavors:

- **stdio** (`mcp/server.js`) - for local MCP clients (Claude Desktop, another agent) that spawn the server as a subprocess:
  ```
  node mcp/server.js
  ```
- **Streamable HTTP** (`mcp/http-server.js`) - for remote MCP clients that need a URL, e.g. Google Cloud Agent Studio. Listens on `MCP_PORT` (default `3333`) at `POST /mcp`:
  ```
  node mcp/http-server.js
  ```
  This endpoint is **intentionally unauthenticated** - Agent Studio's MCP connector only supports MCP servers with no auth of their own. See `docs/agent-studio-setup.md` for the multi-agent demo this is built for, and the security tradeoff of exposing it unauthenticated.

Both connect to the same `DATABASE_URL` as the main app.
