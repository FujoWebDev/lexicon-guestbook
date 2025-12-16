import { defineMiddleware } from "astro:middleware";
import { getActionContext } from "astro:actions";

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) {
    return next();
  }

  const { action, setActionResult, serializeActionResult } =
    getActionContext(context);

  const latestAction = await context.session?.get(`latest-astro-action`);
  if (latestAction) {
    setActionResult(latestAction.name, latestAction.result);
    context.session?.delete(`latest-astro-action`);

    return next();
  }

  if (action?.calledFrom === "form") {
    const result = await action.handler();
    context.session?.set(`latest-astro-action`, {
      name: action.name,
      result: serializeActionResult(result),
    });

    if (result.error) {
      const referer = context.request.headers.get("Referer");
      return context.redirect(referer ?? "/");
    }

    return context.redirect(context.originPathname);
  }
  return next();
});
