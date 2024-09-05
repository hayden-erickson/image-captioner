import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import * as polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { useRouteError, useLoaderData } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { authenticate } from "../shopify.server";
import { Link } from "@remix-run/react";
import Settings from "./settings";
import {
  Page,
  BlockStack,
} from "@shopify/polaris";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function() {
  //const data = useLoaderData<{ apiKey: string }>();
  const data = { apiKey: "" }

  return (
    !data ? null :
      <AppProvider isEmbeddedApp apiKey={data.apiKey} >
        <ui-nav-menu>
          <Link to="/app" rel="home">
            Home
          </Link>
          { /* <Link to="/app/additional">Additional page</Link> */}
          {/* Add links to different sub pages here*/}
        </ui-nav-menu>

        {/* The Outlet will render any child routes of /app/* */}
        <Page>
          <BlockStack gap="500">
            <Settings />
          </BlockStack>
        </Page>
      </AppProvider>
  )
}
