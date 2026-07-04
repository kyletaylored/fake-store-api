const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
dotenvExpand.expand(dotenv.config({ quiet: true }));

const mongoose = require('mongoose');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const tools = require('./tools');

function textResult(data) {
	return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

const server = new McpServer({ name: 'fake-store-api', version: '1.0.0' });

server.registerTool(
	'list_products',
	{
		description: 'List products in the store, optionally filtered by category',
		inputSchema: {
			limit: z.number().optional().describe('Max number of products to return (0 = no limit)'),
			category: z.string().optional().describe('Filter to a single product category'),
		},
	},
	async (args) => textResult(await tools.listProducts(args))
);

server.registerTool(
	'get_product',
	{
		description: 'Get a single product by its numeric id',
		inputSchema: { id: z.number().describe('Product id') },
	},
	async (args) => textResult(await tools.getProduct(args))
);

server.registerTool(
	'list_carts',
	{
		description: 'List shopping carts',
		inputSchema: { limit: z.number().optional().describe('Max number of carts to return (0 = no limit)') },
	},
	async (args) => textResult(await tools.listCarts(args))
);

server.registerTool(
	'get_cart',
	{
		description: 'Get a single cart by its numeric id',
		inputSchema: { id: z.number().describe('Cart id') },
	},
	async (args) => textResult(await tools.getCart(args))
);

server.registerTool(
	'list_users',
	{
		description: 'List users (passwords are never included)',
		inputSchema: { limit: z.number().optional().describe('Max number of users to return (0 = no limit)') },
	},
	async (args) => textResult(await tools.listUsers(args))
);

server.registerTool(
	'get_user',
	{
		description: 'Get a single user by numeric id (password is never included)',
		inputSchema: { id: z.number().describe('User id') },
	},
	async (args) => textResult(await tools.getUser(args))
);

async function main() {
	mongoose.set('strictQuery', true);
	await mongoose.connect(process.env.DATABASE_URL);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('fake-store-api MCP server running on stdio');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
