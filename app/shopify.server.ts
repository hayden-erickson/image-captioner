import { LATEST_API_VERSION } from "@shopify/shopify-app-remix/server";
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
} from './shopify.types'

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  restResources,
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
export type GQLFn = (query: string, variables: any) => Promise<any>

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
  const response = await gql(`#graphql
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


export function getProductsClient(gql: GQLFn): GetProductsFn {
  return async function({ query, first, after, last, before }: GetProductsArgs): Promise<ProductConnection> {
    const response = await gql(
      `#graphql
    query GetProducts($query: String, $first: Int, $after: String, $last: Int, $before: String) {
      products(query: $query, first: $first, after: $after, last: $last, before: $before) {
        nodes {
          id
          title
          description
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


    const body = await response.json()

    if (body?.errors?.length > 0) {
      console.log(body)
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
  await gql(
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

