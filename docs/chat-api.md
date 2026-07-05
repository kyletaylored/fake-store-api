# Chat API

A minimal conversation API backed by a Gemini-based multi-agent system deployed as a Vertex AI Agent Engine resource (built via Google's Agent Studio console - see `docs/agent-studio-setup.md`). That deployed agent gets its store data by calling the MCP server (`mcp/http-server.js`) directly - this Node process no longer runs any tool-use loop itself.

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

Send a user message and get the assistant's reply. The server forwards the message to the deployed Agent Engine resource (the "Support Coordinator" agent, which routes to the Products / Orders & Billing / Account subagents - see `docs/agent-studio-setup.md`) and returns its final text reply. The public request/response shape is unchanged from the previous Claude-based implementation.

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
| `502` | `{ "status": "error", "message": "chat backend error" }` | Agent Engine call failed (auth, network, or the agent itself returned an error - e.g. a misconfigured tool) |

## What the assistant can answer

The deployed agent answers using the same six store tools, but it calls them itself over MCP (`mcp/http-server.js`) - this Node process has no tool-calling code anymore:

| Tool | Description |
|---|---|
| `list_products` | List products, optionally filtered by `category`, with an optional `limit` |
| `get_product` | Get one product by numeric `id` |
| `list_carts` | List carts, with an optional `limit` |
| `get_cart` | Get one cart by numeric `id` |
| `list_users` | List users (passwords never included), with an optional `limit` |
| `get_user` | Get one user by numeric `id` (password never included) |

## Backend: Vertex AI Agent Engine

Configured via `AGENT_ENGINE_RESOURCE_NAME`, shaped like:
```
AGENT_ENGINE_RESOURCE_NAME=projects/<PROJECT_NUMBER>/locations/<REGION>/reasoningEngines/<REASONING_ENGINE_ID>
```
(get the real value from your own deployed Agent Studio agent - never commit one)

`lib/agent-engine.js` is a thin REST client (there is no Node client library for *querying* an already-deployed Agent Engine - `@google/adk` on npm is for authoring/deploying agents, not for calling one that's already live). It authenticates via Application Default Credentials (`google-auth-library`'s `GoogleAuth` - no API key, ever) and makes two kinds of calls against `https://{location}-aiplatform.googleapis.com/v1/{resource}`:

- **Session creation** (once per conversation, lazily on its first message, then reused): `POST {resource}/sessions` with body `{"userId": "conversation-<our conversation id>"}`. The returned session id is stored on the conversation document (`agentSessionId`, not exposed via the API) so the *deployed agent* remembers earlier turns of this conversation - separate from the transcript this app persists in Mongo.
- **Sending a message**: `POST {resource}:streamQuery?alt=sse` with body `{"class_method": "async_stream_query", "input": {"user_id": "...", "session_id": "...", "message": "..."}}`. Despite `alt=sse`, the response body is newline-delimited JSON, not real SSE - one JSON object per line. Each line may carry `content.parts[]` (text and/or tool-call/tool-result parts with no `text` field) or an error object. The final reply is every `parts[].text` field concatenated in order across all lines - function-call/response parts are skipped automatically since they have no `text` field.

Locally, ADC comes from `gcloud auth application-default login` (or `GOOGLE_APPLICATION_CREDENTIALS` pointed at a suitable credential file). On Cloud Run, ADC comes from the service's attached runtime service account, which needs `roles/aiplatform.user` (or equivalent) on the project/resource - see `docs/cloud-run-deploy.md`.

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
