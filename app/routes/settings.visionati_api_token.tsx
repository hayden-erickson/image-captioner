import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import {
  useFetcher,
} from '@remix-run/react'

import {
  FormLayout,
  TextField,
  Button,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

// TODO this isn't working when calling `useLoaderData`
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shopVisionatiApiKey = await db.shopVisionatiApiKeys.findUnique(
    {
      where: {
        shop_id: session.shop,
      },
    })

  return json(shopVisionatiApiKey)

};

// Note the "action" export name, this will handle our form POST
export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const data = await request.formData()
  const apiKey: string = String(data.get("visionati_api_key"))
  const shopVisionatiApiKey = await db.shopVisionatiApiKeys.upsert(
    {
      where: {
        shop_id: session.shop,
      },
      update: {
        visionati_api_key: apiKey,
      },
      create: {
        shop_id: session.shop,
        visionati_api_key: apiKey,
      },
    })

  return json(shopVisionatiApiKey)
}

export default function VisionatiApiToken() {
  const fetcher = useFetcher<typeof loader>();
  const [visionati_api_key, setVisionatiApiKey] = useState("")
  const [fetcherAlreadyLoaded, setFetcherAlreadyLoaded] = useState(false)
  const isLoading = fetcher.state !== "idle"

  const saveApiToken = async () => {
    await fetcher.submit({ visionati_api_key }, { method: "POST", action: "/settings/visionati_api_token" });
    shopify.toast.show("API Token Saved");
  }

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (fetcher.data) {
      return
    }

    if (fetcherAlreadyLoaded) {
      return
    }

    const loadData = async () => {
      await fetcher.load("/settings/visionati_api_token")
      // If there is no visionati api key we set loaded to true so that this
      // effect doesn't loop forever.
      setFetcherAlreadyLoaded(true)
    }

    loadData()
  }, [fetcher, isLoading, fetcherAlreadyLoaded]);

  if (visionati_api_key === "" && fetcher?.data?.visionati_api_key) {
    setVisionatiApiKey(fetcher?.data?.visionati_api_key)
  }

  return (
    <FormLayout>
      <TextField label="API Key"
        disabled={isLoading}
        value={visionati_api_key}
        onChange={k => setVisionatiApiKey(k)}
        autoComplete="off" />


      <Button variant="primary"
        loading={isLoading}
        onClick={saveApiToken} >
        Save
      </Button>

    </FormLayout>
  )
}
