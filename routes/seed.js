const express = require('express');
const router = express.Router();
const seed = require('../controller/seed');

router.post('/', seed.postSeed);

module.exports = router;
