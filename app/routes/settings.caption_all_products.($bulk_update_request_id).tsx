import { useState, useEffect } from 'react'
import type { LoaderFunctionArgs, ActionFunctionArgs, TypedResponse } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import db from "../db.server";
import {
  useFetcher,
} from '@remix-run/react'
import {
  Button,
  FormLayout,
  Text,
} from "@shopify/polaris";

type ShopifyProductVariant = {
  id: string;
}

type ShopifyProduct = {
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

type VisionatiBackend = "clarifai"
	| "imagga"
	| "googlevision"
	| "rekognition"
	| "llava"
	| "bakllava"
	| "jinaai"
	| "gemini"
	| "openai"

type VisionatiFeature = "brands"
	| "colors"
	| "descriptions"
	| "faces"
	| "nsfw"
	| "tags"
	| "texts"

type VisionatiRole = "artist"
	| "caption"
	| "comedian"
	| "critic"
	| "general"
	| "ecommerce"
	| "inspector"
	| "promoter"
	| "prompt"
	| "realtor"
	| "tweet"

type VisionatiReq = {
  backend: [VisionatiBackend] | VisionatiBackend;
  url: string[];
  role: VisionatiRole;
  feature: [VisionatiFeature] | VisionatiFeature;
}

type VisionatiBatchResp = {
  success?: Boolean;
  error?: string;
  response_uri: string;
}

type VisionatiDescription = {
  description: string;
  source: string;
}

type VisionatiAsset = {
  name: string;
  descriptions?: [VisionatiDescription]
}

type VisionatiResponse = {
  error?: string;
  status?: string;
  urls: [string] | [];
  all?: {
    assets: [VisionatiAsset]
  }
}

async function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms)
    })
}

type GetShopifyProductsArgs = {
  admin: any;
  first: number;
  after?: string;
}

function mapProductsToURLs(products: ShopifyProduct[]): string[] {
  // Add the image index as a query parameter
  // in case some products don't have image urls.
  // This way when we receive the response from visionati
  // we can map the description back to its corresponding
  // product.
  return products
    .map(( n: ShopifyProduct ) => n?.featuredImage?.url ? new URL(n.featuredImage.url) : null)
    .map((u: URL | null, i: number) => {
      u?.searchParams?.append("img_idx", `${i}`)
      return u?.toString() || ""
    })
    .filter((u: string ) => !!u)
}

