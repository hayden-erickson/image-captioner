import { jest, describe, expect, beforeEach, afterEach, test } from "@jest/globals";
import {
  ShopifyProduct,
  updateAllProductDescriptions,
  updateShopifyProductDescritions,
  UpdateShopifyProductDescriptionsFn,
  GetShopifyProductsFn,
  ShopifyProductConnection,
  captionAllProducts,
} from "./caption_all_products"
import * as v from "./visionati";
import db from "./db.server";
import exp from "constants";
const given = describe;

const genFakeProducts = (n: number) => [...new Array(n)].map((x: undefined, i: number) => ({
  id: crypto.randomUUID(),
  title: `product ${i}`,
  description: `description ${i}`,
  featuredImage: {
    url: `image-${i}.com/img.png`,
  }
}))


describe("updateShopifyProductDescritions", () => {
  let nodes: ShopifyProduct[];
  let admin: { graphql: ReturnType<typeof jest.fn> };
  let descriptions: v.URLDescriptionIdx;
  let productCatalogBulkUpdateRequestId: string;
  let shopId: string;

  beforeEach(() => {
    nodes = []
    descriptions = {}
    productCatalogBulkUpdateRequestId = ''
    shopId = ''
    admin = {
      graphql: jest.fn(),
    }

    productCatalogBulkUpdateRequestId = crypto.randomUUID()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  given("No image URLs", () => {
    test("Nothing runs", async () => {
      await updateShopifyProductDescritions(
        {
          admin,
          nodes,
          descriptions,
          productCatalogBulkUpdateRequestId,
          shopId,
        }
      )

      expect(admin.graphql).not.toBeCalled()
    })
  })

  given("Image URLs", () => {
    const url1 = "http://url.one/img.png"
    const url2 = "http://url.two/img.png"

    beforeEach(() => {
      nodes = genFakeProducts(2)
      descriptions = {
        [url1]: 'new description 1',
        [url2]: 'new description 2',
      }
    })

    afterEach(() => {
      const args1 = admin.graphql.mock.calls[0][1]
      expect(args1?.variables?.input?.descriptionHtml).toBe(descriptions[nodes[0].featuredImage.url])
      // graphql only gets called once then the loop exits because the db call fails
    })

    given("Shopify API call fails", () => {
      let errMsg = 'Shopify API call failed'
      beforeEach(() => {
        admin.graphql.mockRejectedValue(new Error(errMsg))
      })

      test("Error is thrown", async () => {
        await expect(() => updateShopifyProductDescritions(
          {
            admin,
            nodes,
            descriptions,
            productCatalogBulkUpdateRequestId,
            shopId,
          }
        )).rejects.toThrowError(errMsg)
      })
    })

    given("DB call fails", () => {
      test("Error is thrown", async () => {
        await expect(() => updateShopifyProductDescritions(
          {
            admin,
            nodes,
            descriptions,
            productCatalogBulkUpdateRequestId,
            shopId,
          }
        )).rejects.toThrowError()
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
        // Now that the DB calls succeed the next product description can be updated.
        const args2 = admin.graphql.mock.calls[1][1]
        expect(args2?.variables?.input?.descriptionHtml).toBe(descriptions[nodes[1].featuredImage.url])

        nodes.forEach((n: ShopifyProduct, i: number) => {
          const pduArg = pduMock.mock.calls[i][0]
          expect(pduArg?.data?.product_id).toBe(n.id)
          expect(pduArg?.data?.old_description).toBe(n.description)
          expect(pduArg?.data?.new_description).toBe(descriptions[n.featuredImage.url])

          const burArg = burMock.mock.calls[i][0]
          expect(burArg?.data?.product_catalog_bulk_update_request_id).toBe(productCatalogBulkUpdateRequestId)
        })

      })

      test("No error is thrown", async () => {
        expect(() => updateShopifyProductDescritions(
          {
            admin,
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

describe("updateAllProductDescriptions", () => {
  let admin: any;
  let visionatiApiKey: string;
  let productCatalogBulkUpdateRequestId: string;
  let shopId: string;
  let getShopifyProducts: ReturnType<typeof jest.fn>
  let updateShopifyProductDescritions: ReturnType<typeof jest.fn>
  let vSpy: any;
  let nodes: ShopifyProduct[];

  beforeEach(() => {
    admin = {
      graphql: jest.fn()
    }
    visionatiApiKey = crypto.randomUUID()
    productCatalogBulkUpdateRequestId = crypto.randomUUID()
    shopId = crypto.randomUUID()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  given("Get shopify products API call fails", () => {
    let errMsg = 'Shopify API call failed'
    beforeEach(() => {
      getShopifyProducts = jest.fn(async () => {
        throw new Error(errMsg)
      })
    })

    test("Error is thrown", async () => {
      await expect(() => updateAllProductDescriptions({
        admin,
        visionatiApiKey,
        productCatalogBulkUpdateRequestId,
        shopId,
        getShopifyProducts: getShopifyProducts as GetShopifyProductsFn,
        updateShopifyProductDescritions: updateShopifyProductDescritions as UpdateShopifyProductDescriptionsFn,
      })).rejects.toThrowError(errMsg)
    })
  })


  beforeEach(() => {
    vSpy = jest.spyOn(v, 'getVisionatiImageDescriptions')
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
      expect(vSpy).not.toBeCalled()
    })

    test("Function terminates", async () => {
      expect(() => updateAllProductDescriptions({
        admin,
        visionatiApiKey,
        productCatalogBulkUpdateRequestId,
        shopId,
        getShopifyProducts: getShopifyProducts as GetShopifyProductsFn,
        updateShopifyProductDescritions: updateShopifyProductDescritions as UpdateShopifyProductDescriptionsFn,
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

      const descriptions = nodes.reduce((all: { [key: string]: string }, n: ShopifyProduct) => ({ ...all, [n.featuredImage.url]: n.description }), {})

      vSpy = jest.spyOn(v, 'getVisionatiImageDescriptions').mockResolvedValue(descriptions)

      updateShopifyProductDescritions = jest.fn(() => Promise.resolve({}))
    })

    afterEach(() => {
      expect(getShopifyProducts.mock.calls).toHaveLength(1)
    })

    given("All API calls succeed", () => {
      afterEach(() => {
        expect(vSpy.mock.calls).toHaveLength(1)
        expect(updateShopifyProductDescritions.mock.calls).toHaveLength(1)

        const visionatiApiKeyArg = vSpy.mock.calls[0][0]
        const imageURLsArg = vSpy.mock.calls[0][1]

        expect(visionatiApiKeyArg).toBe(visionatiApiKey)
        expect(imageURLsArg).toStrictEqual(nodes.map((n: ShopifyProduct) => n.featuredImage.url))

        const descriptionsArg = updateShopifyProductDescritions.mock.calls[0][0].descriptions
        const nodesArg = updateShopifyProductDescritions.mock.calls[0][0].nodes

        expect(descriptionsArg).toStrictEqual(nodes.reduce((all: { [key: string]: string }, n: ShopifyProduct) => ({ ...all, [n.featuredImage.url]: n.description }), {}))
        expect(nodesArg).toStrictEqual(nodes)
      })

      test("Loop only executes once", async () => {
        expect(() => updateAllProductDescriptions({
          admin,
          visionatiApiKey,
          productCatalogBulkUpdateRequestId,
          shopId,
          getShopifyProducts: getShopifyProducts as GetShopifyProductsFn,
          updateShopifyProductDescritions: updateShopifyProductDescritions as UpdateShopifyProductDescriptionsFn,
        })).not.toThrow()
      })
    })




    given("Visionati call fails", () => {
      let errMsg = "Visionati API call failed"
      beforeEach(() => {
        vSpy.mockRejectedValue(new Error(errMsg))
      })

      test("Error is thrown", async () => {
        await expect(() => updateAllProductDescriptions({
          admin,
          visionatiApiKey,
          productCatalogBulkUpdateRequestId,
          shopId,
          getShopifyProducts: getShopifyProducts as GetShopifyProductsFn,
          updateShopifyProductDescritions: updateShopifyProductDescritions as UpdateShopifyProductDescriptionsFn,
        })).rejects.toThrowError(errMsg)
      })
    })

    given("Visionati returns less descriptions", () => {
      beforeEach(() => {
        vSpy.mockResolvedValue({})
      })

      test("Error is thrown", async () => {
        await expect(() => updateAllProductDescriptions({
          admin,
          visionatiApiKey,
          productCatalogBulkUpdateRequestId,
          shopId,
          getShopifyProducts: getShopifyProducts as GetShopifyProductsFn,
          updateShopifyProductDescritions: updateShopifyProductDescritions as UpdateShopifyProductDescriptionsFn,
        })).rejects.toThrowError("We did not receive all image descriptions from visionati")

      })
    })

    given("updateShopifyProductDescritions call fails", () => {
      let errMsg = "failed to update shopify descriptions"

      beforeEach(() => {
        updateShopifyProductDescritions = jest.fn(() => {
          throw new Error(errMsg)
        })
      })

      afterEach(() => {
        expect(vSpy.mock.calls).toHaveLength(1)
        expect(updateShopifyProductDescritions.mock.calls).toHaveLength(1)
      })

      test("Error is thrown", async () => {
        await expect(() => updateAllProductDescriptions({
          admin,
          visionatiApiKey,
          productCatalogBulkUpdateRequestId,
          shopId,
          getShopifyProducts: getShopifyProducts as GetShopifyProductsFn,
          updateShopifyProductDescritions: updateShopifyProductDescritions as UpdateShopifyProductDescriptionsFn,
        })).rejects.toThrowError(errMsg)

      })
    })


  })

  given("Multiple pages of products", () => {
    let pageCount: number;
    let getShopifyProductsCallCount: number;
    let getVisionatiImageDescriptionsCallCount: number;
    let pages: ShopifyProductConnection[];

    beforeEach(() => {
      pageCount = 3;
      getShopifyProductsCallCount = 0;
      getVisionatiImageDescriptionsCallCount = 0;

      pages = [...new Array(pageCount)].map((x: undefined, i: number) => ({
        nodes: genFakeProducts(5),
        pageInfo: {
          endCursor: crypto.randomUUID(),
          hasNextPage: i + 1 < pageCount,
        }
      }))

      getShopifyProducts = jest.fn(() => {
        let currentPage = pages[getShopifyProductsCallCount]
        getShopifyProductsCallCount++;
        return Promise.resolve(currentPage)
      })

      vSpy = jest.spyOn(v, 'getVisionatiImageDescriptions').mockImplementation(
        (visionatiApiKey: string, imageURLs: string[]): Promise<v.URLDescriptionIdx> => {
          let currentDescriptions = pages[getVisionatiImageDescriptionsCallCount].nodes
            .reduce((all: { [key: string]: string }, n: ShopifyProduct) =>
              ({ ...all, [n.featuredImage.url]: n.description }), {})

          getVisionatiImageDescriptionsCallCount++;
          return Promise.resolve(currentDescriptions);
        })

      updateShopifyProductDescritions = jest.fn(() => Promise.resolve({}))
    })

    afterEach(() => {
      expect(getShopifyProducts.mock.calls).toHaveLength(pageCount)
      expect(vSpy.mock.calls).toHaveLength(pageCount)
      expect(updateShopifyProductDescritions.mock.calls).toHaveLength(pageCount)
    })

    test("Loop runs for each pages and then stops", async () => {
      expect(() => updateAllProductDescriptions({
        admin,
        visionatiApiKey,
        productCatalogBulkUpdateRequestId,
        shopId,
        getShopifyProducts: getShopifyProducts as GetShopifyProductsFn,
        updateShopifyProductDescritions: updateShopifyProductDescritions as UpdateShopifyProductDescriptionsFn,
      })).not.toThrow()

    })
  })
})

describe("captionAllProducts", () => {
  let svakMock: any;
  let admin: any;
  let shopId: string;
  let prid: string;
  let updateAllProductDescriptions: any;
  let updateBulkRequest: any;
  let createBulkRequest: any;

  beforeEach(() => {
    shopId = crypto.randomUUID()
    prid = crypto.randomUUID()
    updateAllProductDescriptions = jest.fn()
    updateBulkRequest = jest.spyOn(db.shopProductCatalogBulkUpdateRequests, 'update')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  given("DB call fails", () => {
    let errMsg = 'DB connection failed';

    beforeEach(() => {
      svakMock = jest.spyOn(db.shopVisionatiApiKeys, 'findUnique').mockRejectedValueOnce(new Error(errMsg))
    })

    test("Error is thrown", async () => {
      await expect(() => captionAllProducts(admin, shopId, prid, updateAllProductDescriptions)).rejects.toThrowError(errMsg)
    })
  })

  given("Shop has no visionati API key", () => {
    beforeEach(() => {
      svakMock = jest.spyOn(db.shopVisionatiApiKeys, 'findUnique').mockResolvedValueOnce({
        shop_id: '',
        visionati_api_key: '',
      })
    })

    test("Error is thrown", async () => {
      await expect(() => captionAllProducts(admin, shopId, prid, updateAllProductDescriptions)).rejects.toThrowError("shop has no visionati api key")
    })
  })

  given("Shop has visionati API key", () => {
    beforeEach(() => {
      svakMock = jest.spyOn(db.shopVisionatiApiKeys, 'findUnique').mockResolvedValueOnce({
        shop_id: shopId,
        visionati_api_key: crypto.randomUUID(),
      })
    })

    given("Creating shopProductCatalogBulkUpdateRequests fails", () => {
      let errMsg = "failed to create bulk update request"

      beforeEach(() => {
        createBulkRequest = jest.spyOn(db.shopProductCatalogBulkUpdateRequests, 'create').mockRejectedValueOnce(new Error(errMsg))
      })

      test("Error is thrown", async () => {
        await expect(captionAllProducts(admin, shopId, prid, updateAllProductDescriptions)).rejects.toThrowError(errMsg)
      })

    })

    given("Creating shopProductCatalogBulkUpdateRequests succeeds", () => {
      beforeEach(() => {
        createBulkRequest = jest.spyOn(db.shopProductCatalogBulkUpdateRequests, 'create').mockResolvedValueOnce({
          product_catalog_bulk_update_request_id: '',
          shop_id: '',
          start_time: new Date(),
          end_time: null,
          error: null
        })
      })

      given("updateAllProductDescriptions fails", () => {
        let errMsg = "failed to update all product descriptions";

        beforeEach(() => {
          // updateAllProductDescriptions is an async function therefore if anything inside throws an error, a rejected promise is returned which allows us to use the .catch(err) handler
          // If we don't define this callback as an async function and it throws an error then the returned result is a pure exception which prevents the .catch(err) handler from running.
          updateAllProductDescriptions = async () => {
            throw new Error(errMsg)
          }

        })

        given("Update bulk request with error fails", () => {
          let errMsg = "failed to log error on bulk update request"

          beforeEach(() => {
            updateBulkRequest.mockRejectedValueOnce(new Error(errMsg))
          })

          test("Error is thrown", async () => {
            await expect(() => captionAllProducts(admin, shopId, prid, updateAllProductDescriptions)).rejects.toThrowError(errMsg)
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
            await captionAllProducts(admin, shopId, prid, updateAllProductDescriptions)
          })
        })
      })

      given("updateAllProductDescriptions succeeds", () => {
        beforeEach(() => {
          updateAllProductDescriptions = async () => { }
          updateBulkRequest.mockResolvedValueOnce({})
        })

        afterEach(() => {
          const burErr = updateBulkRequest.mock.calls[0][0].data.error
          expect(burErr).toBeFalsy()
        })

        test("Success is logged", async () => {
          await captionAllProducts(admin, shopId, prid, updateAllProductDescriptions)
        })
      })
    })
  })
})
