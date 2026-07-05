// Thin client for a deployed Vertex AI Agent Engine (Agent Studio / ADK) resource.
//
// There is no official Node.js client for *querying* an already-deployed Agent
// Engine - `@google/adk` (npm) is for authoring/deploying agents, not for
// talking to one that's already live. So this just does the documented REST
// calls directly, authenticated via Application Default Credentials.
//
// Verified against a live deployment (see docs/chat-api.md):
//   - POST {resource}/sessions                     {"userId": "..."}   -> creates a session
//   - POST {resource}:streamQuery?alt=sse           class_method "async_stream_query"
//     body: {"class_method": "async_stream_query", "input": {"user_id", "session_id", "message"}}
//     response body is newline-delimited JSON (NOT real SSE, despite alt=sse) - one
//     JSON object per line, each with an optional content.parts[] array. Concatenating
//     every part's `text` field (in order, across all lines) gives the final reply -
//     function_call/function_response parts (used for routing between subagents) have
//     no `text` field, so they're naturally skipped.
const { GoogleAuth } = require('google-auth-library');

const RESOURCE_NAME = process.env.AGENT_ENGINE_RESOURCE_NAME;
const LOCATION_MATCH = RESOURCE_NAME && RESOURCE_NAME.match(/\/locations\/([^/]+)\//);
const LOCATION = process.env.AGENT_ENGINE_LOCATION || (LOCATION_MATCH && LOCATION_MATCH[1]);

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

function baseUrl() {
	if (!RESOURCE_NAME || !LOCATION) {
		throw new Error('AGENT_ENGINE_RESOURCE_NAME is not configured');
	}
	return `https://${LOCATION}-aiplatform.googleapis.com/v1/${RESOURCE_NAME}`;
}

async function authHeaders() {
	const token = await auth.getAccessToken();
	return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// Creates a new Agent Engine session for the given user id and returns its session id
// (just the trailing numeric id, not the full resource name).
async function createSession(userId) {
	const res = await fetch(`${baseUrl()}/sessions`, {
		method: 'POST',
		headers: await authHeaders(),
		body: JSON.stringify({ userId }),
	});
	const body = await res.text();
	if (!res.ok) {
		throw new Error(`agent engine createSession failed (${res.status}): ${body}`);
	}
	const data = JSON.parse(body);
	const name = data.response && data.response.name;
	if (!name) {
		throw new Error(`agent engine createSession: no session name in response: ${body}`);
	}
	return name.split('/').pop();
}

// Sends a message within an existing session and returns the concatenated reply text.
async function sendMessage(userId, sessionId, message) {
	const res = await fetch(`${baseUrl()}:streamQuery?alt=sse`, {
		method: 'POST',
		headers: await authHeaders(),
		body: JSON.stringify({
			class_method: 'async_stream_query',
			input: { user_id: userId, session_id: sessionId, message },
		}),
	});
	const body = await res.text();
	if (!res.ok) {
		throw new Error(`agent engine streamQuery failed (${res.status}): ${body}`);
	}

	let reply = '';
	const chunkErrors = [];
	for (const line of body.split('\n')) {
		if (!line.trim()) continue;
		let chunk;
		try {
			chunk = JSON.parse(line);
		} catch (err) {
			continue;
		}
		// The stream can carry mid-stream error objects (e.g. the agent tries to
		// call a tool it doesn't actually have wired up) alongside/instead of a
		// normal content chunk - collect those instead of silently producing an
		// empty reply.
		if (chunk.error_message || chunk.error_code || (chunk.code && chunk.message)) {
			chunkErrors.push(chunk.error_message || chunk.message);
			continue;
		}
		const parts = chunk.content && chunk.content.parts;
		if (!parts) continue;
		for (const part of parts) {
			if (typeof part.text === 'string') reply += part.text;
		}
	}
	if (!reply.trim() && chunkErrors.length) {
		throw new Error(`agent engine streamQuery returned an error: ${chunkErrors[0]}`);
	}
	return reply;
}

module.exports = { createSession, sendMessage };
