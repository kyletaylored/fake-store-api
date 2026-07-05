const products = [
	{
		id: 1,
		title: 'Wireless Noise-Cancelling Headphones',
		price: 129.99,
		description: 'Over-ear Bluetooth headphones with active noise cancellation and 30-hour battery life.',
		image: 'https://i.pravatar.cc/300?img=1',
		category: 'electronics',
	},
	{
		id: 2,
		title: 'Stainless Steel Water Bottle',
		price: 24.5,
		description: 'Insulated 32oz bottle that keeps drinks cold for 24 hours or hot for 12.',
		image: 'https://i.pravatar.cc/300?img=2',
		category: 'home',
	},
	{
		id: 3,
		title: "Men's Classic Fit Denim Jacket",
		price: 59.0,
		description: 'Medium-wash denim jacket with a classic fit and button-front closure.',
		image: 'https://i.pravatar.cc/300?img=3',
		category: "men's clothing",
	},
	{
		id: 4,
		title: 'Ceramic Pour-Over Coffee Dripper',
		price: 34.99,
		description: 'Hand-crafted ceramic dripper for a clean, full-flavored cup of coffee.',
		image: 'https://i.pravatar.cc/300?img=4',
		category: 'home',
	},
	{
		id: 5,
		title: "Women's Running Shoes",
		price: 89.99,
		description: 'Lightweight running shoes with breathable mesh upper and cushioned sole.',
		image: 'https://i.pravatar.cc/300?img=5',
		category: "women's clothing",
	},
];

// Plain-text passwords, listed here only for demo convenience - hashed with
// bcrypt before being written to Mongo by seed/index.js.
const users = [
	{
		id: 1,
		email: 'jane.doe@example.com',
		username: 'janedoe',
		password: 'password123',
		name: { firstname: 'Jane', lastname: 'Doe' },
		address: {
			city: 'Seattle',
			street: 'Pike Street',
			number: 123,
			zipcode: '98101',
			geolocation: { lat: '47.6097', long: '-122.3331' },
		},
		phone: '206-555-0100',
	},
	{
		id: 2,
		email: 'john.smith@example.com',
		username: 'johnsmith',
		password: 'password123',
		name: { firstname: 'John', lastname: 'Smith' },
		address: {
			city: 'Austin',
			street: 'Congress Ave',
			number: 456,
			zipcode: '78701',
			geolocation: { lat: '30.2672', long: '-97.7431' },
		},
		phone: '512-555-0100',
	},
	{
		id: 3,
		email: 'alex.morgan@example.com',
		username: 'alexmorgan',
		password: 'password123',
		name: { firstname: 'Alex', lastname: 'Morgan' },
		address: {
			city: 'Denver',
			street: 'Larimer Street',
			number: 789,
			zipcode: '80202',
			geolocation: { lat: '39.7392', long: '-104.9903' },
		},
		phone: '303-555-0100',
	},
];

const carts = [
	{
		id: 1,
		userId: 1,
		date: new Date('2026-06-01'),
		products: [
			{ productId: 1, quantity: 1 },
			{ productId: 4, quantity: 2 },
		],
	},
	{
		id: 2,
		userId: 2,
		date: new Date('2026-06-15'),
		products: [{ productId: 3, quantity: 1 }],
	},
	{
		id: 3,
		userId: 3,
		date: new Date('2026-07-01'),
		products: [
			{ productId: 5, quantity: 1 },
			{ productId: 2, quantity: 3 },
		],
	},
];

module.exports = { products, users, carts };
