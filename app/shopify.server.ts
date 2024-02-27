import "@shopify/shopify-app-remix/adapters/node";
import {
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
  LATEST_API_VERSION,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: LATEST_API_VERSION,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  restResources,
  // Guide on how to setup shopify webhooks with remix.
  // https://shopify.dev/docs/api/shopify-app-remix/v1/guide-webhooks#config
  // Shopify webhooks overview
  // https://shopify.dev/docs/apps/webhooks
  // Shopify CLI webhook trigger
  // https://shopify.dev/docs/apps/tools/cli/commands#webhook-trigger
  // This object tells shopify which webhooks to send to our app and where to send them.
  webhooks: {
    // Complete list of available webhook topics.
    // https://shopify.dev/docs/api/admin-rest/2024-01/resources/webhook
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    // Details on how to configure google cloud pub/sub webhooks.
    // https://shopify.dev/docs/apps/webhooks/configuration/google-cloud
    PRODUCTS_CREATE: {
      deliveryMethod: DeliveryMethod.PubSub,
      pubSubProject: "image-captioner-408123",
      pubSubTopic: "shopify-webhooks",
    },
    PRODUCTS_UPDATE: {
      deliveryMethod: DeliveryMethod.PubSub,
      pubSubProject: "image-captioner-408123",
      pubSubTopic: "shopify-webhooks",
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      shopify.registerWebhooks({ session });
    },
  },
  future: {
    v3_webhookAdminContext: true,
    v3_authenticatePublic: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = LATEST_API_VERSION;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
