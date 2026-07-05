const bcrypt = require('bcryptjs');
const Product = require('../model/product');
const User = require('../model/user');
const Cart = require('../model/cart');
const { products, users, carts } = require('./data');

async function runSeed() {
	await Promise.all([Product.deleteMany({}), User.deleteMany({}), Cart.deleteMany({})]);

	const hashedUsers = users.map((user) => ({ ...user, password: bcrypt.hashSync(user.password, 10) }));

	const [insertedProducts, insertedUsers, insertedCarts] = await Promise.all([
		Product.insertMany(products),
		User.insertMany(hashedUsers),
		Cart.insertMany(carts),
	]);

	return {
		products: insertedProducts.length,
		users: insertedUsers.length,
		carts: insertedCarts.length,
	};
}

module.exports = { runSeed };
