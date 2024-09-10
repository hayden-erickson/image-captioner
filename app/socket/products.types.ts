import { ProductWithAIAnnotation } from "~/shopify.types";

export type UpdateProductsArgs = {
  products: ProductWithAIAnnotation[];
  shopId?: string;
  action?: string;
  allProductsSelected?: boolean;
}

export type GetProductsArgs = {
  filter?: string;
  q?: string;
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

