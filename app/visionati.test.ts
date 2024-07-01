import { jest, describe, expect, beforeEach, afterEach, test } from "@jest/globals";
import { getVisionatiImageDescriptions } from "./visionati";
const given = describe;

const apiKey = crypto.randomUUID()
let imageURLs: string[] = []


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
      await expect(() => getVisionatiImageDescriptions(apiKey, imageURLs)).rejects.toThrowError(errMsg)
    })
  })

  given("Visionati API response is not OK", () => {
    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(Response.error())
    });

    test("Error is thrown", async () => {
      await expect(() => getVisionatiImageDescriptions(apiKey, imageURLs)).rejects.toThrowError('request failed')
    })
  })

  given("Invalid URLs", () => {
    let visionatiErrMsg = "Invalid URLs detected."

    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(Response.json({ error: visionatiErrMsg }))
    });

    test("Error is thrown", async () => {
      await expect(getVisionatiImageDescriptions(apiKey, imageURLs)).rejects.toThrowError(visionatiErrMsg)
    })
  })

  given("Success is false", () => {
    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(Response.json({ success: false }))
    });

    test("Error is thrown", async () => {
      await expect(getVisionatiImageDescriptions(apiKey, imageURLs)).rejects.toThrow()
    })
  })

  given("No response URL provided for batch", () => {
    beforeEach(() => {
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(Response.json({ success: true /* no response url */ }))
    });

    test("Error is thrown", async () => {
      await expect(getVisionatiImageDescriptions(apiKey, imageURLs)).rejects.toThrowError("Visionati request failed")
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
        await expect(getVisionatiImageDescriptions(apiKey, imageURLs)).rejects.toThrowError(errMsg)
      })
    })

    given("Batch request error", () => {
      beforeEach(() => {
        jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.error())
      })

      test("Error is thrown", async () => {
        await expect(getVisionatiImageDescriptions(apiKey, imageURLs)).rejects.toThrowError('Visionati API Request Failed')
      })

    })

    given("Batch request succeeds", () => {
      const url1 = "http://someurl.com/img.png"
      const url2 = "http://anotherurl.com/cat.jpg"

      const exp = {
        [url1]: "A wonderful image",
        [url2]: "An adorable cutie fluff",
      }

      const visionatiResp = {
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

      beforeEach(() => {
        jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.json(visionatiResp))
      })

      test("Descriptions are returned for each URL", async () => {
        await expect(getVisionatiImageDescriptions(apiKey, imageURLs)).resolves.toEqual(exp)
      })

    })
  })


})

