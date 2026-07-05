require('./lib/tracing');

const mongoose = require('mongoose');
const app = require('./app');

const port = process.env.PORT || 6400;

mongoose.connection.once('open', () => {
	app.listen(port, () => {
		console.log('connect');
	});
});
