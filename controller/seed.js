const { runSeed } = require('../seed');

module.exports.postSeed = async (req, res) => {
	try {
		const counts = await runSeed();
		res.json({ status: 'ok', ...counts });
	} catch (err) {
		console.error(err);
		res.status(500).json({ status: 'error', message: 'could not seed database' });
	}
};
