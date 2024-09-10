import { BillingCheckResponseObject } from '@shopify/shopify-api'

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
export const FREE_PLAN = 'free_plan'
export const BASIC_PLAN = 'basic_plan'
export const STANDARD_PLAN = 'standard_plan'
export const PREMIUM_PLAN = 'premium_plan'

export const planDescriptionCountMap: { [key: string]: number } = {
  [FREE_PLAN]: DEFAULT_DESCRIPTION_COUNT,
  [BASIC_PLAN]: 100,
  [STANDARD_PLAN]: 200,
  [PREMIUM_PLAN]: 500,
}


type UserError = {
  field: string;
  message: string;
}

type SubscriptionCancelResponse = {
  appSubscriptionCancel: {
    userErrors: UserError[],
    appSubscription: {
      id: string;
      status: string;
    }
  }
}

type SubscriptionCreateResponse = {
  appSubscriptionCreate: {
    userErrors: UserError[],
    appSubscription: {
      id: string;
    },
    confirmationUrl: string
  }
}

type PricingInterval = "EVERY_30_DAYS" | "ANNUAL"

type Price = {
  amount: number,
  currencyCode: string,
}

type RecurringPricingDetails = {
  price: Price;
  interval: PricingInterval;
}

type SubscriptionPlan = {
  appRecurringPricingDetails: RecurringPricingDetails;
}

type SubscriptionLineItemInput = {
  plan: SubscriptionPlan;
}

type SubscriptionPlanCreateInput = {
  name: string;
  returnUrl: string;
  lineItems: SubscriptionLineItemInput[],
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

const createSubscriptionGQL = `mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!) {
  appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems) {
    userErrors {
      field
      message
    }
    appSubscription {
      id
    }
    confirmationUrl
  }
}`

const cancelSubscriptionGQL = `mutation AppSubscriptionCancel($id: ID!) {
  appSubscriptionCancel(id: $id) {
    userErrors {
      field
      message
    }
    appSubscription {
      id
      status
    }
  }
}`

const oneTimePurchaseGQL = `mutation AppPurchaseOneTimeCreate($name: String!, $price: MoneyInput!, $returnUrl: URL!) {
  appPurchaseOneTimeCreate(name: $name, returnUrl: $returnUrl, price: $price) {
    userErrors {
      field
      message
    }
    appPurchaseOneTime {
      createdAt
      id
    }
    confirmationUrl
  }
}`

const billingPreferencesGQL = `query ShopBillingPreferences(){
  shopBillingPreferences() {
    currency
  }
}`

const basicSubscriptionCreateInput: SubscriptionPlanCreateInput = {
  name: BASIC_PLAN,
  returnUrl: "http://image-captioner.shopifyapps.com/",
  lineItems: [
    {
      plan: {
        appRecurringPricingDetails: {
          price: {
            amount: 10,
            currencyCode: "USD"
          },
          interval: "EVERY_30_DAYS"
        }
      }
    }
  ]
}

const standardSubscriptionCreateInput: SubscriptionPlanCreateInput = {
  name: STANDARD_PLAN,
  returnUrl: "http://image-captioner.shopifyapps.com/",
  lineItems: [
    {
      plan: {
        appRecurringPricingDetails: {
          price: {
            amount: 15,
            currencyCode: "USD"
          },
          interval: "EVERY_30_DAYS"
        }
      }
    }
  ]
}

const premiumSubscriptionCreateInput: SubscriptionPlanCreateInput = {
  name: PREMIUM_PLAN,
  returnUrl: "http://image-captioner.shopifyapps.com/",
  lineItems: [
    {
      plan: {
        appRecurringPricingDetails: {
          price: {
            amount: 25,
            currencyCode: "USD"
          },
          interval: "EVERY_30_DAYS"
        }
      }
    }
  ]
}

export const trimStr = (str: string): string =>
  str
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')


export const strippedEqual = (a: string, b: string): boolean =>
  trimStr(a) === trimStr(b)


