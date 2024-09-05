import { jest, describe, expect, beforeEach, afterEach, test } from "@jest/globals";
import { productCreateHandler } from "./pubsub.server";
import * as v from "./visionati.server";
import type { Message } from "@google-cloud/pubsub";
import db from "./db.server";
import { Product } from "./shopify.types";
import * as shopify from './shopify.server'
const given = describe;


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
        vSpy = jest.spyOn(v, 'visionatiClient')
      })

      given("Visionati client creation fails", () => {
        let errMsg = "failed to create visionati client"
        beforeEach(() => {
          vSpy.mockRejectedValueOnce(new Error(errMsg))
        })

        test("Error is thrown", async () => {
          await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
        })
      })

      given("Shop has Visionati settings", () => {
        let visionati: any;
        let client: any;
        let getProductMock: any;

        beforeEach(() => {
          client = jest.spyOn(shopify, 'shopifyClient')
          getProductMock = jest.spyOn(shopify, 'getProduct')
        })

        afterEach(() => {
          expect(client.mock.calls[0][0]).toBe(shopDomain)
          expect(client.mock.calls[0][1]).toBe(accessToken)
        })

        given("Get shopify product API call fails", () => {
          let errMsg = "failed to get shopify product"

          beforeEach(() => {
            getProductMock.mockRejectedValueOnce(new Error(errMsg))
          })

          test("Error is thrown", async () => {
            await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
          })
        })

        given("Returned product has no image URL", () => {
          let product: Product;

          beforeEach(() => {
            getProductMock.mockResolvedValueOnce(Response.json({ data: { product } }))
            visionati = jest.fn()
            vSpy.mockResolvedValueOnce(visionati as v.GetImageDescriptionsFn)
          })

          afterEach(() => {
            expect(visionati.mock.calls).toHaveLength(0)
          })

          test("Function terminates", async () => {
            await productCreateHandler(msg)
          })

        })

        given("Returned product has image URL", () => {
          let product: Product;
          let url: string;

          beforeEach(() => {
            url = "some.com/img.png"
            product = {
              id: crypto.randomUUID(),
              title: "Slime Ball of Doom",
              description: "slime ball baby!",
              featuredImage: { url }
            }
            getProductMock.mockResolvedValueOnce(product)
          })

          given("Visionati API call fails", () => {
            let errMsg = "visionati API call failed"

            beforeEach(() => {
              visionati.mockRejectedValue(new Error(errMsg))
              vSpy.mockResolvedValueOnce(visionati as v.GetImageDescriptionsFn)
            })

            test("Error is thrown", async () => {
              await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
            })

          })

          given("Visionati API call succeeds", () => {
            let newDesc = "some new description that's very very shiny!"
            let updateProductMock: any;
            beforeEach(() => {
              updateProductMock = jest.spyOn(shopify, 'updateProduct')
            })

            given("Visionati returns no descriptions", () => {
              beforeEach(() => {
                visionati.mockResolvedValueOnce(undefined)
                vSpy.mockResolvedValueOnce(visionati as v.GetImageDescriptionsFn)
              })

              afterEach(() => {
                expect(visionati.mock.calls[0][0]).toEqual([url])
              })

              test("Function terminates", async () => {
                await productCreateHandler(msg)
              })
            })

            given("Update product API call fails", () => {
              let errMsg = "Failed to update product description"
              beforeEach(() => {
                visionati.mockResolvedValueOnce({ [url]: newDesc })
                vSpy.mockResolvedValueOnce(visionati as v.GetImageDescriptionsFn)
                updateProductMock.mockRejectedValueOnce(new Error(errMsg))
              })

              test("Error is thrown", async () => {
                await expect(() => productCreateHandler(msg)).rejects.toThrowError(errMsg)
              })
            })

            given("Update product API call succeeds", () => {
              let webhook: any;
              beforeEach(() => {
                visionati.mockResolvedValueOnce({ [url]: newDesc })
                vSpy.mockResolvedValueOnce(visionati as v.GetImageDescriptionsFn)
                updateProductMock.mockResolvedValueOnce(Response.json({}))
                webhook = jest.spyOn(db.shopWebhookRequests, 'create')
              })

              afterEach(() => {
                const receivedId = updateProductMock.mock.calls[0][1]
                const receivedDesc = updateProductMock.mock.calls[0][2]
                expect(receivedId).toEqual(product.id)
                expect(receivedDesc).toEqual(newDesc)
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
