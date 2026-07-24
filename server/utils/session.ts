import type { H3Event } from 'h3';
import { auth } from './auth';

export async function requireUser(event: H3Event) {
  const session = await auth.api.getSession({
    headers: toWebRequest(event).headers,
  });
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: '请先登录',
    });
  }
  return session.user;
}
