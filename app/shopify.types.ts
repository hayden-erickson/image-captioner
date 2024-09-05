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
