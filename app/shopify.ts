import db from "./db.server";

type ShopifyProductVariant = {
  id: string;
}

export type PageInfo = {
  hasNextPage: boolean;
  endCursor: string;
  hasPreviousPage: boolean;
  startCursor: string;
}

export type Product = {
  id: string;
  title: string;
  description: string;
  variants?: {
    nodes: [ShopifyProductVariant]
  },
  featuredImage: {
    url: string;
  }
}

export type ProductConnection = {
  nodes: Product[];
  pageInfo: PageInfo;

}
export type GetProductsArgs = {
  query?: string | undefined | null;
  first?: number;
  after?: string | undefined | null;
  last?: number;
  before?: string | undefined | null;
}

export type CreateProductDescriptionUpdateLogArgs = {
  nodes: Product[];
  descriptions: { [key: string]: string };
  productCatalogBulkUpdateRequestId: string;
  shopId: string;
}

export type AIAnnotation = {
  aiDescription: string
}

export type ProductWithAIAnnotation = (Product & Partial<AIAnnotation>)

export type ProductConnectionWithAIAnnotation = {
  nodes: ProductWithAIAnnotation[];
  pageInfo: PageInfo;
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
