import { jest, describe, expect, beforeEach, test } from "@jest/globals";
import { updateShopifyProductDescritions, ShopifyProduct } from "./caption_all_products"
import { getResponsiveProps } from "@shopify/polaris/build/ts/src/utilities/css";
import { URLDescriptionIdx } from "./visionati";
const given = describe;

describe("updateShopifyProductDescritions", () => {
  let admin: { graphql: ReturnType<typeof jest.fn> };
  let nodes: ShopifyProduct[];
  let imageURLs: string[];
  let descriptions: URLDescriptionIdx;
  let productCatalogBulkUpdateRequestId: string;
  let shopId: string;

  beforeEach(() => {
    admin = {
      graphql: jest.fn(),
    }
  })

  given("No image URLs", () => {
    test("Nothing runs", async () => {
      await updateShopifyProductDescritions(
        {
          admin,
          imageURLs,
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
    beforeEach(() => {
      imageURLs = ["one.img/stuff.png"]
    })

    given("Invalid URLs", () => {
      test("exception is thrown", async () => {
        await expect(() => updateShopifyProductDescritions(
          {
            admin,
            imageURLs,
            nodes,
            descriptions,
            productCatalogBulkUpdateRequestId,
            shopId,
          }
        )).rejects.toThrowError("Invalid URL")
      })
    })

    given("", () => {
    })
  })

})
