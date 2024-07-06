import { jest, describe, expect, beforeEach, afterEach, test } from "@jest/globals";
import { ShopifyClient, productCreateHandler } from "./pubsub";
import * as v from "./visionati";
import type { Message } from "@google-cloud/pubsub";
import db from "./db.server";
import { ShopifyProduct } from "./caption_all_products";
import exp from "constants";
const given = describe;


describe("ShopifyClient", () => {
  let fSpy: any;
  let client: ShopifyClient;
  let shopDomain = "myshop.shopify.com"
  let accessToken = crypto.randomUUID()

  beforeEach(() => {
    client = new ShopifyClient(shopDomain, accessToken)
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
        await expect(() => client.graphql("query", "vars")).rejects.toThrowError(errMsg)
      })

    })

    given("API call succeeds", () => {
      const exp = { some: "cool object" }

      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json(exp))
      })

      test("it works", async () => {
        const resp = await client.graphql("query", "vars")
        expect(resp.ok).toBeTruthy()
        const received = await resp.json()
        expect(received).toEqual(exp)
      })
    })
  })

  describe("getProduct", () => {
    let productId = crypto.randomUUID()

    afterEach(() => {
      const receivedBody = JSON.parse(fSpy.mock.calls[0][1].body)
      expect(receivedBody).toHaveProperty('variables', { productId })
    })

    given("API call fails", () => {
      let errMsg = "failed to call shopify API"
      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error(errMsg))
      })

      test("Error is thrown", async () => {
        await expect(() => client.getProduct(productId)).rejects.toThrowError(errMsg)
      })

    })

    given("Response is not ok", () => {
      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.error())
      })

      test("Error is thrown", async () => {
        await expect(() => client.getProduct(productId)).rejects.toThrow()
      })
    })

    given("Response json is invalid", () => {
      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.json({ some: 'invalid product type' }))
      })

      test("Error is thrown", async () => {
        await expect(() => client.getProduct(productId)).rejects.toThrow()
      })
    })

    given("Response is valid", () => {
      let product = {
        id: crypto.randomUUID(),
        description: "product description",
        featuredImage: {
          url: "some.com/img.png"
        }
      }

      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.json({ data: { product } }))
      })

      test("Product is returned", async () => {
        const received = await client.getProduct(productId)
        expect(received).toEqual(product)
      })
    })

  })


  describe("updateProduct", () => {
    let id = crypto.randomUUID();
    let descriptionHtml = "a new fancy description!";

    given("API call fails", () => {
      let errMsg = "failed to call shopify API"
      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error(errMsg))
      })

      test("Error is thrown", async () => {
        await expect(() => client.updateProduct({ id, descriptionHtml })).rejects.toThrowError(errMsg)
      })

    })

    given("Response is not ok", () => {
      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.error())
      })

      test("Error is thrown", async () => {
        await expect(() => client.updateProduct({ id, descriptionHtml })).rejects.toThrow()
      })
    })

    given("Response is valid", () => {
      beforeEach(() => {
        fSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.json({}))
      })

      afterEach(() => {
        const received = JSON.parse(fSpy.mock.calls[0][1].body)
        expect(received).toHaveProperty('variables.input', { id, descriptionHtml })
      })

      test("Product is returned", async () => {
        await client.updateProduct({ id, descriptionHtml })
      })
    })

  })
})