async function getShopifyProducts({admin, first, after}: GetShopifyProductsArgs): Promise<ShopifyProductConnection> {
// TODO figure out pagination _________
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

async function getVisionatiImageDescriptions(visionatiApiKey: string, imageURLs: string[]): Promise<string[]> {
  const vReq: VisionatiReq = {
      feature: ["descriptions"],
      role: "ecommerce",
      backend: "jinaai",
      url: imageURLs
    }

  const visionatiResp = await fetch('https://api.visionati.com/api/fetch', {
    method: "POST",
    headers: {
      Authorization: `Token ${visionatiApiKey}`,
    },
    body: JSON.stringify(vReq),
  })

  const visionatiBatchResp: VisionatiBatchResp = await visionatiResp.json()

  if( !visionatiBatchResp.success || visionatiBatchResp.error || !visionatiBatchResp.response_uri) {
    throw new Error(JSON.stringify({
      success: false,
      error: visionatiBatchResp.error || "Visionati request failed",
    }))
  }

  let resp: VisionatiResponse = {urls: [], status: "processing"}

  // Poll the visionati batch API for a response
  while (resp.status === "processing") {
    const apiResp = await fetch(visionatiBatchResp.response_uri, {
      headers: {
        Authorization: `Token ${visionatiApiKey}`,
      },
    })
    resp = await apiResp.json()

    if ( resp.error ) {
      throw new Error(resp.error)
    }

    await sleep(1000) // sleep for 1 s
  }

  // Only get the first description returned from visionati.
  // TODO This may change in the future!
  const descriptions = resp?.all?.assets.map(a => a?.descriptions?.length ? a.descriptions[0].description : "") || []

  return descriptions
}


type UpdateShopifyProductDescriptionArgs = {
  admin: any;
  imageURLs: string[];
  nodes: ShopifyProduct[];
  descriptions: string[];
  productCatalogBulkUpdateRequestId: string;
  shopId: string;
}

// Update Product Descriptions
async function updateShopifyProductDescritions({admin, imageURLs, nodes, descriptions, productCatalogBulkUpdateRequestId, shopId}: UpdateShopifyProductDescriptionArgs) {
    for( let i = 0; i < imageURLs?.length; i++ ) {
      let url = new URL(imageURLs[i])
      let productIdx = Number(url.searchParams.get("img_idx"))
      let productId = nodes[productIdx].id
      let desc = descriptions ? descriptions[i] : ""
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
              variants: nodes[productIdx].variants?.nodes
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

type UpdateAllProductDescriptionsArgs = {
  admin: any;
  visionatiApiKey: string;
  productCatalogBulkUpdateRequestId: string;
  shopId: string;
}

async function updateAllProductDescriptions(args: UpdateAllProductDescriptionsArgs) {
  let {admin, visionatiApiKey, productCatalogBulkUpdateRequestId, shopId} = args
  let after;
  let hasNextPage = true;

  // Each page takes a while to complete so we want to fire off all the pages
  // asynchronously and immediately return to the frontend. The status of each
  // product description update is stored in the DB and can be polled by the
  // loader function.
  while( hasNextPage ) {
    let {nodes, pageInfo} = await getShopifyProducts({
      admin,
      first: 25,
      after
    })

    after = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;

    if( nodes?.length === 0 ) {
      return console.log({success: true, message: `no products for shop ${shopId}`})
    }

    const imageURLs = mapProductsToURLs(nodes)

    // None of the products on this page have image URLs
    if( imageURLs.length === 0 ) {
      continue
    }

    const descriptions = await getVisionatiImageDescriptions(visionatiApiKey, imageURLs)

    // Check that the number of descriptions from visionati matches the number of
    // urls sent.
    if( descriptions?.length !== imageURLs?.length ) {
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

type ProductCatalogBulkUpdateRequestResp = {
  success: false;
  error?: string;
} | {
  success: true;
  productCatalogBulkUpdateRequestId: string;
}



export const loader = async ({request, params}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request)

  if( !params['bulk_update_request_id'] ) {
    const br = await db.shopProductCatalogBulkUpdateRequests.findFirst({
      where: {shop_id: session.shop},
      orderBy: {
        start_time: 'desc'
      }
    })

    const bru = await db.shopBulkUpdateRequestsDescriptionUpdates.findMany({
      where: {product_catalog_bulk_update_request_id: br.product_catalog_bulk_update_request_id}
    })

    return json({
      productCatalogBulkUpdateRequestId: br.product_catalog_bulk_update_request_id,
      productDescriptionUpdateCount: bru.length,
      ...br
    })
  }

  const br = await db.shopProductCatalogBulkUpdateRequests.findUnique({
    where: {product_catalog_bulk_update_request_id: params['bulk_update_request_id']}
  })

  const bru = await db.shopBulkUpdateRequestsDescriptionUpdates.findMany({
    where: {product_catalog_bulk_update_request_id: params['bulk_update_request_id']}
  })

  return json({
    productCatalogBulkUpdateRequestId: br.product_catalog_bulk_update_request_id,
    productDescriptionUpdateCount: bru.length,
    ...br
  })
}

export const action = async ({ request }: ActionFunctionArgs): Promise<TypedResponse<ProductCatalogBulkUpdateRequestResp>> => {
  const {admin, session} = await authenticate.admin(request)

  const shopVisionatiApiKey = await db.shopVisionatiApiKeys.findUnique({
    where: {
      shop_id: session.shop,
    },
  })

  if( !shopVisionatiApiKey || !shopVisionatiApiKey?.visionati_api_key ) {
    return json({success: false, productCatalogBulkUpdateRequestId: '', error: "shop has no visionati api key"})
  }

  const visionatiApiKey = shopVisionatiApiKey?.visionati_api_key

  const productCatalogBulkUpdateRequestId = crypto.randomUUID()
  await db.shopProductCatalogBulkUpdateRequests.create({
    data: {
      product_catalog_bulk_update_request_id: productCatalogBulkUpdateRequestId,
      shop_id: session.shop,
      start_time: new Date(),
    }
  })

  // Do not wait on all products to be updated or else the action will timeout
  updateAllProductDescriptions({
    admin,
    visionatiApiKey,
    productCatalogBulkUpdateRequestId,
    shopId: session.shop
  })
  .then(async () => {
    // If all updates succeed, end the bulk update request.
    await db.shopProductCatalogBulkUpdateRequests.update({
      where: { product_catalog_bulk_update_request_id: productCatalogBulkUpdateRequestId },
      data: { end_time: new Date() },
    })

    console.log(`DONE product catalog bulk update request ${productCatalogBulkUpdateRequestId}`)
  })
  .catch(async (err) => {
    // If any updates fail, end the bulk update request and store the error.
    await db.shopProductCatalogBulkUpdateRequests.update({
      where: { product_catalog_bulk_update_request_id: productCatalogBulkUpdateRequestId },
      data: { end_time: new Date(), error: true },
    })

    console.error(`ERROR product catalog bulk update request }${productCatalogBulkUpdateRequestId}`)
    console.error(err)
  })

  return json({success: true, productCatalogBulkUpdateRequestId});
}


const POLL_INT = 200
const getPollTime = () => Math.floor(Date.now() / POLL_INT)

export default function CaptionAllProducts() {
    const fetcher = useFetcher<typeof loader>();
    const loading = fetcher.state !== "idle"
    const [sec, setSec] = useState(getPollTime())
    const bulkReqInProgress = fetcher?.data?.productCatalogBulkUpdateRequestId && !fetcher?.data?.end_time
    const productDescriptionUpdateCount = fetcher?.data?.productDescriptionUpdateCount

    const captionAllProducts = async () => {
      await fetcher.submit({}, {method:"POST", action:"/settings/caption_all_products"})
      shopify.toast.show('Updating all product descriptions')
    }

    useEffect(() => {
      if( loading ) {
        return
      }

      if( !bulkReqInProgress ) {
        return
      }

      // only poll every second
      if( getPollTime() === sec ) {
        return
      }

      console.log('polling for product description update count')
      fetcher.load(`/settings/caption_all_products`)
      setSec(getPollTime())
    }, [fetcher, loading, bulkReqInProgress, sec])

    useEffect(() => {
      if( !bulkReqInProgress ) {
        return
      }

      if( !productDescriptionUpdateCount ) {
        return
      }

      const descriptions = productDescriptionUpdateCount > 1 ? 'descriptions' : 'description'
      shopify.toast.show(`${productDescriptionUpdateCount} product ${descriptions} updated`)
    }, [bulkReqInProgress, productDescriptionUpdateCount])

    return (
      <FormLayout>
        <Text as="h2" variant="headingLg">
          Update All Product Catalog Descriptions
        </Text>

        <Text as="p" variant="bodyLg">
          Create AI descriptions using visionati for all the products in your catalog.
        </Text>

        <Text tone="caution" as="p" variant="bodySm">
          NOTE: This will use your visionati API credits.
          The more products you have in your catalog the more credits will be consumed.
        </Text>

        <Button variant="primary" loading={bulkReqInProgress} onClick={captionAllProducts}>
          Start
        </Button>
      </FormLayout>
    )
}
