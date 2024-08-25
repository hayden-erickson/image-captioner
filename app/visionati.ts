import db from "./db.server";

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

type VisionatiDescription = {
  description: string;
  source: string;
}

type VisionatiAsset = {
  name: string;
  descriptions?: [VisionatiDescription]
}

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
type VisionatiResponse = {
  error?: string;
  status?: string;
  urls: [string] | [];
  all?: {
    assets: [VisionatiAsset]
  }
}

export type URLDescriptionIdx = {
  [key: string]: string;
}

export type GetImageDescriptionsFn = (imageUrls: string[]) => Promise<URLDescriptionIdx>

async function sleep(ms: number) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

export async function visionatiClient(shopId: string): Promise<GetImageDescriptionsFn> {
  const shopVisionatiApiKey = await db.shopVisionatiApiKeys.findUnique({
    where: {
      shop_id: shopId,
    },
  })

  if (!shopVisionatiApiKey || !shopVisionatiApiKey?.visionati_api_key) {
    throw new Error("shop has no visionati api key")
  }

  return async function(imageURLs: string[]): Promise<URLDescriptionIdx> {
    return getVisionatiImageDescriptions(shopVisionatiApiKey?.visionati_api_key, imageURLs)
  }
}


export async function getVisionatiImageDescriptions(visionatiApiKey: string, imageURLs: string[]): Promise<URLDescriptionIdx> {
  const vReq: VisionatiReq = {
    feature: ["descriptions"],
    role: "ecommerce",
    backend: "gemini",
    url: imageURLs
  }

  const visionatiResp = await fetch('https://api.visionati.com/api/fetch', {
    method: "POST",
    headers: {
      Authorization: `Token ${visionatiApiKey}`,
    },
    body: JSON.stringify(vReq),
  })

  if (!visionatiResp.ok) {
    throw new Error(`Visionati request failed with status ${visionatiResp.status}`)
  }

  const visionatiBatchResp: VisionatiBatchResp = await visionatiResp.json()

  if (!visionatiBatchResp.success || visionatiBatchResp.error || !visionatiBatchResp.response_uri) {
    throw new Error(JSON.stringify({
      success: false,
      error: visionatiBatchResp.error || "Visionati request failed",
    }))
  }

  let resp: VisionatiResponse = { urls: [], status: "processing" }

  // Poll the visionati batch API for a response
  while (resp.status === "processing") {
    const apiResp = await fetch(visionatiBatchResp.response_uri, {
      headers: {
        Authorization: `Token ${visionatiApiKey}`,
      },
    })

    if (!apiResp.ok) {
      throw new Error("Visionati API Request Failed")
    }

    resp = await apiResp.json()

    if (resp.error) {
      throw new Error(resp.error)
    }

    await sleep(1000) // sleep for 1 s
  }


  // Only get the first description returned from visionati.
  // TODO This may change in the future!
  return resp?.all?.assets.reduce((out, a) => ({
    [a?.name]: a?.descriptions?.length ? a.descriptions[0].description : "",
    ...out,
  }), {}) || {}
}

