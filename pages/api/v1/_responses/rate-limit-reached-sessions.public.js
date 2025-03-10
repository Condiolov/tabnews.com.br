import { createRouter } from 'next-connect';
import { randomUUID as uuidV4 } from 'node:crypto';
import snakeize from 'snakeize';

import { ForbiddenError, TooManyRequestsError, UnauthorizedError } from 'errors';
import logger from 'infra/logger.js';
import controller from 'models/controller.js';
import ip from 'models/ip.js';
import validator from 'models/validator.js';

export default createRouter()
  .use(controller.injectRequestMetadata)
  .use(logRequest)
  .get(getValidationHandler, getHandler)
  .post(postValidationHandler, postHandler)
  .handler(controller.handlerOptions);

function getValidationHandler(request, response, next) {
  if (request.cookies?.session_id) {
    validator(request.cookies, {
      session_id: 'required',
    });
  }

  return next();
}

function logRequest(request, response, next) {
  const error = new TooManyRequestsError({
    context: {
      method: request.method,
      url: request.url,
      body: request.body,
      clientIp: ip.extractFromRequest(request),
      type: 'sessions',
    },
  });

  logger.error(snakeize(error));

  return next();
}

function getHandler(request, response) {
  const error = new ForbiddenError({
    message: 'Usuário não pode executar esta operação.',
    action: 'Verifique se este usuário possui a feature "read:session".',
    requestId: uuidV4(),
    errorId: uuidV4(),
    errorLocationCode: 'MODEL:AUTHORIZATION:CAN_REQUEST:FEATURE_NOT_FOUND',
  });

  response.status(error.statusCode).json(snakeize(error));
}

function postValidationHandler(request, response, next) {
  validator(request.body, {
    email: 'required',
    password: 'required',
  });

  return next();
}

async function postHandler(request, response) {
  const error = new UnauthorizedError({
    message: 'Dados não conferem.',
    action: 'Verifique se os dados enviados estão corretos.',
    requestId: uuidV4(),
    errorLocationCode: 'CONTROLLER:SESSIONS:POST_HANDLER:DATA_MISMATCH',
  });

  await fakeLatency();

  response.status(error.statusCode).json(snakeize(error));
}

async function fakeLatency() {
  const latency = random(100, 1000);
  await new Promise((r) => setTimeout(r, latency));

  function random(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }
}
