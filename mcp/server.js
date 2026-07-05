require('../lib/tracing');

const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
dotenvExpand.expand(dotenv.config({ quiet: true }));

const mongoose = require('mongoose');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const { createMcpServer } = require('./create-server');

async function main() {
	mongoose.set('strictQuery', true);
	await mongoose.connect(process.env.DATABASE_URL);

	const server = createMcpServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('fake-store-api MCP server running on stdio');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
