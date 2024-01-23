import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// exported loader functions under app/routes/* are GET request handlers
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};
