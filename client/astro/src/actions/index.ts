import { actions as guestbookActions } from "./guestbook";
import { actions as authActions } from "./auth";

export const server = {
  ...guestbookActions,
  ...authActions,
};
