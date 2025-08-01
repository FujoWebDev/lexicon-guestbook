import { getActionContext } from "astro:actions";
import { actions } from "astro:actions";

const LOGIN_ACTION_NAME = "login" satisfies keyof typeof actions;

export async function onRequest(context, next) {
  const { action } = getActionContext(context);

  if (action?.name == LOGIN_ACTION_NAME) {
    const { data, error } = await action.handler();
    return context.redirect(data.redirectUrl);
  }
  return next();
}
