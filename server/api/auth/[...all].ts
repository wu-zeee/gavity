import { auth } from '#server/utils/auth';

export default defineEventHandler(ev => auth.handler(toWebRequest(ev)));
