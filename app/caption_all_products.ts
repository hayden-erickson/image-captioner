import db from "./db.server";
import { getVisionatiImageDescriptions } from "./visionati"
import { json } from "@remix-run/node";

export type ProductCatalogBulkUpdateRequestResp = {
  success: false;
  error?: string;
} | {
  success: true;
  productCatalogBulkUpdateRequestId: string;
}

type UpdateAllProductDescriptionsArgs = {
  admin: any;
  visionatiApiKey: string;
  productCatalogBulkUpdateRequestId: string;
  shopId: string;
}

type GetShopifyProductsArgs = {
  admin: any;
  first: number;
  after?: string;
}

type ShopifyProductVariant = {
  id: string;
}

export type ShopifyProduct = {
  id: string;
  title: string;
  description: string;
  variants: {
    nodes: [ShopifyProductVariant]
  },
  featuredImage: {
    url: string;
  }
}

type ShopifyPageInfo = {
  hasNextPage: boolean;
  endCursor: string;
}

type ShopifyProductConnection = {
  nodes: ShopifyProduct[];
  pageInfo: ShopifyPageInfo;
}

function mapProductsToURLs(products: ShopifyProduct[]): string[] {
  // Add the image index as a query parameter
  // in case some products don't have image urls.
  // This way when we receive the response from visionati
  // we can map the description back to its corresponding
  // product.
  return products
    .map((n: ShopifyProduct) => n?.featuredImage?.url ? new URL(n.featuredImage.url) : null)
    .map((u: URL | null, i: number) => {
      u?.searchParams?.append("img_idx", `${i}`)
      return u?.toString() || ""
    })
    .filter((u: string) => !!u)
}

type UpdateShopifyProductDescriptionArgs = {
  admin: any;
  imageURLs: string[];
  nodes: ShopifyProduct[];
  descriptions: { [key: string]: string };
  productCatalogBulkUpdateRequestId: string;
  shopId: string;
}

// Update Product Descriptions
export async function updateShopifyProductDescritions({ admin, imageURLs, nodes, descriptions, productCatalogBulkUpdateRequestId, shopId }: UpdateShopifyProductDescriptionArgs) {
  for (let i = 0; i < imageURLs?.length; i++) {
    let url = new URL(imageURLs[i])
    let productIdx = Number(url.searchParams.get("img_idx"))
    let productId = nodes[productIdx].id
    let desc = descriptions ? descriptions[imageURLs[i]] : ""
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
            id: productId,
            descriptionHtml: desc,
            // Including only the product variant ID prevents the
            // variant from being deleted on product update
            //variants: nodes[productIdx].variants?.nodes
          },
        },
      }
    );

    const productDescriptionUpdateId = crypto.randomUUID()
    await db.shopProductDescriptionUpdates.create({
      data: {
        product_description_update_id: productDescriptionUpdateId,
        product_id: productId,
        shop_id: shopId,
        old_description: nodes[productIdx].description,
        new_description: desc,
        created_at: new Date(),
      },
    })

    await db.shopBulkUpdateRequestsDescriptionUpdates.create({
      data: {
        product_description_update_id: productDescriptionUpdateId,
        product_catalog_bulk_update_request_id: productCatalogBulkUpdateRequestId,
        created_at: new Date()
      }
    })
  }
}


async function getShopifyProducts({ admin, first, after }: GetShopifyProductsArgs): Promise<ShopifyProductConnection> {
  const response = await admin.graphql(
    `#graphql
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
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
          hasNextPage
          endCursor
        }
      }
    }`,
    {
      variables: {
        first,
        after,
      }
    });


  let {
    data: {
      products
    },
  } = await response.json();

  return products
}


async function updateAllProductDescriptions(args: UpdateAllProductDescriptionsArgs) {
  let { admin, visionatiApiKey, productCatalogBulkUpdateRequestId, shopId } = args
  let after;
  let hasNextPage = true;

  // Each page takes a while to complete so we want to fire off all the pages
  // asynchronously and immediately return to the frontend. The status of each
  // product description update is stored in the DB and can be polled by the
  // loader function.
  while (hasNextPage) {
    let { nodes, pageInfo } = await getShopifyProducts({
      admin,
      first: 25,
      after
    })

    after = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;

    if (nodes?.length === 0) {
      return console.log({ success: true, message: `no products for shop ${shopId}` })
    }

    const imageURLs = mapProductsToURLs(nodes)

    // None of the products on this page have image URLs
    if (imageURLs.length === 0) {
      continue
    }

    const descriptions = await getVisionatiImageDescriptions(visionatiApiKey, imageURLs)

    // Check that the number of descriptions from visionati matches the number of
    // urls sent.
    if (Object.keys(descriptions)?.length !== imageURLs?.length) {
      throw new Error("We did not receive all image descriptions from visionati")
    }

    await updateShopifyProductDescritions({
      admin,
      imageURLs,
      nodes,
      descriptions,
      productCatalogBulkUpdateRequestId,
      shopId
    })
  }
}

export async function captionAllProducts(admin: any, session: any, prid: string) {
  const shopVisionatiApiKey = await db.shopVisionatiApiKeys.findUnique({
    where: {
      shop_id: session.shop,
    },
  })

  if (!shopVisionatiApiKey || !shopVisionatiApiKey?.visionati_api_key) {
    return json({ success: false, prid: '', error: "shop has no visionati api key" })
  }

  const visionatiApiKey = shopVisionatiApiKey?.visionati_api_key

  await db.shopProductCatalogBulkUpdateRequests.create({
    data: {
      product_catalog_bulk_update_request_id: prid,
      shop_id: session.shop,
      start_time: new Date(),
    }
  })

  // Do not wait on all products to be updated or else the action will timeout
  updateAllProductDescriptions({
    admin,
    visionatiApiKey,
    productCatalogBulkUpdateRequestId: prid,
    shopId: session.shop
  })
    .then(async () => {
      // If all updates succeed, end the bulk update request.
      await db.shopProductCatalogBulkUpdateRequests.update({
        where: { product_catalog_bulk_update_request_id: prid },
        data: { end_time: new Date() },
      })

      console.log(`DONE product catalog bulk update request ${prid}`)
    })
    .catch(async (err) => {
      // If any updates fail, end the bulk update request and store the error.
      await db.shopProductCatalogBulkUpdateRequests.update({
        where: { product_catalog_bulk_update_request_id: prid },
        data: { end_time: new Date(), error: true },
      })

      console.error(`ERROR product catalog bulk update request }${prid}`)
      console.error(err)
    })

}
