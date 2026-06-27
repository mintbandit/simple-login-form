import path from 'path';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import nunjucks from 'nunjucks';
import cookie from '@fastify/cookie';
import formBody from '@fastify/formbody';
import staticFiles from '@fastify/static';
import { z } from 'zod';
import { connect, newDb, SqliteSession, SqliteUserRepository} from "./db";

dotenv.config();

const environment = process.env.NODE_ENV;
const cookieSecret = process.env.COOKIE_SECRET;
if(cookieSecret === undefined){
  console.error('must set COOKIE_SECRET environment variable');
  process.exit(1);
}

const templates = new nunjucks.Environment(new nunjucks.FileSystemLoader('src/backend/templates'));
const USER_DB = './users.sqlite';

const fastify = Fastify({
  logger: true,
});

{
  fastify.register(formBody);
  fastify.register(cookie,{
    secret: cookieSecret,
  });
  fastify.register(staticFiles, {
    root: path.join(__dirname, '../../dist')
  });
}

fastify.get('/', async (request, reply) =>{
  await reply.send('hello');
})

const start = async (): Promise<void> => {
  try {
    const db = await connect(USER_DB);
    newDb(db);
    await fastify.listen({port: 8089})
  } catch(e) {
    fastify.log.error(e);
    process.exit(1);
  }
}

start();