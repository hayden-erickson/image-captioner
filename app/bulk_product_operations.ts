import db from "./db.server";
import { URLDescriptionIdx, visionatiClient } from "./visionati"
import {
  Product,
  GetProductsFn,
  CreateProductDescriptionUpdateLogArgs,
  //CreateProductDescriptionsLogFn,
  ProductConnection,
  ProductPageFn,
  ProductPageIteratorFn,
  forEachProductPage,
  getProductsClient,
  ProductFilterFn,
} from "./shopify"
import { GetImageDescriptionsFn } from './visionati'

export type CreateProductDescriptionsLogFn = (page: Product[], newDescs: URLDescriptionIdx) => Promise<void>

export type ProductCatalogBulkUpdateRequestResp = {
  success: false;
  error?: string;
} | {
  success: true;
  productCatalogBulkUpdateRequestId: string;
}


type UpdateAllProductDescriptionsArgs = {
  getImageDescriptions: GetImageDescriptionsFn;
  getShopifyProducts: GetProductsFn;
  updateProductDescriptions: CreateProductDescriptionsLogFn;
  forEachProductPage: ProductPageIteratorFn,
}


export type UpdateAllProductDescriptionsFn = (args: UpdateAllProductDescriptionsArgs) => Promise<void>

type logProductDescriptionUpdatesClientArgs = {
  getImageDescriptions: GetImageDescriptionsFn;
  createProductDescriptionUpdateLogs: CreateProductDescriptionsLogFn;
}


// Create Product Description Update Logs
export async function createProductDescriptionUpdateLogs({ nodes, descriptions, productCatalogBulkUpdateRequestId, shopId }: CreateProductDescriptionUpdateLogArgs) {
  for (let i = 0; i < nodes?.length; i++) {
    let desc = descriptions ? descriptions[nodes[i]?.featuredImage?.url] : ""

    if (!desc) {
      continue
    }

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

export function logProductDescriptionUpdatesClient({
  getImageDescriptions,
  createProductDescriptionUpdateLogs,
}: logProductDescriptionUpdatesClientArgs): ProductPageFn {
  return async function(p: Product[]): Promise<void> {
    const imageURLs = p
      .map((n: Product) => n?.featuredImage?.url)
      .filter((u: string | null) => !!u)


    // None of the products on this page have image URLs
    if (!imageURLs || imageURLs.length === 0) {
      return
    }

    const descriptions = await getImageDescriptions(imageURLs)
    await createProductDescriptionUpdateLogs(p, descriptions)
  }
}

export function annotateProductsWithAIDescriptions(): ProductPageFn {
  return async function(p: Product[]): Promise<void> {
    const productIds = p
      .map((n: Product) => n?.id)
      .filter((u: string | null) => !!u)

    console.log(productIds)
  }
}

export type BulkUpdateProductsFn = (bulkUpdateRequestId: string) => Promise<void>

export function logAllProductDescriptionUpdates(admin: any, shopId: string): BulkUpdateProductsFn {
  return async function(prid: string) {
    const getImageDescriptions: GetImageDescriptionsFn = await visionatiClient(shopId)
    const getShopifyProducts: GetProductsFn = getProductsClient(admin)
    const createLogs: CreateProductDescriptionsLogFn =
      (nodes: Product[], descriptions: URLDescriptionIdx): Promise<void> =>
        createProductDescriptionUpdateLogs({
          nodes,
          descriptions,
          productCatalogBulkUpdateRequestId: prid,
          shopId,
        })

    return forEachProductPage({
      getShopifyProducts,
      callback: logProductDescriptionUpdatesClient({
        getImageDescriptions,
        createProductDescriptionUpdateLogs: createLogs,
      }),
    })

  }
}

export function logProductDescriptionUpdates(shopId: string, nodes: Product[]): BulkUpdateProductsFn {
  return async function(prid: string) {
    const getImageDescriptions: GetImageDescriptionsFn = await visionatiClient(shopId)

    const descriptions = await getImageDescriptions(nodes.map((p: Product) => p?.featuredImage?.url))

    createProductDescriptionUpdateLogs({
      nodes,
      descriptions,
      productCatalogBulkUpdateRequestId: prid,
      shopId,
    })
  }
}

export async function bulkProductUpdate(prid: string, shopId: string, bulkUpdateProducts: BulkUpdateProductsFn) {
  await db.shopProductCatalogBulkUpdateRequests.create({
    data: {
      product_catalog_bulk_update_request_id: prid,
      shop_id: shopId,
      start_time: new Date(),
    }
  })

  // Do not await all products to be updated or else the action will timeout
  return bulkUpdateProducts(prid)
    .then(async () => {
      // If all updates succeed, end the bulk update request.
      await db.shopProductCatalogBulkUpdateRequests.update({
        where: { product_catalog_bulk_update_request_id: prid },
        data: { end_time: new Date() },
      })
    })
    .catch(async (err) => {
      // If any updates fail, end the bulk update request and store the error.
      await db.shopProductCatalogBulkUpdateRequests.update({
        where: { product_catalog_bulk_update_request_id: prid },
        data: { end_time: new Date(), error: true },
      })

      console.error(`ERROR product bulk update request ${prid}`)
      console.error(err)
    })
}

export function filterProductsHaveAIDescriptions(hasAIDescription: boolean): ProductFilterFn {
  return async function(page: Product[]): Promise<Product[]> {
    const aiProductIdRows = await db.shopProductDescriptionUpdates.groupBy({
      by: "product_id",
      where: {
        product_id: {
          in: page.map((p: Product) => p.id),
        }
      },
    })

    const hasAIDescriptionMap = aiProductIdRows.reduce((m: any, row: any) => ({
      ...m,
      [row.product_id]: true,
    }), {})

    const cond = (p: Product) => {
      return hasAIDescription ?
        true === hasAIDescriptionMap[p.id]
        : undefined === hasAIDescriptionMap[p.id]
    }

    return page.filter(cond)
  }
}
