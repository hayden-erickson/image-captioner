type ShopifyProductVariant = {
  id: string;
}

type PageInfo = {
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
  admin: any;
  first?: number;
  after?: string | undefined | null;
  last?: number;
  before?: string | undefined | null;
}

export type UpdateProductDescriptionArgs = {
  admin: any;
  nodes: Product[];
  descriptions: { [key: string]: string };
  productCatalogBulkUpdateRequestId: string;
  shopId: string;
}

export type UpdateProductDescriptionsFn = ({ admin, nodes, descriptions, productCatalogBulkUpdateRequestId, shopId }: UpdateProductDescriptionArgs) => Promise<void>
export type GetProductsFn = ({ admin, first, after, last, before }: GetProductsArgs) => Promise<ProductConnection>;


export async function getProducts({ admin, first, after, last, before }: GetProductsArgs): Promise<ProductConnection> {
  const response = await admin.graphql(
    `#graphql
    query GetProducts($first: Int, $after: String, $last: Int, $before: String) {
      products(first: $first, after: $after, last: $last, before: $before) {
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
}
