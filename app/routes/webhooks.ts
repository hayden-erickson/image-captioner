import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// exported action functions under app/routes/* handler non-GET requests
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  if (!admin && topic !== 'SHOP_REDACT') {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    // The SHOP_REDACT webhook will be fired up to 48 hours after a shop uninstalls the app.
    // Because of this, no admin context is available.
    throw new Response();
  }

  // The topics handled here should be declared in the shopify.app.toml.
  // More info: https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration
  switch (topic) {
    case "SHOP_REDACT":
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }

      break;
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  //  APP_PURCHASES_ONE_TIME_UPDATE: Triggered when the status of an
  //    AppPurchaseOneTime object is changed.
  //
  //  APP_SUBSCRIPTIONS_UPDATE: Triggered when the status, or capped amount, of an
  //    AppSubscription object is changed, and when a subscription's status changes.
  //
  //  APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT: Triggered when the balance used on
  //    an app subscription crosses 90% of the capped amount.

  throw new Response();
};
