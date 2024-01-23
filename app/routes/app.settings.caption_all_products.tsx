import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import db from "../db.server";
import {
  useFetcher,
} from '@remix-run/react'
import {
  Button,
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

type VisionatiBackend = "clarifai" | "imagga" | "googlevision" | "rekognition" | "llava" | "bakllava" | "jinaai" | "gemini" | "openai"
type VisionatiFeature = "brands" | "colors" | "descriptions" | "faces" | "nsfw" | "tags" | "texts"
type VisionatiRole = "artist" | "caption" | "comedian" | "critic" | "general" | "ecommerce" | "inspector" | "promoter" | "prompt" | "realtor" | "tweet"

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

export const loader = async ({request}: LoaderFunctionArgs) => {
  return null
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

type VisionatiImageDescriptions = {
  success: boolean;
  descriptions?: string[];
  error?: string;
}

async function getVisionatiImageDescriptions(visionatiApiKey: string, imageURLs: string[]): Promise<VisionatiImageDescriptions> {
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
    return {success: false, error: visionatiBatchResp.error || "Visionati request failed" }
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
      return {success: false, error: resp.error}
    }

    await sleep(1000) // sleep for 1 s
  }

  // Only get the first description returned from visionati.
  // TODO This may change in the future!
  const descriptions = resp?.all?.assets.map(a => a?.descriptions?.length ? a.descriptions[0].description : "") || []

  return {success: true, descriptions}
}


type UpdateShopifyProductDescriptionArgs = {
  admin: any;
  imageURLs: string[];
  nodes: ShopifyProduct[];
  descriptions: string[];
}

// Update Product Descriptions
async function updateShopifyProductDescritions({admin, imageURLs, nodes, descriptions}: UpdateShopifyProductDescriptionArgs) {
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
    }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const {admin, session} = await authenticate.admin(request)

  let after;
  let hasNextPage = true;

  // TODO how to handle the timeout with jina AI when there are multiple product pages
  while( hasNextPage ) {
    let {nodes, pageInfo} = await getShopifyProducts({
      admin, first: 1, after
    })

    after = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;

    if( nodes?.length === 0 ) {
      return json({success: true, message: "no products"})
    }

    const imageURLs = mapProductsToURLs(nodes)

    // None of the products on this page have image URLs
    if( imageURLs.length === 0 ) {
      continue
    }

    const shopVisionatiApiKey = await db.shopVisionatiApiKeys.findUnique(
    {
      where: {
        shop_id: session.shop,
      },
    })

    if( !shopVisionatiApiKey || !shopVisionatiApiKey?.visionati_api_key ) {
      return json({success: false, error: "shop has no visionati api key"})
    }

    const visionatiApiKey = shopVisionatiApiKey?.visionati_api_key
    const descriptionsResp = await getVisionatiImageDescriptions(visionatiApiKey, imageURLs)

    if( !descriptionsResp.success ) {
      return json(descriptionsResp)
    }

    const descriptions = descriptionsResp.descriptions

    // Check that the number of descriptions from visionati matches the number of
    // urls sent.
    if( descriptions?.length !== imageURLs?.length ) {
      return json({success: false, error: "We did not receive all image descriptions from visionati"})
    }

    await updateShopifyProductDescritions({admin, imageURLs, nodes, descriptions})
  }

  return json({success: true});
}

export default function CaptionAllProducts() {
    const fetcher = useFetcher<typeof action>();
    const loading = fetcher.state !== "idle"

    const captionAllProducts = async () => fetcher.submit({}, {method:"POST", action:"/app/settings/caption_all_products"})

    return (
    <div>
        <Button onClick={captionAllProducts}> Caption All Products! </Button>
        <pre>
            {loading ? "loading..." : JSON.stringify(fetcher.data, null, 2)}
        </pre>
    </div>)
}
