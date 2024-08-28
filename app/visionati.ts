import db from "./db.server";

export type VisionatiBackend = "clarifai"
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

export type VisionatiRole = "artist"
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

export const DEFAULT_ROLE: VisionatiRole = "ecommerce"
export const DEFAULT_BACKEND: VisionatiBackend = "gemini"
const DEFAULT_FEATURES: [VisionatiFeature] = ['descriptions']

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
  prompt?: string;
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

export type VisionatiSettings = {
  apiKey: string;
  role?: VisionatiRole | null;
  backend?: VisionatiBackend | null;
  customPrompt?: string;
}


export type URLDescriptionIdx = {
  [key: string]: string;
}

export type GetImageDescriptionsFn = (imageUrls: string[]) => Promise<URLDescriptionIdx>

async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function visionatiClient(shopId: string): Promise<GetImageDescriptionsFn> {
  const settings = await db.shopVisionatiSettings.findUnique({
    where: {
      shop_id: shopId,
    },
  })

  if (!settings || !settings?.api_key) {
    throw new Error("shop has no visionati api key")
  }

  return async function(imageURLs: string[]): Promise<URLDescriptionIdx> {
    return getVisionatiImageDescriptions({
      apiKey: settings.api_key,
      role: settings.role as VisionatiRole,
      backend: settings.backend as VisionatiBackend,
      customPrompt: settings.custom_prompt || undefined,
    }, imageURLs)
  }
}


export async function getVisionatiImageDescriptions(settings: VisionatiSettings, imageURLs: string[]): Promise<URLDescriptionIdx> {
  const vReq: VisionatiReq = {
    feature: DEFAULT_FEATURES,
    role: settings.role || DEFAULT_ROLE,
    backend: settings.backend || DEFAULT_BACKEND,
    ...(settings.customPrompt ? { prompt: settings.customPrompt } : null),
    url: imageURLs
  }

  console.log(vReq)

  const visionatiResp = await fetch('https://api.visionati.com/api/fetch', {
    method: "POST",
    headers: {
      Authorization: `Token ${settings.apiKey}`,
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
        Authorization: `Token ${settings.apiKey}`,
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

