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

async function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms)
    })
}

export async function getVisionatiImageDescriptions(visionatiApiKey: string, imageURLs: string[]): Promise<string[]> {
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

