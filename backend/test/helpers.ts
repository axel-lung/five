import request from 'supertest';
import { app } from '../src/app';

export const api = () => request(app);

let counter = 0;

/** Cree un compte et renvoie son token d'acces + son id. */
export const createUser = async (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  const email = `user${counter}-${Date.now()}@example.com`;

  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Test1234!', firstName: `User${counter}`, ...overrides });

  if (res.status !== 201) {
    throw new Error(`createUser a echoue (${res.status}): ${JSON.stringify(res.body)}`);
  }

  return {
    id: res.body.user.id as string,
    email,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
};

export const createEvent = async (token: string, overrides: Record<string, unknown> = {}) => {
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Five du mardi',
      dateTime: '2027-01-05T19:00:00.000Z',
      capacity: 10,
      ...overrides,
    });

  if (res.status !== 201) {
    throw new Error(`createEvent a echoue (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
};

export const createGroup = async (token: string, overrides: Record<string, unknown> = {}) => {
  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Les Rémois', accessType: 'private', ...overrides });

  if (res.status !== 201) {
    throw new Error(`createGroup a echoue (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
};
