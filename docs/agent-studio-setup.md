# Agent Studio multi-agent demo

A generic support agent that routes to specialized subagents (Products, Orders & Billing, Account), all scoped to this store's actual data via the MCP server in `mcp/http-server.js`. No shipping subagent - we don't have shipping data, so it's intentionally left out rather than mocked.

## Prerequisites

1. **Deploy `mcp/http-server.js` somewhere Google can reach it over HTTPS.** Agent Studio's MCP connector only supports servers with **no authentication**, so this needs to be a public (or at least Google-reachable) unauthenticated endpoint. Run `PROJECT_ID=your-project ./cloud-run/deploy.sh` to build and deploy it (along with the main app) to Cloud Run - see [`docs/cloud-run-deploy.md`](cloud-run-deploy.md) for prerequisites and what that script actually does. It prints the MCP URL you need for step 3 below.
2. **Data caveat**: the deployed MCP service gets its own empty Mongo (no seed script exists), separate from the main app's - see `docs/cloud-run-deploy.md`'s Mongo section for what that means and how to change it.
3. For a quick local demo without Cloud Run, run `docker compose up mcp db` and tunnel port 3333 (e.g. `ngrok http 3333`) to get a temporary public URL for Agent Studio to hit.

Verify the endpoint responds before wiring it into Agent Studio:

```
curl -s -X POST http://<host>/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Should return all six tools: `list_products`, `get_product`, `list_carts`, `get_cart`, `list_users`, `get_user`.

## Important caveat: tool scoping is prompt-level, not a hard boundary

Agent Studio attaches an MCP server as a whole - "your agent can use all tools in your connected MCP server." There's no connector-level way to give the Products subagent only `list_products`/`get_product` while hiding cart/user tools from it. The scoping below (each subagent only _using_ its relevant tools) is enforced by instructions, not by permissions. Fine for a demo; not a substitute for real access control if this pattern is ever used with non-fake data.

## Agent 1: Support Coordinator (root agent)

**Name:** `Support Coordinator`

**Description** (used for routing): `Front-line e-commerce support agent that understands what the customer needs and hands off to the right specialist.`

**Model:** `gemini-2.5-flash-lite`

**MCP server:** not connected directly - it only routes, it doesn't call store tools itself.

**Instructions:**

```
You are the front door for customer support at a demo e-commerce store. You do not answer product, order, or account questions yourself - your only job is to understand what the customer needs and route them to the right specialist subagent:

- Products: questions about what's for sale, prices, descriptions, categories.
- Orders & Billing: questions about a specific cart/order - contents, totals.
- Account: questions about a specific user's account details.

If the request is ambiguous, ask one short clarifying question before routing. If the request doesn't fit any of the three specialists (e.g. shipping, returns, general chit-chat unrelated to this store), say plainly that you don't have information on that - do not guess or make up an answer.

This is a demo store with fake/sample data. Never invent data that a subagent didn't actually return.
```

## Agent 2: Products

**Name:** `Products`

**Description:** `Answers questions about products for sale - catalog, prices, descriptions, categories.`

**Model:** `gemini-2.5-flash-lite`

**MCP server:** the deployed `mcp/http-server.js` endpoint.

**Instructions:**

```
You answer questions about the store's product catalog only. Use the list_products and get_product tools to look up real data - never state a price, description, or category you didn't get from a tool call. If asked about anything outside the product catalog (orders, accounts, shipping), say that's outside what you handle and let the coordinator route it elsewhere instead of guessing.
```

## Agent 3: Orders & Billing

**Name:** `Orders & Billing`

**Description:** `Answers questions about a specific cart/order - contents and totals.`

**Model:** `gemini-2.5-flash-lite`

**MCP server:** the deployed `mcp/http-server.js` endpoint.

**Instructions:**

```
You answer questions about shopping carts (orders) only, using the list_carts and get_cart tools. Only report what a tool call actually returned - never invent cart contents, quantities, or totals. If the customer doesn't give a cart/order id, ask for one. If asked about products in general (not tied to a specific cart) or account details, say that's outside what you handle.
```

## Agent 4: Account

**Name:** `Account`

**Description:** `Answers questions about a specific user's account details.`

**Model:** `gemini-2.5-flash-lite`

**MCP server:** the deployed `mcp/http-server.js` endpoint.

**Instructions:**

```
You answer questions about user accounts only, using the list_users and get_user tools. These tools never return a password field - if asked for one, say account credentials aren't something you can share, don't speculate. Only report what a tool call actually returned. If the customer doesn't give a user id, ask for one. If asked about products or carts, say that's outside what you handle.
```

