import { createAuthClient } from 'better-auth/vue';

export const auth = createAuthClient({
  basePath: '/api/auth',
});
