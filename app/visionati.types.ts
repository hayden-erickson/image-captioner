export type VisionatiDescriptionBackend = "llava"
  | "bakllava"
  | "jinaai"
  | "gemini"
  | "claude"
  | "openai"

export const visionatiDescriptionBackends: VisionatiDescriptionBackend[] = [
  "llava", "bakllava", "jinaai", "gemini", "claude", "openai"
]

export type VisionatiTaggingBackend = "clarifai"
  | "googlevision"
  | "imagga"
  | "rekognition"

export const visionatiTaggingBackends: VisionatiTaggingBackend[] = [
  "clarifai", "googlevision", "imagga", "rekognition"
]

export type VisionatiBackend = VisionatiDescriptionBackend | VisionatiTaggingBackend


export type VisionatiFeature = "brands"
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

export const visionatiRoles: VisionatiRole[] = [
  "artist",
  "caption",
  "comedian",
  "critic",
  "general",
  "ecommerce",
  "inspector",
  "promoter",
  "prompt",
  "realtor",
  "tweet"
]

export const DEFAULT_ROLE: VisionatiRole = "ecommerce"
export const DEFAULT_BACKEND: VisionatiBackend = "gemini"
export const DEFAULT_FEATURES: [VisionatiFeature] = ['descriptions']

export type VisionatiDescription = {
  description: string;
  source: string;
}

export type VisionatiAsset = {
  name: string;
  descriptions?: [VisionatiDescription]
}

export type VisionatiReq = {
  backend: [VisionatiBackend] | VisionatiBackend;
  url: string[];
  role: VisionatiRole;
  feature: [VisionatiFeature] | VisionatiFeature;
  prompt?: string;
}

export type VisionatiBatchResp = {
  success?: Boolean;
  error?: string;
  response_uri: string;
}
export type VisionatiResponse = {
  error?: string;
  status?: string;
  urls: [string] | [];
  credits: number;
  all?: {
    assets: [VisionatiAsset]
  }
}

export type VisionatiSettings = {
  apiKey: string;
  shopId: string;
  role?: VisionatiRole | null;
  backend?: VisionatiBackend | null;
  customPrompt?: string;
  credits?: number;
}


export type URLDescriptionIdx = {
  [key: string]: string;
}

export type GetImageDescriptionsFn = (imageUrls: string[]) => Promise<URLDescriptionIdx>
