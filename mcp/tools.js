const Product = require('../model/product');
const Cart = require('../model/cart');
const User = require('../model/user');

async function listProducts({ limit = 0, category } = {}) {
	const query = category ? Product.find({ category }) : Product.find();
	return query.select(['-_id']).limit(limit).sort({ id: 1 });
}

async function getProduct({ id }) {
	return Product.findOne({ id }).select(['-_id']);
}

async function listCarts({ limit = 0 } = {}) {
	return Cart.find().select(['-_id']).limit(limit);
}

async function getCart({ id }) {
	return Cart.findOne({ id }).select(['-_id']);
}

async function listUsers({ limit = 0 } = {}) {
	return User.find().select(['-_id', '-password']).limit(limit);
}

async function getUser({ id }) {
	return User.findOne({ id }).select(['-_id', '-password']);
}

module.exports = {
	listProducts,
	getProduct,
	listCarts,
	getCart,
	listUsers,
	getUser,
};
