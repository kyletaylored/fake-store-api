const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');

const tools = require('./tools');

function textResult(data) {
	return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function createMcpServer() {
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
			description: 'List shopping carts, optionally filtered to a single user',
			inputSchema: {
				limit: z.number().optional().describe('Max number of carts to return (0 = no limit)'),
				userId: z.number().optional().describe('Filter to carts belonging to this user id'),
			},
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
			description:
				'Get a single user by numeric id, username, or email (password is never included). ' +
				'Provide exactly one of id/username/email - a chat user will typically only know their username or email.',
			inputSchema: {
				id: z.number().optional().describe('User id'),
				username: z.string().optional().describe('Username'),
				email: z.string().optional().describe('Email address'),
			},
		},
		async (args) => textResult(await tools.getUser(args))
	);

	return server;
}

module.exports = { createMcpServer };
