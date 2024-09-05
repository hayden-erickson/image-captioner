import "@shopify/shopify-app-remix/adapters/node";
import {
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
  LATEST_API_VERSION,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
//import { restResources } from "@shopify/shopify-app-remix/server"

import prisma from "./db.server";
import {
  Product,
  ProductConnection,
} from './shopify.types'

type GetProductsArgs = {
  query?: string | undefined | null;
  first?: number;
  after?: string | undefined | null;
  last?: number;
  before?: string | undefined | null;
}

type ForEachProductPageArgs = {
  getShopifyProducts: GetProductsFn;
  callback: ProductPageFn;
}

type FilterAllProductsArgs = {
  getShopifyProducts: GetProductsFn;
  filter: ProductFilterFn;
}

export type GetProductsFn = ({ first, after, last, before }: GetProductsArgs) => Promise<ProductConnection>;
export type ProductPageFn = (page: Product[]) => Promise<void>;
export type ProductPageIteratorFn = (args: ForEachProductPageArgs) => Promise<void>;
export type ProductFilterFn = (page: Product[]) => Promise<Product[]>

export async function getProduct(admin: any, id: string): Promise<Product> {
  const response = await admin.graphql(`#graphql
    query GetProduct($id:ID!) {
      product(id: $id) {
        id
        title
        description
        featuredImage {
          url
        }
      }
    }`,
    { variables: { id } }
  )

  let {
    data: {
      product
    },
  } = await response.json();

  return product
}


export function getProductsClient(admin: any): GetProductsFn {
  return async function({ query, first, after, last, before }: GetProductsArgs): Promise<ProductConnection> {
    const response = await admin.graphql(
      `#graphql
    query GetProducts($query: String, $first: Int, $after: String, $last: Int, $before: String) {
      products(query: $query, first: $first, after: $after, last: $last, before: $before) {
        nodes {
          id
          title
          description
          variants(first: 10) {
            nodes { id }
          }
          featuredImage {
            url
          }
        }
        pageInfo {
          startCursor
          endCursor
          hasNextPage
          hasPreviousPage
        }
      }
    }`,
      {
        variables: {
          query,
          first,
          after,
          last,
          before
        }
      });


    let {
      data: {
        products
      },
    } = await response.json();

    return products
  }
}

export async function getAIProductDescriptions(product_id: string, limit?: number) {
  return await db.shopProductDescriptionUpdates.findMany({
    where: { product_id },
    orderBy: {
      created_at: 'desc',
    },
    ...(limit ? { take: limit } : undefined)
  })
}

export async function productHasAIDescription(product_id: string): Promise<boolean> {
  const descs = await getAIProductDescriptions(product_id, 1)
  return descs?.length > 0
}

export async function updateProduct(admin: any, id: string, descriptionHtml: string) {
  await admin.graphql(
    `#graphql
          mutation updateProduct($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                title
                description
              }
            }
          }`,
    {
      variables: {
        input: {
          id,
          descriptionHtml,
          // Including only the product variant ID prevents the
          // variant from being deleted on product update
          //variants: nodes[productIdx].variants?.nodes
        },
      },
    }
  );

  return
}

export async function forEachProductPage({
  getShopifyProducts,
  callback,
}: ForEachProductPageArgs) {

  let after;
  let hasNextPage = true;

  // Each page takes a while to complete so we want to fire off all the pages
  // asynchronously and immediately return to the frontend. The status of each
  // product description update is stored in the DB and can be polled by the
  // loader function.
  while (hasNextPage) {
    let p = await getShopifyProducts({
      first: 25,
      after
    })

    after = p.pageInfo.endCursor;
    hasNextPage = p.pageInfo.hasNextPage;

    if (p?.nodes?.length === 0) {
      continue
    }

    await callback(p.nodes)
  }
}

export async function filterAllProducts({
  getShopifyProducts,
  filter,
}: FilterAllProductsArgs): Promise<Product[]> {
  let out: Product[] = []

  const callback = async (page: Product[]) => {
    const filteredProducts = await filter(page)
    out = out.concat(filteredProducts)
  }

  await forEachProductPage({
    getShopifyProducts,
    callback,
  })

  return out
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: LATEST_API_VERSION,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,

  // TODO see if this is needed
  //restResources,

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
import db from "./db.server";