describe("productCreateHandler", () => {
  let msg: Message;
  let swr: any;

  beforeEach(() => {
    msg = {} as Message;
    swr = jest.spyOn(db.shopWebhookRequests, 'findUnique')
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  given("Invalid message JSON", () => {
    beforeEach(() => {
      msg.data = Buffer.from("definitely not JSON")
    })

    test("Error is thrown", async () => {
      await expect(() => productCreateHandler(msg)).rejects.toThrowError("not valid JSON")
    })
  })

  given("given no admin graphql ID", () => {
    beforeEach(() => {
      msg.data = Buffer.from('{"noAdmin": "graphql ID"}')
    })

    afterEach(() => {
      expect(swr.mock.calls).toHaveLength(0)
    })

    test("Function terminates", () => productCreateHandler(msg))

  })

  given("DB call fails", () => {
    let errMsg = "DB call failed"

    beforeEach(() => {
      msg.data = Buffer.from(`{"admin_graphql_api_id": "${crypto.randomUUID()}"}`)
      swr.mockRejectedValue(new Error(errMsg))
    })

    test("Error is thrown", async () => {
      await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
    })
  })

  given("Webhook request already exists", () => {
    let webhook_request_id = crypto.randomUUID()

    beforeEach(() => {
      msg = {
        data: Buffer.from(JSON.stringify({
          admin_graphql_api_id: crypto.randomUUID(),
        })),
        id: webhook_request_id,
      } as Message

      swr.mockResolvedValue({ webhook_request_id })
    })

    afterEach(() => {
      expect(swr.mock.calls).toHaveLength(1)
    })

    test("Function terminates", () => productCreateHandler(msg))
  })

  given("Webhook request does not exist", () => {
    let session: any;
    let webhook_request_id = crypto.randomUUID();
    let shopDomain = "myshop.shopify.com"

    beforeEach(() => {
      msg.data = Buffer.from(JSON.stringify({
        admin_graphql_api_id: crypto.randomUUID(),
      }))
      msg.id = webhook_request_id
      msg.attributes = {
        'X-Shopify-Shop-Domain': shopDomain,
      }

      // webhook request has not been seen yet so start handling
      swr.mockResolvedValue(undefined)
      session = jest.spyOn(db.session, 'findFirst')
    })

    given("Get session DB call fails", () => {
      let errMsg = "failed to get session from DB"
      beforeEach(() => {
        session.mockRejectedValue(new Error(errMsg))
      })

      test("Error is thrown", async () => {
        await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
      })

    })

    given("Shop has no existing session", () => {
      beforeEach(() => {
        session.mockResolvedValue(undefined)
      })

      test("Error is thrown", async () => {
        await expect(() => productCreateHandler(msg)).rejects.toThrowError(
          `has no session. Therefore, we cannot make requests to the shopify API`)

      })
    })

    given("Shop has existing session", () => {
      let accessToken = crypto.randomUUID();
      let vSpy: any;

      beforeEach(() => {
        session.mockResolvedValue({ accessToken })
        vSpy = jest.spyOn(db.shopVisionatiApiKeys, 'findUnique')
      })

      given("Visionati access token DB call fails", () => {
        let errMsg = "DB call to get Visionati access token failed"
        beforeEach(() => {
          vSpy.mockRejectedValue(new Error(errMsg))
        })

        test("Error is thrown", async () => {
          await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
        })
      })

      given("Shop has no Visionati API token", () => {
        beforeEach(() => {
          vSpy.mockResolvedValue(undefined)
        })

        test("Error is thrown", async () => {
          await expect(() => productCreateHandler(msg)).rejects.toThrowError("has no visionati api key")
        })
      })

      given("Shop has Visionati API token", () => {
        let visionati_api_key = crypto.randomUUID()
        let fetch: any;
        let visionati: any;

        beforeEach(() => {
          vSpy.mockResolvedValue({ visionati_api_key })
          visionati = jest.spyOn(v, 'getVisionatiImageDescriptions')
          fetch = jest.spyOn(global, 'fetch')
        })

        given("Get shopify product API call fails", () => {
          let errMsg = "failed to get shopify product"

          beforeEach(() => {
            fetch.mockRejectedValueOnce(new Error(errMsg))
          })

          test("Error is thrown", async () => {
            await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
          })
        })

        given("Returned product has no image URL", () => {
          let product: ShopifyProduct;

          beforeEach(() => {
            fetch.mockResolvedValueOnce(Response.json({ data: { product } }))
          })

          afterEach(() => {
            expect(visionati.mock.calls).toHaveLength(0)
          })

          test("Function terminates", async () => {
            await productCreateHandler(msg)
          })

        })

        given("Returned product has image URL", () => {
          let product: ShopifyProduct;
          let url: string;

          beforeEach(() => {
            url = "some.com/img.png"
            product = {
              id: crypto.randomUUID(),
              title: "Slime Ball of Doom",
              description: "slime ball baby!",
              featuredImage: { url }
            }
            fetch.mockResolvedValueOnce(Response.json({ data: { product } }))
          })

          given("Visionati API call fails", () => {
            let errMsg = "visionati API call failed"

            beforeEach(() => {
              visionati.mockRejectedValue(new Error(errMsg))
            })

            test("Error is thrown", async () => {
              await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
            })

          })

          given("Visionati API call succeeds", () => {
            let newDesc = "some new description that's very very shiny!"

            given("Visionati returns no descriptions", () => {
              beforeEach(() => {
                visionati.mockResolvedValueOnce(undefined)
              })

              afterEach(() => {
                expect(visionati.mock.calls[0][0]).toBe(visionati_api_key)
                expect(visionati.mock.calls[0][1]).toEqual([url])
                expect(fetch.mock.calls).toHaveLength(1)
              })

              test("Function terminates", async () => {
                await productCreateHandler(msg)
              })
            })

            given("Update product API call fails", () => {
              let errMsg = "Failed to update product description"
              beforeEach(() => {
                visionati.mockResolvedValueOnce({ [url]: newDesc })
                fetch.mockRejectedValueOnce(new Error(errMsg))
              })

              test("Error is thrown", async () => {
                await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
              })
            })

            given("Update product API call succeeds", () => {
              let webhook: any;
              beforeEach(() => {
                visionati.mockResolvedValueOnce({ [url]: newDesc })
                fetch.mockResolvedValueOnce(Response.json({}))
                webhook = jest.spyOn(db.shopWebhookRequests, 'create')
              })

              afterEach(() => {
                const body = JSON.parse(fetch.mock.calls[1][1].body)
                const received = body.variables.input
                expect(received).toEqual({ id: product.id, descriptionHtml: newDesc })
              })

              given("Webhook DB create call fails", () => {
                let errMsg = "failed to create webhook request row in DB"

                beforeEach(() => {
                  webhook.mockRejectedValueOnce(new Error(errMsg))
                })

                test("Error is thrown", async () => {
                  await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
                })

              })

              given("Webhook DB create call succeeds", () => {
                let descriptionUpdate: any;

                beforeEach(() => {
                  webhook.mockResolvedValueOnce()
                  descriptionUpdate = jest.spyOn(db.shopProductDescriptionUpdates, 'create')
                })

                afterEach(() => {
                  const received = webhook.mock.calls[0][0].data.webhook_request_id
                  expect(received).toEqual(msg.id)
                })

                given("Description Update DB create fails", () => {
                  let errMsg = "failed to create description update in DB"
                  beforeEach(() => {
                    descriptionUpdate.mockRejectedValueOnce(new Error(errMsg))
                  })

                  test("Error is thrown", async () => {
                    await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
                  })
                })

                given("Description Update DB create succeeds", () => {
                  let joinRow: any;

                  beforeEach(() => {
                    descriptionUpdate.mockResolvedValueOnce()
                    joinRow = jest.spyOn(db.shopWebhookRequestsDescriptionUpdates, 'create')
                  })

                  afterEach(() => {
                    const data = descriptionUpdate.mock.calls[0][0].data
                    expect(data).toHaveProperty('shop_id', shopDomain)
                    expect(data).toHaveProperty('product_id', product.id)
                    expect(data).toHaveProperty('new_description', newDesc)
                    expect(data).toHaveProperty('old_description', product.description)
                  })

                  given("Join row create fails", () => {
                    let errMsg = "failed to create description update join row in DB"
                    beforeEach(() => {
                      joinRow.mockRejectedValueOnce(new Error(errMsg))
                    })

                    test("Error is thrown", async () => {
                      await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
                    })
                  })

                  given("Join row create succeeds", () => {
                    beforeEach(() => {
                      joinRow.mockResolvedValueOnce()
                    })

                    afterEach(() => {
                      const received = joinRow.mock.calls[0][0].data.webhook_request_id
                      expect(received).toEqual(msg.id)
                    })

                    test("Function terminates", async () => {
                      await productCreateHandler(msg)
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
