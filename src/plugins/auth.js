const fp = require('fastify-plugin');
const jwt = require('@fastify/jwt');

module.exports = fp(async (fastify, opts) => {
  fastify.register(jwt, {
    secret: opts.jwtSecret || 'supersecretkeychangedinproduction' // Use ENV var in real app
  });

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      // Support for query param auth for WebSockets if headers aren't easy (standard pattern)
      if (request.query && request.query.token) {
        request.headers.authorization = `Bearer ${request.query.token}`;
      }
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
});
