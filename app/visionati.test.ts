import db from "./db.server";
import {
  jest,
  describe,
  expect,
  beforeEach,
  afterEach,
  test
} from "@jest/globals";
import {
  visionatiClient,
  getVisionatiImageDescriptions,
} from './visionati.server'
import {
  VisionatiSettings,
  DEFAULT_ROLE,
  DEFAULT_BACKEND
} from "./visionati.types";
const given = describe;

const apiKey = crypto.randomUUID()
const settings: VisionatiSettings = {
  apiKey,
  shopId: 'my-shop.shopify.com',
  role: DEFAULT_ROLE,
  backend: DEFAULT_BACKEND,
}

let imageURLs: string[] = []


describe("visionatiClient", () => {
  let svakMock: any;
  let shopId: string;

  beforeEach(() => {
    shopId = "my_test_shop.com"
    svakMock = jest.spyOn(db.shopVisionatiSettings, 'findUnique')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  given("DB call fails", () => {
    let errMsg = 'DB connection failed';

    beforeEach(() => {
      svakMock.mockRejectedValueOnce(new Error(errMsg))
    })

    test("Error is thrown", async () => {
      await expect(() => visionatiClient(shopId)).rejects.toThrowError(errMsg)
    })
  })

  given("Shop has no visionati API key", () => {
    beforeEach(() => {
      svakMock.mockResolvedValueOnce({
        shop_id: '',
        visionati_api_key: '',
      })
    })

    test("Error is thrown", async () => {
      await expect(() => visionatiClient(shopId)).rejects.toThrowError("shop has no visionati api key")
    })
  })

  given("Shop has visionati API key", () => {
    beforeEach(() => {
      svakMock.mockResolvedValueOnce({
        shop_id: shopId,
        visionati_api_key: crypto.randomUUID(),
      })
    })

    test("Client function is returned", async () => {
      expect(() => visionatiClient(shopId)).not.toBeNull()
    })
  })

})

describe("getVisionatiImageDescriptions", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  given("Visionati API request fails", () => {
    const errMsg = 'network error'

    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error(errMsg))
    });

    test("Error is thrown", async () => {
      await expect(() => getVisionatiImageDescriptions(settings, imageURLs)).rejects.toThrowError(errMsg)
    })
  })

  given("Visionati API response is not OK", () => {
    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(Response.error())
    });

    test("Error is thrown", async () => {
      await expect(() => getVisionatiImageDescriptions(settings, imageURLs)).rejects.toThrowError('request failed')
    })
  })

  given("Invalid URLs", () => {
    let visionatiErrMsg = "Invalid URLs detected."

    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(Response.json({ error: visionatiErrMsg }))
    });

    test("Error is thrown", async () => {
      await expect(getVisionatiImageDescriptions(settings, imageURLs)).rejects.toThrowError(visionatiErrMsg)
    })
  })

  given("Success is false", () => {
    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(Response.json({ success: false }))
    });

    test("Error is thrown", async () => {
      await expect(getVisionatiImageDescriptions(settings, imageURLs)).rejects.toThrow()
    })
  })

  given("No response URL provided for batch", () => {
    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(Response.json({ success: true /* no response url */ }))
    });

    test("Error is thrown", async () => {
      await expect(getVisionatiImageDescriptions(settings, imageURLs)).rejects.toThrowError("Visionati request failed")
    })
  })

  given("Response URL provided", () => {
    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          Response.json({ success: true, response_uri: "https://api.visionati.com/api/response/267f99ce-c797-4855-807f-21b204edb7ed" }))
    });


    given("Network error", () => {
      let errMsg = "Network Error"
      beforeEach(() => {
        jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error(errMsg))
      })

      test("Error is thrown", async () => {
        await expect(getVisionatiImageDescriptions(settings, imageURLs)).rejects.toThrowError(errMsg)
      })
    })

    given("Batch request error", () => {
      beforeEach(() => {
        jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.error())
      })

      test("Error is thrown", async () => {
        await expect(getVisionatiImageDescriptions(settings, imageURLs)).rejects.toThrowError('Visionati API Request Failed')
      })

    })

    given("Batch request succeeds", () => {
      let updateCreditsMock: any;
      let credits = 100;

      beforeEach(() => {
        updateCreditsMock = jest.spyOn(db.shopVisionatiSettings, 'update')
        jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.json(visionatiResp))
      })

      const url1 = "http://someurl.com/img.png"
      const url2 = "http://anotherurl.com/cat.jpg"

      const exp = {
        [url1]: "A wonderful image",
        [url2]: "An adorable cutie fluff",
      }

      const visionatiResp = {
        credits,
        all: {
          assets: [
            {
              name: url1,
              descriptions: [{ description: exp[url1] }],
            },
            {
              name: url2,
              descriptions: [{ description: exp[url2] }],
            },
          ]
        }
      }

      afterEach(() => {
        let args = updateCreditsMock.mock.calls[0][0]
        expect(args.data.credits).toBe(credits)
        expect(args.where.shop_id).toBe(settings.shopId)
      })

      given("DB call to log credits fails", () => {
        let errMsg = "failed to log remaining visionati credits"
        beforeEach(() => {
          updateCreditsMock.mockRejectedValueOnce(new Error(errMsg))
        })

        test("Error is thrown", async () => {
          await expect(getVisionatiImageDescriptions(settings, imageURLs)).rejects.toThrowError(errMsg)
        })
      })

      given("DB call to log credits succeeds", () => {
        beforeEach(() => {
          updateCreditsMock.mockResolvedValueOnce({})
        })

        test("Descriptions are returned for each URL", async () => {
          await expect(getVisionatiImageDescriptions(settings, imageURLs)).resolves.toEqual(exp)
        })

      })
    })
  })


})

