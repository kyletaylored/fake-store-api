const bcrypt = require('bcryptjs');
const User = require('../model/user');
const jwt = require('jsonwebtoken');

module.exports.login = (req, res) => {
	const username = req.body.username;
	const password = req.body.password;
	if (username && password) {
		User.findOne({
			username: username,
		})
			.then((user) => {
				if (user && bcrypt.compareSync(password, user.password)) {
					res.json({
						token: jwt.sign({ user: username }, process.env.JWT_SECRET, {
							expiresIn: '1h',
						}),
					});
				} else {
					res.status(401);
					res.send('username or password is incorrect');
				}
			})
			.catch((err) => {
				console.error(err);
			});
	}
};
