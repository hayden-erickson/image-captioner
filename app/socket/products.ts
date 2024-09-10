import { ProductConnectionWithAIAnnotation, ProductWithAIAnnotation } from "~/shopify.types";
import { useEffect, useState } from "react";
import { useSocket } from './context'
import { UpdateProductsArgs, GetProductsArgs } from './products.types'

type ProductsSubscription = {
  submit: (args: UpdateProductsArgs) => void;
  load: (args: GetProductsArgs) => void;
  isLoading: boolean;
  products: ProductConnectionWithAIAnnotation;
}

type DescriptionLogArgs = {
  productId: string;
  newDescription: string;
}

export function useProductsSubscription(): ProductsSubscription {
  const [products, setProducts] = useState({} as ProductConnectionWithAIAnnotation)
  const [isLoading, setIsLoading] = useState(false)
  const shopifySocket = useSocket();
  const socket = shopifySocket?.socket
  const shopId = shopifySocket?.shopId || ""

  const submit = (args: UpdateProductsArgs) =>
    socket?.emit("updateProducts", {
      ...args,
      shopId,
    });

  const load = (args?: GetProductsArgs) =>
    socket?.emit("getProducts", {
      ...args,
      shopId,
    })

  useEffect(() => {
    if (!socket) return;
    socket.on("products", setProducts);
    socket.on("productsLoading", setIsLoading);
    socket.on("descriptionUpdateComplete", load)

    load({ first: 10 })
  }, [socket]);

  return {
    submit,
    load,
    isLoading,
    products,
  }
}
