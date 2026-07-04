const mongoose = require('mongoose');
const schema = mongoose.Schema;

const conversationSchema = new schema({
	id: {
		type: Number,
		required: true,
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
