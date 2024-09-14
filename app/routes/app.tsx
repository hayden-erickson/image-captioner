import { useEffect, useState } from 'react'
import io from "socket.io-client";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import type { Socket } from "socket.io-client";
import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { SocketProvider } from "~/socket/context";
import { BillingProvider } from "~/billing/context";
import { authenticate } from "../shopify.server";
import { useRoutedFetcher } from '~/fetcher';
import { BillingInfo } from '~/shopify.types';

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shopId: session?.shop,
  });
};

export default function App() {
  const { apiKey, shopId } = useLoaderData<typeof loader>();
  const [socket, setSocket] = useState<Socket>();
  const { data } = useRoutedFetcher<BillingInfo>("/app/billing");

  useEffect(() => {
    const socket = io();
    setSocket(socket);
    return () => {
      socket.close();
    };
  }, []);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <SocketProvider socket={socket} shopId={shopId}>
        <BillingProvider billing={data}>
          <NavMenu>
            <Link to="/app" rel="home">
              Home
            </Link>
            { /*
          <Link to="/app/settings">
            Settings
          </Link>
          <Link to="/app/products">
            Product Descriptions
          </Link>
          */ }
          </NavMenu>

          <Outlet />

        </BillingProvider>
      </SocketProvider>
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
