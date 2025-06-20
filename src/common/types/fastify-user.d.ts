import 'fastify';

// Adjust the type of 'user' as needed (any, or your User type)
declare module 'fastify' {
  interface FastifyRequest {
    user?: any;
  }
}
