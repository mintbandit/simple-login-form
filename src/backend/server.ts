import path from 'node:path';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import nunjucks from 'nunjucks';
import cookie from '@fastify/cookie';
import formBody from '@fastify/formbody';
import staticFiles from '@fastify/static';
import { z } from 'zod';
import { connect, newDb, SqliteSession, SqliteUserRepository } from "./db";
import { comparePassword, hashPassword } from "./auth";
import type { FastifyReply, FastifyRequest } from 'fastify';
import { clearFlashCookie, FLASH_MSG_COOKIE } from "./flash";
import { checkUsername } from "../shared/username-rules";
import { checkComplexity } from "../shared/password-rules";

dotenv.config({ quiet: true });

const SESSION_COOKIE = "SESSION_ID";

const environment = process.env.NODE_ENV;
const cookieSecret = process.env.COOKIE_SECRET;
if (cookieSecret === undefined) {
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
});

type AccountCreateRequest = z.infer<typeof accountCreateRequestSchema>;

const accountLoginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
});

type AccountLoginRequest = z.infer<typeof accountLoginRequestSchema>;

fastify.register(formBody);
fastify.register(cookie,{
  secret: cookieSecret,
});
fastify.register(clearFlashCookie);
fastify.register(staticFiles, {
  root: path.join(__dirname, '../../dist')
});

function setFlashCookie(reply: FastifyReply, msg: string): void {
  reply.setCookie(FLASH_MSG_COOKIE, msg, {
    path: '/',
  });
}

function readFlashCookie(request: FastifyRequest): string | undefined {
  return request.cookies[FLASH_MSG_COOKIE];
}

function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    path: '/',
  });
}

function readSessionCookie(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE];
}

async function errorRedirectToSignUp(reply: FastifyReply, flashMsg: string): Promise<void> {
  setFlashCookie(reply, flashMsg);
  await reply.redirect('/signup');
}

async function errorRedirectToSignIn(reply: FastifyReply, flashMsg: string): Promise<void> {
  setFlashCookie(reply, flashMsg);
  await reply.redirect('/signin');
}

fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) =>{
  await reply.redirect('/signin');
});

fastify.get('/signin', async (request: FastifyRequest, reply: FastifyReply) => {
  const serverMsg = readFlashCookie(request);
  const rendered = templates.render('signin.njk', { server_msg: serverMsg, environment });
  await reply
    .header('content-type', 'text/html; charset=utf-8')
    .send(rendered);
});

fastify.post('/account/signin', async (request: FastifyRequest, reply: FastifyReply) => {
  let requestData: AccountLoginRequest;
  try {
    requestData = accountCreateRequestSchema.parse(request.body);
  } catch {
    await errorRedirectToSignIn(reply, 'There was an error processing your request.');
    return;
  }

  const db = await connect(USER_DB);
  const userRepository = new SqliteUserRepository(db);
  try {
    const user = await userRepository.findByEmail(requestData.email);
    if (user === undefined) {
      await errorRedirectToSignIn(reply, 'Invalid login credentials');
      return;
    }
    const passwordMatches = await comparePassword(requestData.password, user.hashedPassword);
    if (!passwordMatches) {
      await errorRedirectToSignIn(reply, 'Invalid login credentials');
      return;
    }

    const sessions = new SqliteSession(db);
    const sessionId = await sessions.create(user.id);
    setSessionCookie(reply, sessionId);
    return await reply.redirect('/welcome');
  } catch {
    await errorRedirectToSignIn(reply, 'Invalid login credentials');
    return;
  }
});

fastify.get('/signup', async (request: FastifyRequest, reply: FastifyReply) => {
  const serverMsg = readFlashCookie(request);
  const rendered = templates.render('signup.njk', { server_msg: serverMsg, environment });
  await reply
    .header('content-type', 'text/html; charset=utf-8')
    .send(rendered);
});

fastify.post('/account/signup', async (request: FastifyRequest, reply: FastifyReply) => {
  let requestData: AccountCreateRequest;
  try {
    requestData = accountCreateRequestSchema.parse(request.body);
  } catch {
    await errorRedirectToSignUp(reply, 'There was an error processing your request.')
    return;
  }

  if (requestData.agreedToTerms !== 'on') {
    await errorRedirectToSignUp(reply, 'You must agree to the terms to sign up.');
    return;
  }

  const usernameFailures = checkUsername(requestData.email);
  if (usernameFailures.length > 0) {
    const formattedErrors = usernameFailures.join('<br>');
    await errorRedirectToSignUp(reply, formattedErrors);
    return;
  }

  const passwordFailures = checkComplexity(requestData.password);
  if (passwordFailures.length > 0) {
    const formattedErrors = passwordFailures.join('<br>');
    await errorRedirectToSignUp(reply, formattedErrors);
    return;
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
    const sessions = new SqliteSession(db);
    const sessionId = await sessions.create(user.id);
    setSessionCookie(reply, sessionId);
    await reply.redirect('/welcome');
  } catch {
    await errorRedirectToSignUp(reply, 'That account already exists.');
  }
});

fastify.get('/welcome', async (request: FastifyRequest, reply: FastifyReply) => {
  const sessionId= readSessionCookie(request);
  if (sessionId === undefined) {
    await errorRedirectToSignIn(reply, 'Please sign in to continue.');
    return;
  }

  const db = await connect(USER_DB);
  const sessions = new SqliteSession(db);
  const user = await sessions.get(sessionId);
  if (user === undefined) {
    await errorRedirectToSignIn(reply, 'Your session has expired. Please sign in to continue.');
    return;
  }

  const rendered = templates.render('welcome.njk', { environment, email: user.email });
  await reply
    .header('content-type', 'text/html; charset=utf-8')
    .send(rendered);
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