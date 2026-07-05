// Must be the very first require in any process entrypoint - dd-trace patches
// modules (express, mongoose, the MCP SDK, fetch, ...) as they're required,
// so anything required before this file loads won't get auto-instrumented.
// Configured entirely via DD_* env vars (DD_SERVICE, DD_AGENT_HOST,
// DD_TRACE_AGENT_PORT, ...) - no code changes needed to point it at a
// different agent or service name.
require('dd-trace').init();
