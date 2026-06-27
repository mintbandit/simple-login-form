import path from 'path';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import nunjucks from 'nunjucks';
import cookie from '@fastify/cookie';
import formBody from '@fastify/formbody';
import staticFiles from '@fastify/static';
import { z } from 'zod';
import { connect, newDb, SqliteSession, SqliteUserRepository } from "./db";
import { comparePassword, hashPassword } from "./auth";

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

const accountCreateRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
  agreedToTerms: z.string().optional(),
})

type AccountCreateRequest = z.infer<typeof accountCreateRequestSchema>;

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
  await reply.redirect('/signin');
})

fastify.get('/signin', async (request, reply) => {
  const rendered = templates.render('signin.njk', { environment });
  return await reply
    .header('content-type', 'text/html; charset=utf-8')
    .send(rendered);
});

fastify.get('/signup', async (request, reply) => {
  const rendered = templates.render('signup.njk', { environment });
  return await reply
    .header('content-type', 'text/html; charset=utf-8')
    .send(rendered);
});

fastify.post('/account/signup', async (request, reply) => {
  let requestData: AccountCreateRequest;
  try{
    requestData = accountCreateRequestSchema.parse(request.body);
  } catch(e) {
    // TODO show error message
    return await reply.redirect('/signup');
  }

  if(requestData.agreedToTerms !== 'on'){
    // TODO show error message
    return await reply.redirect('/signup');
  }

  const db = await connect(USER_DB);
  const userRepository = new SqliteUserRepository(db);

  const hashedPassword = await hashPassword(requestData.password);

  try {
    const newUser = {
      ...requestData,
      id: 0,
      agreedToTerms: true,
      hashedPassword,
    }
    const user = await userRepository.create(newUser);
    return await reply.redirect('/welcome');
  } catch (e) {
    // TODO show error message
    return await reply.redirect('/signup');
  }
});

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