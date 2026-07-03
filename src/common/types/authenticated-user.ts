export type AuthenticatedUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: {
    id: string;
    name: string;
  };
  permissions: string[];
};
