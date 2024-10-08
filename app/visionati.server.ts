import { wrap } from "module";
import db from "./db.server";
import {
  artistPrompt,
  criticPrompt,
  comedianPrompt,
  ecommercePrompt,
  inspectorPrompt,
  promoterPrompt,
  realtorPrompt,
  tweetPrompt,
  captionPrompt,
  promptPrompt,
  promptBoilerplate,
  GetImageDescriptionsFn,
  VisionatiBackend,
  VisionatiRole,
  VisionatiSettings,
  VisionatiReq,
  VisionatiResponse,
  VisionatiBatchResp,
  URLDescriptionIdx,
  DEFAULT_FEATURES,
  DEFAULT_ROLE,
  DEFAULT_BACKEND,
} from './visionati.types'

async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function visionatiClient(shopId: string): Promise<GetImageDescriptionsFn> {
  const apiKey = process.env.VISIONATI_API_KEY

  if (!apiKey) {
    throw new Error("no visionati api key provided")
  }

  const settings = await db.shopVisionatiSettings.findUnique({
    where: {
      shop_id: shopId,
    },
  })

  return async function(imageURLs: string[]): Promise<URLDescriptionIdx> {
    return getVisionatiImageDescriptions({
      shopId,
      apiKey,
      role: settings?.role as VisionatiRole,
      backend: settings?.backend as VisionatiBackend,
      customPrompt: settings?.custom_prompt || undefined,
    }, imageURLs)
  }
}

function roleToPrompt(role: VisionatiRole): string {
  switch (role) {
    case 'artist':
      return artistPrompt
    case 'critic':
      return criticPrompt
    case 'comedian':
      return comedianPrompt
    case 'ecommerce':
      return ecommercePrompt
    case 'inspector':
      return inspectorPrompt
    case 'promoter':
      return promoterPrompt
    case 'realtor':
      return realtorPrompt
    case 'tweet':
      return tweetPrompt
    case 'caption':
      return captionPrompt
    case 'prompt':
      return promptPrompt
    default:
      return ''
  }
}

function wrapPromptWithBoilerplate(prompt: string): string {
  return `${prompt}
  ${promptBoilerplate}`
}

export function createPrompt(settings: VisionatiSettings): string {
  if (settings.customPrompt) {
    return wrapPromptWithBoilerplate(settings.customPrompt)
  }

  return wrapPromptWithBoilerplate(
    roleToPrompt(settings.role || DEFAULT_ROLE))
}


export async function getVisionatiImageDescriptions(settings: VisionatiSettings, imageURLs: string[]): Promise<URLDescriptionIdx> {
  const vReq: VisionatiReq = {
    feature: DEFAULT_FEATURES,
    backend: settings.backend || DEFAULT_BACKEND,
    prompt: createPrompt(settings),
    url: imageURLs
  }

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

  let resp: VisionatiResponse = { urls: [], status: "processing", credits: 0 }

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

  await db.shopVisionatiSettings.update({
    data: {
      credits: resp.credits,
    },
    where: {
      shop_id: settings.shopId,
    }
  })

  // Only get the first description returned from visionati.
  // TODO This may change in the future!
  return resp?.all?.assets.reduce((out, a) => ({
    [a?.name]: a?.descriptions?.length ? a.descriptions[0].description : "",
    ...out,
  }), {}) || {}
}

