import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import dbPlugin from './plugins/db.js';
import requisitionRoutes from './routes/requisition-routes.js';
import purchaseOrderRoutes from './routes/purchase-order-routes.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: true,
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Procurement MVP API',
        description: 'REST API for purchase requisitions and purchase orders.',
        version: '1.0.0',
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/api-docs',
  });

  app.register(dbPlugin);
  app.register(requisitionRoutes);
  app.register(purchaseOrderRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    if (reply.sent) {
      return;
    }

    reply.code(500).send({ message: 'Internal server error' });
  });

  return app;
}
