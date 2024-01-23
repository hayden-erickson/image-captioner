import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {AdminContext} from "@shopify/shopify-app-remix/server";
import db from "../db.server";
import {
  useFetcher,
} from '@remix-run/react'

import {
  Button,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

// TODO this isn't working when calling `useLoaderData`
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);

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
  const {session} = await authenticate.admin(request);

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
  const [loaded, setLoaded] = useState(false)
  const isLoading = fetcher.state !== "idle"
  const saveApiToken = () => {
    fetcher.submit({visionati_api_key},{method:"POST", action:"/app/settings/visionati_api_token"});
    shopify.toast.show("API Token Saved");
  }

  // If there actually is no API key, this loops forever.
  useEffect(() => {
    if ( fetcher.state === "idle" && !fetcher.data  && !loaded ) {
      fetcher.load("/app/settings/visionati_api_token")
      setLoaded(true)
    }
  }, [fetcher, loaded]);

  if(visionati_api_key === "" && fetcher?.data?.visionati_api_key) {
    setVisionatiApiKey(fetcher?.data?.visionati_api_key)
  }


  return (
    <div>
      <input disabled={isLoading} name="visionati_api_key" type="text" onChange={e => setVisionatiApiKey(e.target.value)} value={visionati_api_key}/>
      <Button loading={isLoading} onClick={saveApiToken} >Save API Token</Button>
    </div>
  )
}
