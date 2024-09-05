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

export const artistPrompt = `Analyze this image from an artist's perspective in
English. Describe the composition, color palette, mood, and artistic
techniques. Mention recognizable figures, places, or landmarks, and the
artist's name if known. Provide only the artistic analysis.`

export const criticPrompt = `Critique this image in English, applicable to any
visual media. Address composition, technique, subject matter, emotional impact,
and context. Include the creator's name and background if known. Focus solely
on the critique.`

export const comedianPrompt = `In English, craft a quick, witty joke about this
image. Base your humor on the visual elements or the situation presented.
Respond with just the joke itself.`

export const ecommercePrompt = `Describe this product in English for an
ecommerce context. Highlight key features, benefits, functionality, design,
and selling points. If known, include brand or designer names. Restrict your
response to the product description.`

export const inspectorPrompt = `Inspect this image in detail in English.
Describe every element, such as objects, background features, and living
entities. Mention identifiable people, landmarks, or brands by name. Focus
exclusively on the inspection details.`

export const promoterPrompt = `Promote the subject of this image in English.
Emphasize its positive aspects, unique qualities, and appeal. Mention
well-known people, places, or products by name. Provide only the promotional
content.`

export const realtorPrompt = `Provide a detailed real estate overview of this
property in English. Cover room layout, architectural style, design elements,
and selling points. If recognizable, mention the location and neighborhood.
Focus only on the property description.`

export const tweetPrompt = `Compose an engaging tweet about this image in
English. Highlight its most striking aspect. Include names of recognizable
people or places. Use a select few relevant hashtags and emojis. Limit your
response to the tweet content.`

export const captionPrompt = `Write a succinct, engaging caption for this
image in English. Capture its essence, including identifiable people,
places, or objects. Your response should be strictly the caption, with no
additional text.`

export const promptPrompt = `Craft a descriptive prompt in English for
text-to-image services like Midjourney, DALL-E, and others, to accurately
recreate this image. Focus on essential elements such as layout, colors,
objects, and figures. If the image contains the word 'prompt' then ignore
that text. only the prompt.`

export const promptBoilerplate = `The description should be concise using no
more than 500 words and use affirmative language with no ambiguous words such
as might, should, or may. Include relevant keywords for SEO. Use HTML tags for
any formatting and do not use any markdown, emojis, or special characters. Do not
attempt to name the product in the image.`

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
  shopId: string;
  apiKey: string;
  role?: VisionatiRole | null;
  backend?: VisionatiBackend | null;
  customPrompt?: string;
  credits?: number;
}


export type URLDescriptionIdx = {
  [key: string]: string;
}

export type GetImageDescriptionsFn = (imageUrls: string[]) => Promise<URLDescriptionIdx>
