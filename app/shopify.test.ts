import { jest, describe, expect, beforeEach, afterEach, test } from "@jest/globals";
import {
  forEachProductPage,
  GetProductsFn,
  shopifyClient,
  getProduct,
  updateProduct,
  GQLFn,
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

describe("ShopifyClient", () => {
  let fSpy: any;
  let gql: GQLFn;
  let shopDomain = "myshop.shopify.com"
  let accessToken = crypto.randomUUID()

  beforeEach(() => {
    gql = shopifyClient(shopDomain, accessToken)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("graphql", () => {
    given("API call fails", () => {
      let errMsg = "failed to call shopify API"
      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error(errMsg))
      })

      afterEach(() => {
        const req = fSpy.mock.calls[0][1]
        expect(JSON.parse(req.body)).toStrictEqual({ query: "query", variables: "vars" })
        expect(req.headers).toHaveProperty("X-Shopify-Access-Token", accessToken)
      })

      test("Error is thrown", async () => {
        await expect(() => gql("query", { variables: "vars" })).rejects.toThrowError(errMsg)
      })
    })

    given("Response is not ok", () => {
      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockResolvedValue(Response.error())
      })


      test("Error is thrown", async () => {
        await expect(() => gql("query", { variables: "vars" })).rejects.toThrow()
      })

    })

    given("API call succeeds", () => {
      const exp = { some: "cool object" }

      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json(exp))
      })

      test("it works", async () => {
        const resp = await gql("query", { variables: "vars" })
        expect(resp.ok).toBeTruthy()
        const received = await resp.json()
        expect(received).toEqual(exp)
      })
    })
  })

})

describe("getProduct", () => {
  let productId = crypto.randomUUID()
  let gql: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    gql = jest.fn()
  })

  afterEach(() => {
    const { variables: { id } } = gql.mock.calls[0][1]
    expect(id).toEqual(productId)
  })

  given("API call fails", () => {
    let errMsg = "failed to call shopify API"
    beforeEach(() => {
      gql.mockRejectedValue(new Error(errMsg))
    })

    test("Error is thrown", async () => {
      await expect(() => getProduct(gql, productId)).rejects.toThrowError(errMsg)
    })

  })

  given("API call succeeds", () => {
    let product = {
      id: crypto.randomUUID(),
      description: "product description",
      featuredImage: {
        url: "some.com/img.png"
      }
    }

    beforeEach(() => {
      gql.mockResolvedValueOnce(Response.json({ data: { product } }))
    })

    test("Product is returned", async () => {
      const received = await getProduct(gql, productId)
      expect(received).toEqual(product)
    })
  })

})


describe("updateProduct", () => {
  let id = crypto.randomUUID();
  let descriptionHtml = "a new fancy description!";
  let gql: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    gql = jest.fn()
  })

  given("API call fails", () => {
    let errMsg = "failed to call shopify API"
    beforeEach(() => {
      gql.mockRejectedValue(new Error(errMsg))
    })

    test("Error is thrown", async () => {
      await expect(() => updateProduct(gql, id, descriptionHtml)).rejects.toThrowError(errMsg)
    })

  })

  given("Response is valid", () => {
    beforeEach(() => {
      gql.mockResolvedValueOnce(Response.json({}))
    })

    afterEach(() => {
      const { variables: { input: { descriptionHtml: receivedDesc, id } } } = gql.mock.calls[0][1]
      expect(id).toEqual(id)
      expect(receivedDesc).toEqual(descriptionHtml)
    })

    test("Product is returned", async () => {
      await updateProduct(gql, id, descriptionHtml)
    })
  })

})


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
