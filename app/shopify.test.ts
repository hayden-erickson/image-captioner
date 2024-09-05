import { jest, describe, expect, beforeEach, afterEach, test } from "@jest/globals";
import {
  forEachProductPage,
  GetProductsFn,
} from "./shopify.server"

import {
  Product,
  ProductConnection,
} from "./shopify.types"

const given = describe

const genFakeProducts = (n: number) => [...new Array(n)].map((x: undefined, i: number) => ({
  id: crypto.randomUUID(),
  title: `product ${i}`,
  description: `description ${i}`,
  featuredImage: {
    url: `image-${i}.com/img.png`,
  }
}))

describe("forEachProductPage", () => {
  let getShopifyProducts: ReturnType<typeof jest.fn>
  let callback: ReturnType<typeof jest.fn>;
  let nodes: Product[];

  beforeEach(() => {
    callback = jest.fn()
    getShopifyProducts = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  given("Get shopify products API call fails", () => {
    let errMsg = 'Shopify API call failed'
    beforeEach(() => {
      getShopifyProducts.mockRejectedValue(new Error(errMsg))
    })

    test("Error is thrown", async () => {
      await expect(() => forEachProductPage({
        getShopifyProducts: getShopifyProducts as GetProductsFn,
        callback,
      })).rejects.toThrowError(errMsg)
    })
  })

  given("Callback throws an error", () => {
    let errMsg = 'callback failed'
    beforeEach(() => {
      getShopifyProducts.mockResolvedValue({
        nodes,
        pageInfo: {
          startCursor: "",
          endCursor: "",
          hasNextPage: false,
          hasPreviousPage: false,
        }
      })
      callback.mockRejectedValue(new Error(errMsg))
    })

    test("Error is thrown", async () => {
      await expect(() => forEachProductPage({
        getShopifyProducts: getShopifyProducts as GetProductsFn,
        callback,
      })).rejects.toThrowError(errMsg)
    })

  })

  given("Current page has no products", () => {
    beforeEach(() => {
      getShopifyProducts = jest.fn(() => Promise.resolve({
        nodes: [],
        pageInfo: {
          endCursor: '',
          hasNextPage: false,
        }
      }))
    })

    afterEach(() => {
      expect(callback.mock.calls).toHaveLength(0)
    })

    test("Function terminates", async () => {
      expect(() => forEachProductPage({
        getShopifyProducts: getShopifyProducts as GetProductsFn,
        callback,
      })).not.toThrow()
    })
  })

  given("Only one page of products", () => {

    beforeEach(() => {
      nodes = genFakeProducts(2)

      getShopifyProducts = jest.fn(() => Promise.resolve({
        nodes,
        pageInfo: {
          endCursor: crypto.randomUUID(),
          hasNextPage: false,
        }
      }))
    })

    afterEach(() => {
      expect(getShopifyProducts.mock.calls).toHaveLength(1)
      expect(callback.mock.calls).toHaveLength(1)
    })

    test("Loop only executes once", async () => {
      expect(() => forEachProductPage({
        getShopifyProducts: getShopifyProducts as GetProductsFn,
        callback,
      })).not.toThrow()
    })
  })

  given("Multiple pages of products", () => {
    let pageCount: number;
    let getShopifyProductsCallCount: number;
    let pages: ProductConnection[];

    beforeEach(() => {
      pageCount = 3;
      getShopifyProductsCallCount = 0;

      pages = [...new Array(pageCount)].map((x: undefined, i: number) => ({
        nodes: genFakeProducts(5),
        pageInfo: {
          endCursor: crypto.randomUUID(),
          startCursor: '',
          hasNextPage: i + 1 < pageCount,
          hasPreviousPage: false,
        }
      }))

      getShopifyProducts = jest.fn(() => {
        let currentPage = pages[getShopifyProductsCallCount]
        getShopifyProductsCallCount++;
        return Promise.resolve(currentPage)
      })
    })

    afterEach(() => {
      expect(getShopifyProducts.mock.calls).toHaveLength(pageCount)
    })

    test("Loop runs for each page and then stops", async () => {
      expect(() => forEachProductPage({
        getShopifyProducts: getShopifyProducts as GetProductsFn,
        callback,
      })).not.toThrow()

    })
  })
})
