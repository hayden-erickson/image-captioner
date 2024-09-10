import type { Socket } from 'socket.io'
import db from "../db.server";
import {
  GetProductsFn,
  getAIProductDescriptions,
  getProductsClient,
  filterAllProducts,
  shopifyClient,
  updateProduct,
  GQLFn,
} from "../shopify.server"

import {
  Product,
  ProductConnectionWithAIAnnotation,
  ProductWithAIAnnotation,
} from '../shopify.types'

import {
  GetProductsArgs,
  UpdateProductsArgs,
} from './products.types'

import {
  BulkUpdateProductsFn,
  bulkProductUpdate,
  logAllProductDescriptionUpdates,
  logProductDescriptionUpdates,
  filterProductsHaveAIDescriptions
} from "../bulk_product_operations.server"

async function gqlClient(shop: string): Promise<GQLFn> {
  const session = await db.session.findFirst({ where: { shop } });

  if (!session) {
    throw new Error(
      `Shop ${shop} has no session. Therefore, we cannot make requests to the shopify API`,
    );
  }

  return shopifyClient(shop, session.accessToken);
}

async function handleUpdateProducts(shopify: GQLFn, args: UpdateProductsArgs) {
  const productCatalogBulkUpdateRequestId = crypto.randomUUID()
  if (!args.shopId) {
    console.error('No shop ID provided to update product descriptions')
    return
  }

  let bulkOperation: BulkUpdateProductsFn;

  if (args?.action === 'approve') {
    return await Promise.all(args?.products.map(
      (p: ProductWithAIAnnotation) => updateProduct(shopify, p.id, p.aiDescription || '')
    ))
  }

  if (args?.allProductsSelected) {
    bulkOperation = logAllProductDescriptionUpdates(shopify, args.shopId)
  } else {
    bulkOperation = logProductDescriptionUpdates(args.shopId, args.products)
  }

  await bulkProductUpdate(
    productCatalogBulkUpdateRequestId,
    args.shopId,
    bulkOperation,
  )
}


const strippedEqual = (a: string, b: string): boolean =>
  a.replace(/\s/g, '') === b.replace(/\s/g, '')

async function loaderWithFilter(
  socket: Socket,
  filterName: string,
  getShopifyProducts: GetProductsFn
) {
  const hasAIDescription = filterName === 'products_ai_descriptions'
    || filterName === 'products_pending_ai_descriptions'

  const filteredNodes = await filterAllProducts({
    getShopifyProducts,
    filter: filterProductsHaveAIDescriptions(hasAIDescription)
  })

  let nodes = await Promise.all(
    filteredNodes.map(
      async (p: Product): Promise<ProductWithAIAnnotation> => {
        let aiDescription = ''
        if (hasAIDescription) {
          let descUpdateRow = await getAIProductDescriptions(p.id, 1)
          aiDescription = descUpdateRow[0].new_description
        }

        return {
          ...p,
          ...(hasAIDescription ? { aiDescription } : undefined),
        }
      }
    )
  )

  nodes = nodes.filter((p: ProductWithAIAnnotation) => {

    if (filterName === 'products_pending_ai_descriptions') {
      return !strippedEqual(p.description, p.aiDescription || '')
    }

    if (filterName === 'products_ai_descriptions') {
      return strippedEqual(p.description, p.aiDescription || '')
    }

    return true
  })

  socket.emit("products", {
    nodes,
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: '',
      endCursor: '',
    },
  })
}

async function handleGetProducts(socket: Socket, shopify: GQLFn, { filter, q, after, before }: GetProductsArgs) {
  const getProducts = getProductsClient(shopify)

  if (filter && filter !== 'all_products') {
    return loaderWithFilter(socket, filter, getProducts)
  }

  let products = {} as ProductConnectionWithAIAnnotation;

  try {
    products = await getProducts({
      query: q,
      after,
      before,
      first: !before ? 10 : undefined,
      last: before ? 10 : undefined,
    })
  } catch (e: any) {
    socket.emit("error", e)
    return
  }

  if (!products) {
    return
  }

  await Promise.all(products.nodes.map(async (p: Product, i: number) => {
    const aiDescs = await getAIProductDescriptions(p.id, 1)
    products.nodes[i].aiDescription = aiDescs?.length > 0 ? aiDescs[0].new_description : ''
  }))

  socket.emit("products", products)
}

export function productsHandler(socket: Socket) {
  socket.on("updateProducts", async (args: UpdateProductsArgs & { shopId: string }) => {
    socket.emit("productsLoading", true)
    await handleUpdateProducts(await gqlClient(args.shopId), args)
    socket.emit("productsLoading", false)
    socket.emit("descriptionUpdateComplete")
  })

  socket.on("getProducts", async (args: GetProductsArgs & { shopId: string }) => {
    socket.emit("productsLoading", true)
    await handleGetProducts(socket, await gqlClient(args.shopId), args)
    socket.emit("productsLoading", false)
  })
}

