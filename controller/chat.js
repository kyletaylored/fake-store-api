const Anthropic = require('@anthropic-ai/sdk');
const Conversation = require('../model/conversation');
const storeTools = require('../mcp/tools');

const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5';

const TOOLS = [
	{
		name: 'list_products',
		description: 'List products in the store, optionally filtered by category',
		input_schema: {
			type: 'object',
			properties: {
				limit: { type: 'number', description: 'Max products to return (0 = no limit)' },
				category: { type: 'string', description: 'Filter to a single product category' },
			},
		},
	},
	{
		name: 'get_product',
		description: 'Get a single product by its numeric id',
		input_schema: {
			type: 'object',
			properties: { id: { type: 'number' } },
			required: ['id'],
		},
	},
	{
		name: 'list_carts',
		description: 'List shopping carts',
		input_schema: {
			type: 'object',
			properties: { limit: { type: 'number', description: 'Max carts to return (0 = no limit)' } },
		},
	},
	{
		name: 'get_cart',
		description: 'Get a single cart by its numeric id',
		input_schema: {
			type: 'object',
			properties: { id: { type: 'number' } },
			required: ['id'],
		},
	},
	{
		name: 'list_users',
		description: 'List users (passwords are never included)',
		input_schema: {
			type: 'object',
			properties: { limit: { type: 'number', description: 'Max users to return (0 = no limit)' } },
		},
	},
	{
		name: 'get_user',
		description: 'Get a single user by numeric id (password is never included)',
		input_schema: {
			type: 'object',
			properties: { id: { type: 'number' } },
			required: ['id'],
		},
	},
];

const TOOL_HANDLERS = {
	list_products: storeTools.listProducts,
	get_product: storeTools.getProduct,
	list_carts: storeTools.listCarts,
	get_cart: storeTools.getCart,
	list_users: storeTools.listUsers,
	get_user: storeTools.getUser,
};

const SYSTEM_PROMPT =
	'You are a helpful assistant for an e-commerce demo store (fake-store-api). ' +
	'Answer questions about products, carts, and users using the provided tools. ' +
	'Only use data returned by tools - never invent products, prices, or user data.';

async function runToolUseLoop(conversationMessages) {
	const messages = conversationMessages.map((m) => ({ role: m.role, content: m.content }));

	while (true) {
		const response = await client.messages.create({
			model: MODEL,
			max_tokens: 1024,
			system: SYSTEM_PROMPT,
			tools: TOOLS,
			messages,
		});

		if (response.stop_reason !== 'tool_use') {
			const textBlock = response.content.find((block) => block.type === 'text');
			return textBlock ? textBlock.text : '';
		}

		messages.push({ role: 'assistant', content: response.content });

		const toolResults = [];
		for (const block of response.content) {
			if (block.type !== 'tool_use') continue;
			const handler = TOOL_HANDLERS[block.name];
			try {
				const result = handler ? await handler(block.input || {}) : { error: 'unknown tool' };
				toolResults.push({
					type: 'tool_result',
					tool_use_id: block.id,
					content: JSON.stringify(result),
				});
			} catch (err) {
				toolResults.push({
					type: 'tool_result',
					tool_use_id: block.id,
					content: `Error: ${err.message}`,
					is_error: true,
				});
			}
		}
		messages.push({ role: 'user', content: toolResults });
	}
}

module.exports.createConversation = async (req, res) => {
	try {
		const count = await Conversation.countDocuments();
		const conversation = await Conversation.create({ id: count + 1, messages: [] });
		res.json({ id: conversation.id });
	} catch (err) {
		console.error(err);
		res.status(500).json({ status: 'error', message: 'could not create conversation' });
	}
};

module.exports.getConversation = async (req, res) => {
	const conversation = await Conversation.findOne({ id: req.params.id }).select(['-_id']);
	if (!conversation) {
		return res.status(404).json({ status: 'error', message: 'conversation not found' });
	}
	res.json(conversation);
};

module.exports.postMessage = async (req, res) => {
	const text = req.body && req.body.message;
	if (!text) {
		return res.status(400).json({ status: 'error', message: 'message is required' });
	}

	const conversation = await Conversation.findOne({ id: req.params.id });
	if (!conversation) {
		return res.status(404).json({ status: 'error', message: 'conversation not found' });
	}

	conversation.messages.push({ role: 'user', content: text });

	try {
		const reply = await runToolUseLoop(conversation.messages);
		conversation.messages.push({ role: 'assistant', content: reply });
		await conversation.save();
		res.json({ reply });
	} catch (err) {
		console.error(err);
		res.status(502).json({ status: 'error', message: 'chat backend error' });
	}
};
