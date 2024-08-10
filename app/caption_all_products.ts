import db from "./db.server";
import { getVisionatiImageDescriptions } from "./visionati"
import {
  updateProduct,
  getProducts,
  Product,
  GetProductsFn,
  UpdateProductDescriptionArgs,
  UpdateProductDescriptionsFn,
} from "./shopify"

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
  getShopifyProducts: GetProductsFn;
  updateShopifyProductDescritions: UpdateProductDescriptionsFn;
}


export type UpdateAllProductDescriptionsFn = (args: UpdateAllProductDescriptionsArgs) => Promise<void>

// Update Product Descriptions
export async function updateShopifyProductDescritions({ admin, nodes, descriptions, productCatalogBulkUpdateRequestId, shopId }: UpdateProductDescriptionArgs) {
  for (let i = 0; i < nodes?.length; i++) {
    let desc = descriptions ? descriptions[nodes[i]?.featuredImage?.url] : ""
    await updateProduct(admin, nodes[i].id, desc)

    const productDescriptionUpdateId = crypto.randomUUID()
    await db.shopProductDescriptionUpdates.create({
      data: {
        product_description_update_id: productDescriptionUpdateId,
        product_id: nodes[i].id,
        shop_id: shopId,
        old_description: nodes[i].description,
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


export async function updateAllProductDescriptions({
  admin,
  visionatiApiKey,
  productCatalogBulkUpdateRequestId,
  shopId,
  getShopifyProducts,
  updateShopifyProductDescritions,
}: UpdateAllProductDescriptionsArgs) {

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
      continue
    }

    const imageURLs = nodes
      .map((n: Product) => n?.featuredImage?.url)
      .filter((u: string | null) => !!u)


    // None of the products on this page have image URLs
    if (imageURLs.length === 0) {
      continue
    }

    const descriptions = await getVisionatiImageDescriptions(visionatiApiKey, imageURLs)

    // Check that the number of descriptions from visionati matches the number of
    // urls sent.
    if (Object.keys(descriptions)?.length !== imageURLs?.length) {
      // TODO log which image URLs did not get descriptions and which did so we can debug.
      throw new Error("We did not receive all image descriptions from visionati")
    }

    await updateShopifyProductDescritions({
      admin,
      nodes,
      descriptions,
      productCatalogBulkUpdateRequestId,
      shopId
    })
  }
}

export async function captionAllProducts(admin: any, shopId: string, prid: string, updateAllProductDescriptions: UpdateAllProductDescriptionsFn) {
  const shopVisionatiApiKey = await db.shopVisionatiApiKeys.findUnique({
    where: {
      shop_id: shopId,
    },
  })

  if (!shopVisionatiApiKey || !shopVisionatiApiKey?.visionati_api_key) {
    throw new Error("shop has no visionati api key")
  }

  const visionatiApiKey = shopVisionatiApiKey?.visionati_api_key

  await db.shopProductCatalogBulkUpdateRequests.create({
    data: {
      product_catalog_bulk_update_request_id: prid,
      shop_id: shopId,
      start_time: new Date(),
    }
  })

  // Do not wait on all products to be updated or else the action will timeout
  return updateAllProductDescriptions({
    admin,
    visionatiApiKey,
    productCatalogBulkUpdateRequestId: prid,
    shopId: shopId,
    getShopifyProducts: getProducts,
    updateShopifyProductDescritions,
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

      console.error(`ERROR product catalog bulk update request ${prid}`)
      console.error(err)
    })

}
