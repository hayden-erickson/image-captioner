import { BillingCheckResponseObject, BillingInterval } from '@shopify/shopify-api'

export type ForEachProductPageArgs = {
  getShopifyProducts: GetProductsFn;
  callback: ProductPageFn;
}

export type FilterAllProductsArgs = {
  getShopifyProducts: GetProductsFn;
  filter: ProductFilterFn;
}

export type GetProductsArgs = {
  query?: string | undefined | null;
  first?: number;
  after?: string | undefined | null;
  last?: number;
  before?: string | undefined | null;
}

export type GetProductsFn = ({ first, after, last, before }: GetProductsArgs) => Promise<ProductConnection>;
export type ProductPageFn = (page: Product[]) => Promise<void>;
export type ProductPageIteratorFn = (args: ForEachProductPageArgs) => Promise<void>;
export type ProductFilterFn = (page: Product[]) => Promise<Product[]>
export type GQLFn = (query: string, variables: any) => Promise<any>

type ShopifyProductVariant = {
  id: string;
}

export type OptionalShopId = {
  shopId?: string;
}

export type PageInfo = {
  hasNextPage: boolean;
  endCursor: string;
  hasPreviousPage: boolean;
  startCursor: string;
}

export type Product = {
  id: string;
  title: string;
  description: string;
  onlineStoreUrl: string;
  onlineStorePreviewUrl: string;
  variants?: {
    nodes: [ShopifyProductVariant]
  },
  featuredImage: {
    url: string;
  }
}

export type ProductConnection = {
  nodes: Product[];
  pageInfo: PageInfo;

}

export type AIAnnotation = {
  aiDescription: string
}

export type ProductWithAIAnnotation = (Product & Partial<AIAnnotation>)

export type ProductConnectionWithAIAnnotation = {
  nodes: ProductWithAIAnnotation[];
  pageInfo: PageInfo;
}

export type DescriptionInfo = {
  usedThisMonth: number;
  totalUsed: number;
  monthlyQuota?: number;
}

export type BillingInfo = {
  descriptions: DescriptionInfo;
} & BillingCheckResponseObject

export const DEFAULT_DESCRIPTION_COUNT = 25
export type PlanKey = 'free_plan'
  | 'basic_plan'
  | 'standard_plan'
  | 'premium_plan'

export const FREE_PLAN: PlanKey = 'free_plan'
export const BASIC_PLAN: PlanKey = 'basic_plan'
export const STANDARD_PLAN: PlanKey = 'standard_plan'
export const PREMIUM_PLAN: PlanKey = 'premium_plan'
export const DEFAULT_PLAN: PlanKey = FREE_PLAN

export type SubscriptionPlanDetails = {
  key: PlanKey;
  name: string;
  descriptionCount: number;
  features: string[];
  price: number;
  interval: BillingInterval.Every30Days | BillingInterval.Annual;
}

const freePlanFeatures = [
  "25 AI product descriptions per month",
  "Bulk descriptions",
]

const basicPlanFeatures = [
  "100 AI product descriptions per month",
  "Automatic & bulk descriptions",
]

const standardPlanFeatures = [
  "200 AI product descriptions per month",
  "Automatic & bulk descriptions",
  "SEO content",
  "Multiple AI roles",
  "Multiple AI models",
]

const premiumPlanFeatures = [
  "500 AI product descriptions per month",
  "Automatic & bulk descriptions",
  "SEO content",
  "Multiple AI roles",
  "Multiple AI models",
  "Custom AI prompts",
]

export const planDetailsMap: { [key: string]: SubscriptionPlanDetails } = {
  [FREE_PLAN]: {
    key: FREE_PLAN,
    name: "Free",
    descriptionCount: DEFAULT_DESCRIPTION_COUNT,
    features: freePlanFeatures,
    price: 0,
    interval: BillingInterval.Every30Days,
  },
  [BASIC_PLAN]: {
    key: BASIC_PLAN,
    name: "Basic",
    descriptionCount: 100,
    features: basicPlanFeatures,
    price: 10,
    interval: BillingInterval.Every30Days,
  },
  [STANDARD_PLAN]: {
    key: STANDARD_PLAN,
    name: "Standard",
    descriptionCount: 200,
    features: standardPlanFeatures,
    price: 15,
    interval: BillingInterval.Every30Days,
  },
  [PREMIUM_PLAN]: {
    key: PREMIUM_PLAN,
    name: "Premium",
    descriptionCount: 500,
    features: premiumPlanFeatures,
    price: 25,
    interval: BillingInterval.Every30Days,
  },
}

export const updateProductGQL = `#graphql
          mutation updateProduct($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                title
                description
              }
            }
          }`

export const getProductsPageGQL = `#graphql
    query GetProducts($query: String, $first: Int, $after: String, $last: Int, $before: String) {
      products(query: $query, first: $first, after: $after, last: $last, before: $before) {
        nodes {
          id
          title
          description
          onlineStoreUrl
          onlineStorePreviewUrl
          featuredImage {
            url
          }
        }
        pageInfo {
          startCursor
          endCursor
          hasNextPage
          hasPreviousPage
        }
      }
    }`

export const getProductGQL = `#graphql
    query GetProduct($id:ID!) {
      product(id: $id) {
        id
        title
        description
        onlineStoreUrl
        onlineStorePreviewUrl
        featuredImage {
          url
        }
      }
    }`

export const trimStr = (str: string): string =>
  str
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')


export const strippedEqual = (a: string, b: string): boolean =>
  trimStr(a) === trimStr(b)


