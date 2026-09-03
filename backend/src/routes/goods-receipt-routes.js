import {
  createGoodsReceipt,
  getOpenPoLines,
  getGoodsReceiptById,
  listGoodsReceipts,
  postGoodsReceipt,
} from '../services/goods-receipt-service.js';

export default async function goodsReceiptRoutes(fastify) {
  fastify.get('/api/goods-receipts', async (request, reply) => {
    const items = await listGoodsReceipts(fastify.db);
    return { items };
  });

  fastify.post('/api/goods-receipts', async (request, reply) => {
    try {
      const goodsReceipt = await createGoodsReceipt(fastify.db, request.body);
      reply.code(201);
      return goodsReceipt;
    } catch (error) {
      if (error.statusCode) {
        reply.code(error.statusCode);
        return { message: error.message };
      }

      throw error;
    }
  });

  fastify.post('/api/goods-receipts/:id/post', async (request, reply) => {
    try {
      const goodsReceipt = await postGoodsReceipt(fastify.db, request.params.id);
      if (!goodsReceipt) {
        reply.code(404);
        return { message: 'Goods receipt not found' };
      }

      return goodsReceipt;
    } catch (error) {
      if (error.statusCode) {
        reply.code(error.statusCode);
        return { message: error.message };
      }

      throw error;
    }
  });

  fastify.get('/api/goods-receipts/:id', async (request, reply) => {
    const goodsReceipt = await getGoodsReceiptById(fastify.db, request.params.id);
    if (!goodsReceipt) {
      reply.code(404);
      return { message: 'Goods receipt not found' };
    }

    return goodsReceipt;
  });

  fastify.get('/api/purchase-orders/:poId/open-lines-for-gr', async (request, reply) => {
    try {
      const data = await getOpenPoLines(fastify.db, request.params.poId);
      if (!data) {
        reply.code(404);
        return { message: 'Purchase order not found' };
      }

      return data;
    } catch (error) {
      if (error.statusCode) {
        reply.code(error.statusCode);
        return { message: error.message };
      }

      throw error;
    }
  });
}
