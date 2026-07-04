const express = require('express');
const router = express.Router();
const chat = require('../controller/chat');

router.post('/conversations', chat.createConversation);
router.get('/conversations/:id', chat.getConversation);
router.post('/conversations/:id/messages', chat.postMessage);

module.exports = router;
