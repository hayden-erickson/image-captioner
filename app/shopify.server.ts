import { LATEST_API_VERSION, LogSeverity } from "@shopify/shopify-app-remix/server";
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-07";
import prisma from "./db.server";
import "@shopify/shopify-app-remix/server/adapters/node";
import {
  Product,
  ProductConnection,
  GetProductsFn,
  GetProductsArgs,
  GQLFn,
  ForEachProductPageArgs,
  FilterAllProductsArgs,
  getProductGQL,
  getProductsPageGQL,
  updateProductGQL,
  planDetailsMap,
  FREE_PLAN,
  BASIC_PLAN,
  STANDARD_PLAN,
  PREMIUM_PLAN,
} from './shopify.types'
import pino from 'pino';

export const logger = pino({
  level: process.env.PINO_LOG_LEVEL || 'debug',
  timestamp: pino.stdTimeFunctions.isoTime,
});

const fLog = logger.child({ file: './app/shopify.server.ts' })

const shopify = shopifyApp({
  logger: {
    level: LogSeverity.Info,
    httpRequests: true,
    timestamps: true,
  },
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  restResources,
  billing: {
    [FREE_PLAN]: {
      lineItems: [{
        amount: planDetailsMap[FREE_PLAN].price,
        currencyCode: 'USD',
        interval: planDetailsMap[FREE_PLAN].interval,
      }],
    },
    [BASIC_PLAN]: {
      lineItems: [{
        amount: planDetailsMap[BASIC_PLAN].price,
        currencyCode: 'USD',
        interval: planDetailsMap[BASIC_PLAN].interval,
      }],
    },
    [STANDARD_PLAN]: {
      lineItems: [{
        amount: planDetailsMap[STANDARD_PLAN].price,
        currencyCode: 'USD',
        interval: planDetailsMap[STANDARD_PLAN].interval,
      }],
    },
    [PREMIUM_PLAN]: {
      lineItems: [{
        amount: planDetailsMap[PREMIUM_PLAN].price,
        currencyCode: 'USD',
        interval: planDetailsMap[PREMIUM_PLAN].interval,
      }],
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});


export default shopify;
export const apiVersion = ApiVersion.July24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

export function shopifyClient(shopDomain: string, accessToken: string): GQLFn {
  const sd = `https://${shopDomain}/admin/api/${LATEST_API_VERSION}/graphql.json`;

  return async function(query: string, { variables }: any) {
    const resp = await fetch(sd, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!resp.ok) {
      throw new Error(resp.statusText)
    }

    return resp
  }
}

export async function getProduct(gql: GQLFn, id: string): Promise<Product> {
  const response = await gql(getProductGQL, { variables: { id } })

  let {
    data: {
      product
    },
  } = await response.json();

  return product
}


export function getProductsClient(gql: GQLFn): GetProductsFn {
  return async function({ query, first, after, last, before }: GetProductsArgs): Promise<ProductConnection> {
    const response = await gql(getProductsPageGQL,
      {
        variables: {
          query,
          first,
          after,
          last,
          before
        }
      });


    const body = await response.json()

    if (body?.errors?.length > 0) {
      fLog.error({
        body,
        function: 'getProductsClient',
      }, 'getting products page from shopify admin API')
      const allMsgs = body.errors.map((e: any) => e.message).join('\n')
      throw new Error(allMsgs)
    }

    return body?.data?.products
  }
}

export async function getAIProductDescriptions(product_id: string, limit?: number) {
  return await prisma.shopProductDescriptionUpdates.findMany({
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

export async function updateProduct(gql: GQLFn, id: string, descriptionHtml: string) {
  await gql(updateProductGQL,
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

    if (!p) {
      break
    }

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
