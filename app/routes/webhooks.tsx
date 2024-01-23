import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// exported action functions under app/routes/* handler non-GET requests
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session } = await authenticate.webhook(
    request
  );

  // if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    // throw new Response();
  // }

  console.log(topic)

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }

      break;
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
    case "PRODUCTS_UPDATE":
      // TODO if we update a product after a product update webhook will it
      // re-trigger a product update webhook and infinite loop?
      console.log(request)
      break
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
