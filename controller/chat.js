const Conversation = require('../model/conversation');
const agentEngine = require('../lib/agent-engine');

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
	const conversation = await Conversation.findOne({ id: req.params.id }).select(['-_id', '-agentSessionId']);
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
		// Map our own conversation id to a stable Agent Engine user id, and lazily
		// create (once) + reuse an Agent Engine session id, so the deployed agent
		// has its own multi-turn memory of this conversation - not just the
		// transcript we separately persist below.
		const agentUserId = `conversation-${conversation.id}`;
		if (!conversation.agentSessionId) {
			conversation.agentSessionId = await agentEngine.createSession(agentUserId);
		}

		const reply = await agentEngine.sendMessage(agentUserId, conversation.agentSessionId, text);
		conversation.messages.push({ role: 'assistant', content: reply });
		await conversation.save();
		res.json({ reply });
	} catch (err) {
		console.error(err);
		res.status(502).json({ status: 'error', message: 'chat backend error' });
	}
};
