const mongoose = require('mongoose');
const schema = mongoose.Schema;

const conversationSchema = new schema({
	id: {
		type: Number,
		required: true,
	},
	// Session id on the deployed Vertex AI Agent Engine resource - lets that
	// agent remember earlier turns of this same conversation. Not exposed via
	// the /chat API (GET /chat/conversations/:id excludes it below).
	agentSessionId: {
		type: String,
	},
	messages: [
		{
			role: {
				type: String,
				enum: ['user', 'assistant'],
				required: true,
			},
			content: {
				type: String,
				required: true,
			},
			createdAt: {
				type: Date,
				default: Date.now,
			},
		},
	],
});

module.exports = mongoose.model('conversation', conversationSchema);
