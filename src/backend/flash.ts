import fp from 'fastify-plugin';
import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyInstance } from 'fastify';

export const FLASH_MSG_COOKIE = 'flash';

const pluginCallback: FastifyPluginCallback = (fastify: FastifyInstance, _options, next) => {
  fastify.addHook('onRequest', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.setCookie(FLASH_MSG_COOKIE, '', {
      path: '/',
    })
  })
  next();
}

export const clearFlashCookie = fp(pluginCallback);