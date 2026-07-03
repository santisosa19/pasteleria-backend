import { AuthenticatedUser } from './authenticated-user';

export type RequestWithUser = {
  user?: AuthenticatedUser;
};
