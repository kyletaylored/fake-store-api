const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
dotenvExpand.expand(dotenv.config({ quiet: true }));

const mongoose = require('mongoose');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createMcpExpressApp } = require('@modelcontextprotocol/sdk/server/express.js');

const { createMcpServer } = require('./create-server');
const { runSeed } = require('../seed');

// Agent Studio only supports MCP servers with no auth of their own, so this
// endpoint is intentionally unauthenticated - see docs/chat-api.md for the
// tradeoffs of exposing this on an unauthenticated endpoint.
const PORT = process.env.MCP_PORT || 3333;
const allowedHosts = process.env.MCP_ALLOWED_HOSTS
	? process.env.MCP_ALLOWED_HOSTS.split(',').map((h) => h.trim())
	: undefined;

const app = createMcpExpressApp({ host: '0.0.0.0', allowedHosts });

app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Populates this service's own Mongo with demo data - see the Mongo caveat
// in docs/cloud-run-deploy.md (this is a separate database from the main
// app's, since each Cloud Run service has its own sidecar).
app.post('/seed', async (req, res) => {
	try {
		const counts = await runSeed();
		res.json({ status: 'ok', ...counts });
	} catch (err) {
		console.error(err);
		res.status(500).json({ status: 'error', message: 'could not seed database' });
	}
});

app.post('/mcp', async (req, res) => {
	const server = createMcpServer();
	try {
		const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
		await server.connect(transport);
		await transport.handleRequest(req, res, req.body);
		res.on('close', () => {
			transport.close();
			server.close();
		});
	} catch (err) {
		console.error('Error handling MCP request:', err);
		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: '2.0',
				error: { code: -32603, message: 'Internal server error' },
				id: null,
			});
		}
	}
});

app.get('/mcp', (req, res) => {
	res.writeHead(405).end(
		JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null })
	);
});

app.delete('/mcp', (req, res) => {
	res.writeHead(405).end(
		JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null })
	);
});

async function main() {
	mongoose.set('strictQuery', true);
	await mongoose.connect(process.env.DATABASE_URL);

	app.listen(PORT, () => {
		console.log(`fake-store-api MCP HTTP server listening on port ${PORT}`);
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
