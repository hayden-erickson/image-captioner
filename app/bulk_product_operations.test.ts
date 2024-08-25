import { jest, describe, expect, beforeEach, afterEach, test } from "@jest/globals";
import {
  Product,
  ProductConnection,
  ProductFilterFn,
  ProductPageFn,
} from "./shopify"
import {
  createProductDescriptionUpdateLogs,
  bulkProductUpdate,
  logProductDescriptionUpdatesClient,
  filterProductsHaveAIDescriptions,
} from "./bulk_product_operations"
import * as v from "./visionati";
import db from "./db.server";

const given = describe;

const genFakeProducts = (n: number) => [...new Array(n)].map((x: undefined, i: number) => ({
  id: crypto.randomUUID(),
  title: `product ${i}`,
  description: `description ${i}`,
  featuredImage: {
    url: `image-${i}.com/img.png`,
  }
}))


describe("createProductDescriptionUpdateLogs", () => {
  let nodes: Product[];
  let descriptions: v.URLDescriptionIdx;
  let productCatalogBulkUpdateRequestId: string;
  let shopId: string;

  beforeEach(() => {
    nodes = []
    descriptions = {}
    productCatalogBulkUpdateRequestId = ''
    shopId = ''
    productCatalogBulkUpdateRequestId = crypto.randomUUID()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  given("No image URLs", () => {
    test("Nothing runs", async () => {
      await createProductDescriptionUpdateLogs(
        {
          nodes,
          descriptions,
          productCatalogBulkUpdateRequestId,
          shopId,
        }
      )
    })
  })

  given("Image URLs", () => {
    beforeEach(() => {
      nodes = genFakeProducts(2)
      descriptions = nodes.reduce((desc: any, n: Product) => ({
        ...desc,
        [n.featuredImage.url]: n.description,
      }), {})
    })

    given("DB call fails", () => {
      test("Error is thrown", async () => {
        await expect(() => createProductDescriptionUpdateLogs(
          {
            nodes,
            descriptions,
            productCatalogBulkUpdateRequestId,
            shopId,
          }
        )).rejects.toThrowError()
      })
    })

    given("Image with no description", () => {
      let pduMock: any;
      let burMock: any;

      beforeEach(() => {
        descriptions = {}
        pduMock = jest.spyOn(db.shopProductDescriptionUpdates, 'create')
        burMock = jest.spyOn(db.shopBulkUpdateRequestsDescriptionUpdates, 'create')
      })

      afterEach(() => {
        expect(pduMock.mock.calls).toHaveLength(0)
        expect(burMock.mock.calls).toHaveLength(0)
      })

      test("nothing is logged", async () => {
        await expect(createProductDescriptionUpdateLogs({
          nodes,
          descriptions,
          productCatalogBulkUpdateRequestId,
          shopId,
        })).resolves.not.toThrow()
      })
    })

    given("DB call succeeds", () => {
      let pduMock: any;
      let burMock: any;

      beforeEach(() => {
        // mock the db calls
        pduMock = jest.spyOn(db.shopProductDescriptionUpdates, 'create').mockResolvedValue({
          product_description_update_id: '',
          product_id: '',
          shop_id: shopId,
          old_description: '',
          new_description: '',
          created_at: new Date(),
        })
        burMock = jest.spyOn(db.shopBulkUpdateRequestsDescriptionUpdates, 'create').mockResolvedValue({
          product_catalog_bulk_update_request_id: '',
          product_description_update_id: '',
          created_at: new Date(),
        })
      })

      afterEach(() => {
        nodes.forEach((n: Product, i: number) => {
          const pduArg = pduMock.mock.calls[i][0]
          expect(pduArg?.data?.product_id).toBe(n.id)
          expect(pduArg?.data?.old_description).toBe(n.description)
          expect(pduArg?.data?.new_description).toBe(descriptions[n.featuredImage.url])

          const burArg = burMock.mock.calls[i][0]
          expect(burArg?.data?.product_catalog_bulk_update_request_id).toBe(productCatalogBulkUpdateRequestId)
        })

      })

      test("No error is thrown", async () => {
        expect(() => createProductDescriptionUpdateLogs(
          {
            nodes,
            descriptions,
            productCatalogBulkUpdateRequestId,
            shopId,
          }
        )).not.toThrow()
      })
    })

  })

})

describe("bulkProductUpdate", () => {
  let shopId: string;
  let bulkUpdateProducts: any;
  let updateBulkRequest: any;
  let createBulkRequest: any;
  let prid: string;

  beforeEach(() => {
    prid = crypto.randomUUID()
    shopId = crypto.randomUUID()
    bulkUpdateProducts = jest.fn()
    updateBulkRequest = jest.spyOn(db.shopProductCatalogBulkUpdateRequests, 'update')
    createBulkRequest = jest.spyOn(db.shopProductCatalogBulkUpdateRequests, 'create')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  given("Creating shopProductCatalogBulkUpdateRequests fails", () => {
    let errMsg = "failed to create bulk update request"

    beforeEach(() => {
      createBulkRequest.mockRejectedValueOnce(new Error(errMsg))
    })

    test("Error is thrown", async () => {
      await expect(bulkProductUpdate(prid, shopId, bulkUpdateProducts)).rejects.toThrowError(errMsg)
    })

  })

  given("Creating shopProductCatalogBulkUpdateRequests succeeds", () => {
    beforeEach(() => {
      createBulkRequest.mockResolvedValueOnce({
        product_catalog_bulk_update_request_id: '',
        shop_id: '',
        start_time: new Date(),
        end_time: null,
        error: null
      })
    })

    given("bulkUpdateProducts fails", () => {
      let errMsg = "failed to update all product descriptions";

      beforeEach(() => {
        // bulkUpdateProducts is an async function therefore if anything inside throws an error, a rejected promise is returned which allows us to use the .catch(err) handler
        // If we don't define this callback as an async function and it throws an error then the returned result is a pure exception which prevents the .catch(err) handler from running.
        bulkUpdateProducts = async () => {
          throw new Error(errMsg)
        }

      })

      given("Update bulk request with error fails", () => {
        let errMsg = "failed to log error on bulk update request"

        beforeEach(() => {
          updateBulkRequest.mockRejectedValueOnce(new Error(errMsg))
        })

        test("Error is thrown", async () => {
          await expect(() => bulkProductUpdate(prid, shopId, bulkUpdateProducts)).rejects.toThrowError(errMsg)
        })

      })

      given("Update bulk request with error succeeds", () => {
        beforeEach(() => {
          updateBulkRequest.mockResolvedValueOnce({})
        })

        afterEach(() => {
          const burErr = updateBulkRequest.mock.calls[0][0].data.error
          expect(burErr).toBe(true)
        })

        test("Error is logged", async () => {
          await bulkProductUpdate(prid, shopId, bulkUpdateProducts)
        })
      })
    })

    given("bulkUpdateProducts succeeds", () => {
      beforeEach(() => {
        bulkUpdateProducts = async () => { }
        updateBulkRequest.mockResolvedValueOnce({})
      })

      afterEach(() => {
        const burErr = updateBulkRequest.mock.calls[0][0].data.error
        expect(burErr).toBeFalsy()
      })

      test("Success is logged", async () => {
        await bulkProductUpdate(prid, shopId, bulkUpdateProducts)
      })
    })
  })
})

describe("logProductDescriptionUpdatesClient", () => {
  let logProductDescriptionUpdates: ProductPageFn;
  let getImageDescriptions: ReturnType<typeof jest.fn>;
  let createProductDescriptionUpdateLogs: ReturnType<typeof jest.fn>;
  let nodes: Product[];

  beforeEach(() => {
    getImageDescriptions = jest.fn()
    createProductDescriptionUpdateLogs = jest.fn()

    logProductDescriptionUpdates = logProductDescriptionUpdatesClient({
      getImageDescriptions,
      createProductDescriptionUpdateLogs,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  given("No image URLs", () => {
    beforeEach(() => {
      nodes = []
    })

    afterEach(() => {
      expect(getImageDescriptions.mock.calls).toHaveLength(0)
      expect(createProductDescriptionUpdateLogs.mock.calls).toHaveLength(0)
    })

    test("function terminates", async () => {
      await expect(logProductDescriptionUpdates(nodes)).resolves.not.toThrow()
    })
  })

  given("Image URLs", () => {
    let imageURLs = ['http://shoes.com/bro', 'http://shirt.com/yo']
    beforeEach(() => {
      nodes = [
        {
          id: 'p1',
          title: 'shoes',
          description: 'kicks yo!',
          featuredImage: {
            url: imageURLs[0],
          }
        },
        {
          id: 'p2',
          title: 'shirt',
          description: 'thats fly',
          featuredImage: {
            url: imageURLs[1],
          }
        },
      ]
    })

    given("getImageDescriptions fails", () => {
      let errMsg = "failed to get image descriptions"

      beforeEach(() => {
        getImageDescriptions.mockRejectedValue(new Error(errMsg))
      })

      test("Error is thrown", async () => {
        await expect(logProductDescriptionUpdates(nodes)).rejects.toThrowError(errMsg)
      })
    })

    given("getImageDescriptions succeeds", () => {
      beforeEach(() => {
        getImageDescriptions.mockResolvedValue({})
      })

      given("createProductDescriptionUpdateLogs fails", () => {
        let errMsg = "failed to create product description update logs"

        beforeEach(() => {
          createProductDescriptionUpdateLogs.mockRejectedValue(new Error(errMsg))
        })

        test("Error is thrown", async () => {
          await expect(logProductDescriptionUpdates(nodes)).rejects.toThrowError(errMsg)
        })

      })

      given("createProductDescriptionUpdateLogs succeeds", () => {
        beforeEach(() => {
          createProductDescriptionUpdateLogs.mockResolvedValue({})
        })

        test("Function terminates", async () => {
          await expect(logProductDescriptionUpdates(nodes)).resolves.not.toThrow()
        })

      })
    })

  })

})


describe("filterProductsHaveAIDescriptions", () => {
  let pduMock: any;
  let nodes: Product[];
  let productsWithNoAIDescriptions: ProductFilterFn
  let productsWithAIDescriptions: ProductFilterFn

  beforeEach(() => {
    nodes = []

    productsWithNoAIDescriptions = filterProductsHaveAIDescriptions(false)
    productsWithAIDescriptions = filterProductsHaveAIDescriptions(true)

    pduMock = jest.spyOn(db.shopProductDescriptionUpdates, 'groupBy')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  given("DB call fails", () => {
    let errMsg = "failed to query product description updates"
    beforeEach(() => {
      pduMock.mockRejectedValue(new Error(errMsg))
    })

    test("error is thrown", async () => {
      await expect(productsWithNoAIDescriptions(nodes)).rejects.toThrowError(errMsg)
    })
  })

  given("DB call succeeds", () => {
    beforeEach(() => {
      nodes = [
        {
          id: crypto.randomUUID(),
          title: 'AI Shoes',
          description: 'Shoes with an AI generated description',
          featuredImage: {
            url: 'shoes.com/img.png'
          },
        },
        {
          id: crypto.randomUUID(),
          title: 'Shoes',
          description: 'These are just regular shoes',
          featuredImage: {
            url: 'shoes.com/img.png'
          },
        },
      ]
      pduMock.mockResolvedValue([
        {
          product_id: nodes[0].id,
        },
      ])
    })

    test("it properly filters products", async () => {
      await expect(productsWithAIDescriptions(nodes)).resolves.toEqual([nodes[0]])
      await expect(productsWithNoAIDescriptions(nodes)).resolves.toEqual([nodes[1]])
    })
  })

})