## Step-by-step console walkthrough

Agent Studio is a fairly new console surface, so exact labels may drift slightly from what's below - if something's not exactly where described, look for the nearest equivalent (e.g. "Add" vs "Add (+)" vs a plain "+" icon all show up in different panels).

### 0. Get to Agent Studio

1. Make sure the MCP endpoint from the Prerequisites section is already up and reachable (test with the `curl` command above) - you'll need its URL in step 3.
2. Go to `https://console.cloud.google.com/agent-platform/studio/agent-designer` (the link you already had) and confirm the project selector at the top is pointed at the right GCP project.
3. If this is the first agent in the project, the console may prompt you to enable the Agent Platform / Gemini Enterprise API - accept that, it's a one-time per-project step.

### 1. Create the root agent: Support Coordinator

1. Click **Create agent** (or **New agent** - the primary call-to-action on the Agent Studio landing/list page).
2. Give it the name `Support Coordinator` and the description from the "Agent 1" section above - the description is what the platform uses for automatic routing decisions later, so paste it verbatim rather than paraphrasing.
3. In the model picker, select `gemini-2.5-flash-lite`.
4. Find the system instructions field (usually labeled **Instructions** or **System instructions** in the agent's **Details** panel) and paste the coordinator instructions block from the "Agent 1" section above.
5. Leave tools/MCP unconnected on this agent - it only routes, it doesn't call store data itself.
6. Save/create the agent. You should land on its canvas/Flow view.

### 2. Add the three specialist subagents

From the Support Coordinator's canvas:

1. Look for **Add a subagent** (a `+` button, typically on the canvas itself or in a side panel listing the agent's subagents). Click it.
2. For the first one, fill in the **Products** agent exactly as specified in the "Agent 2" section above: name, description, model (`gemini-2.5-flash-lite`), instructions.
3. Repeat **Add a subagent** two more times for **Orders & Billing** (Agent 3) and **Account** (Agent 4), each with their own name/description/model/instructions from above.
4. After adding all three, open the **Flow** tab on the Support Coordinator - you should see the coordinator node with three subagent nodes branching off it. This is the visual you want for the demo.

### 3. Connect the MCP server to each specialist

Do this **on each of the three specialist subagents individually** - not on the coordinator, and there's no way to attach it once and share it across subagents.

1. Open the **Products** subagent's own configuration (click into its node, or select it from a subagent list).
2. Find **Add** (or **Add tool** / a `+` icon) near wherever tools are listed for that agent, and choose **MCP server** from the options.
3. Fill in:
   - **MCP display name**: `fake-store-api` (or any label you'll recognize)
   - **Endpoint URL**: the public URL from the Prerequisites step, with the `/mcp` path (e.g. `https://your-mcp-host.example.com/mcp`)
   - **Authentication**: leave as `None` (this is Agent Studio's only supported option for MCP servers today)
4. Save. The panel should list all six discovered tools (`list_products`, `get_product`, `list_carts`, `get_cart`, `list_users`, `get_user`) - if it lists zero, double check the endpoint URL includes `/mcp` and that you tested it with `curl` first.
5. Repeat steps 1-4 for **Orders & Billing** and **Account**. Yes, this means configuring the same MCP connection three times, once per subagent - see the tool-scoping caveat above for why (each subagent gets the whole tool set; only its own instructions constrain what it actually uses).

### 4. Test it

1. Use whatever "Preview" / "Test agent" chat panel Agent Studio provides, starting a conversation against the **Support Coordinator** (not a subagent directly) so you're exercising the full routing path.
2. Try one prompt per specialist and confirm both the routing _and_ the tool call happened:
   - `"What products do you have under $20?"` → should route to Products, and the answer should reflect real catalog data (or say there's no data, if the store is empty - see the note on seed data below).
   - `"What's in cart 3?"` → should route to Orders & Billing and call `get_cart`.
   - `"What's user 2's email?"` → should route to Account and call `get_user`.
   - `"What's your return policy?"` → nothing in scope should answer this; confirm the coordinator says it doesn't have that information rather than guessing.
3. If a subagent answers confidently without calling a tool, check its instructions pasted correctly - that's the "never invent data" line doing its job when it's working.

**Note on data**: this store has no seed script, so a freshly-provisioned Mongo will return empty results for everything. Insert a few test products/carts/users directly (e.g. via `mongosh` or a quick script against the same `DATABASE_URL`) before demoing, or the correct-but-underwhelming answer will always be "there's no data for that."
