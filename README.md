# FakeStoreAPI

[FakeStoreAPI](https://fakestoreapi.com) is a free online REST API that you can use whenever you need Pseudo-real data for
your e-commerce or shopping website without running any server-side code.
It's awesome for teaching purposes, sample codes, tests and etc.

You can visit in detail docs in [FakeStoreAPI](https://fakestoreapi.com) for more information.

## This fork: an AI customer support agent demo

This fork of the original API is being used as the backing store for a demo: an
AI-powered e-commerce customer support agent, built strictly on top of this
project's own product/cart/user data (no external knowledge, no invented data).
On top of the original API, this fork adds:

- **Dependency security upgrade** - mongoose, express, jsonwebtoken, bcryptjs,
  dotenv all bumped to latest majors (0 vulnerabilities, down from 14); real
  bcrypt password hashing instead of plaintext; Node 24 LTS.
- **Docker Compose + Google Cloud Run deployment** (two services from one
  image - the main app and the MCP server below), with a Datadog Agent
  sidecar for observability. See [`docs/cloud-run-deploy.md`](docs/cloud-run-deploy.md).
- **A minimal AI chat backend** (`POST /chat/conversations/:id/messages`)
  backed by Claude, with tool access to this store's product/cart/user data.
  See [`docs/chat-api.md`](docs/chat-api.md).
- **An MCP server** (`mcp/`) exposing the same product/cart/user tools over
  the Model Context Protocol - both a local stdio transport and a remote
  Streamable HTTP transport, so any MCP-compatible client or agent platform
  can query this store's data directly.
- **A multi-agent support demo in Google Cloud's Agent Studio**: a generic
  support agent that routes to specialist subagents (Products, Orders &
  Billing, Account), each scoped to this store's real data via the MCP
  server above. See [`docs/agent-studio-setup.md`](docs/agent-studio-setup.md)
  for the exact agent configs and a click-by-click console walkthrough.

## Why?

When I wanted to design a shopping website prototype and needed fake data, I had to
use lorem ipsum data or create a JSON file from the base. I didn't find any online free web service
to return semi-real shop data instead of lorem ipsum data.
so I decided to create this simple web service with NodeJs(express) and MongoDB as a database.

## Resources

There are 4 main resources need in shopping prototypes:

- Products https://fakestoreapi.com/products
- Carts https://fakestoreapi.com/carts
- Users https://fakestoreapi.com/users
- Login Token https://fakestoreapi.com/auth/login

### New! "Rating" (includes rate and count) has been added to each product object!

## How to

you can fetch data with any kind of methods you know(fetch API, Axios, jquery ajax,...)

### Get all products

```js
fetch("https://fakestoreapi.com/products")
  .then((res) => res.json())
  .then((json) => console.log(json));
```

### Get a single product

```js
fetch("https://fakestoreapi.com/products/1")
  .then((res) => res.json())
  .then((json) => console.log(json));
```

### Add new product

```js
fetch("https://fakestoreapi.com/products", {
  method: "POST",
  body: JSON.stringify({
    title: "test product",
    price: 13.5,
    description: "lorem ipsum set",
    image: "https://i.pravatar.cc",
    category: "electronic",
  }),
})
  .then((res) => res.json())
  .then((json) => console.log(json));

/* will return
{
 id:31,
 title:'...',
 price:'...',
 category:'...',
 description:'...',
 image:'...'
}
*/
```

Note: Posted data will not really insert into the database and just return a fake id.

### Updating a product

```js
fetch("https://fakestoreapi.com/products/7", {
  method: "PUT",
  body: JSON.stringify({
    title: "test product",
    price: 13.5,
    description: "lorem ipsum set",
    image: "https://i.pravatar.cc",
    category: "electronic",
  }),
})
  .then((res) => res.json())
  .then((json) => console.log(json));

/* will return
{
    id:7,
    title: 'test product',
    price: 13.5,
    description: 'lorem ipsum set',
    image: 'https://i.pravatar.cc',
    category: 'electronic'
}
*/
```

```js
fetch("https://fakestoreapi.com/products/8", {
  method: "PATCH",
  body: JSON.stringify({
    title: "test product",
    price: 13.5,
    description: "lorem ipsum set",
    image: "https://i.pravatar.cc",
    category: "electronic",
  }),
})
  .then((res) => res.json())
  .then((json) => console.log(json));

/* will return
{
    id:8,
    title: 'test product',
    price: 13.5,
    description: 'lorem ipsum set',
    image: 'https://i.pravatar.cc',
    category: 'electronic'
}
*/
```

Note: Edited data will not really be updated into the database.

### Deleting a product

```js
fetch("https://fakestoreapi.com/products/8", {
  method: "DELETE",
});
```

Nothing will delete on the database.

### Sort and Limit

You can use query string to limit results or sort by asc|desc

```js
// Will return all the posts that belong to the first user
fetch("https://fakestoreapi.com/products?limit=3&sort=desc")
  .then((res) => res.json())
  .then((json) => console.log(json));
```

## All available routes

### Products

```js
fields:
{
    id:Number,
    title:String,
    price:Number,
    category:String,
    description:String,
    image:String
}
```

GET:

- /products (get all products)
- /products/1 (get specific product based on id)
- /products?limit=5 (limit return results )
- /products?sort=desc (asc|desc get products in ascending or descending orders (default to asc))
- /products/products/categories (get all categories)
- /products/category/jewelery (get all products in specific category)
- /products/category/jewelery?sort=desc (asc|desc get products in ascending or descending orders (default to asc))

POST:

- /products

-PUT,PATCH

- /products/1

-DELETE

- /products/1

### Carts

```js
fields:
{
    id:Number,
    userId:Number,
    date:Date,
    products:[{productId:Number,quantity:Number}]
}
```

GET:

- /carts (get all carts)
- /carts/1 (get specific cart based on id)
- /carts?startdate=2020-10-03&enddate=2020-12-12 (get carts in date range)
- /carts/user/1 (get a user cart)
- /carts/user/1?startdate=2020-10-03&enddate=2020-12-12 (get user carts in date range)
- /carts?limit=5 (limit return results )
- /carts?sort=desc (asc|desc get carts in ascending or descending orders (default to asc))

POST:

- /carts

PUT,PATCH:

- /carts/1

DELETE:

- /carts/1

### Users

```js
fields:
{
    id:20,
    email:String,
    username:String,
    password:String,
    name:{
        firstname:String,
        lastname:String
        },
    address:{
    city:String,
    street:String,
    number:Number,
    zipcode:String,
    geolocation:{
        lat:String,
        long:String
        }
    },
    phone:String
}
```

GET:

- /users (get all users)
- /users/1 (get specific user based on id)
- /users?limit=5 (limit return results )
- /users?sort=desc (asc|desc get users in ascending or descending orders (default to asc))

POST:

- /users

PUT,PATCH:

- /users/1

DELETE:

- /users/1

### Auth

```js
fields:
{
    username:String,
    password:String
}
```

POST:

- /auth/login

## Chat and MCP

- Chat API (Claude-backed, tool-use over this store's data): [`docs/chat-api.md`](docs/chat-api.md)
- Multi-agent support demo in Agent Studio: [`docs/agent-studio-setup.md`](docs/agent-studio-setup.md)
- Standalone MCP server (stdio for local clients, Streamable HTTP for remote ones like Agent Studio): `mcp/server.js` / `mcp/http-server.js`, both documented in `docs/chat-api.md`
- Deploying both to Cloud Run (two services from one image, plus why not to use a Cloud Build repo trigger for this yet): [`docs/cloud-run-deploy.md`](docs/cloud-run-deploy.md), run via `cloud-run/deploy.sh`

## ToDo

- Move both Cloud Run services (`fake-store-api` and `fake-store-mcp`) off
  their own separate Mongo sidecars onto one shared, externally-reachable
  Mongo, so the Agent Studio demo and the chat endpoint see consistent data
  (see the Mongo caveat in [`docs/cloud-run-deploy.md`](docs/cloud-run-deploy.md))
- Set up a Cloud Build trigger with a custom `cloudbuild.yaml` for
  automatic redeploy-on-push, once the demo is stable enough to want that
  (see [`docs/cloud-run-deploy.md`](docs/cloud-run-deploy.md))
- Wire up `dd-trace` APM instrumentation now that the Datadog Agent sidecar
  is reachable (`DD_AGENT_HOST`/`DD_TRACE_AGENT_PORT` are already set)
- Add graphql support
- Add pagination
- Add another language support
