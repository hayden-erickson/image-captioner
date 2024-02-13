import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import {
  useFetcher,
} from '@remix-run/react'

import {
  Checkbox,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);

  const shopAutoImageDescription = await db.shopAutoImageDescriptions.findUnique(
  {
    where: {
      shop_id: session.shop,
    },
  })

  return json(shopAutoImageDescription)

};

// Note the "action" export name, this will handle our form POST
export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const {session} = await authenticate.admin(request);

  if( request.method === "DELETE" ) {
    await db.shopAutoImageDescriptions.delete({
      where: {
        shop_id: session.shop,
      }
    })
    return json({})
  }

  const shopAutoImageDescriptions = await db.shopAutoImageDescriptions.upsert({
    where: {
      shop_id: session.shop,
    },
    update: {
      shop_id: session.shop,
    },
    create: {
      shop_id: session.shop,
    },
  })

  return json(shopAutoImageDescriptions)
}

export default function ShopAutoImageDescriptions() {
  const fetcher = useFetcher<typeof loader>();
  const isLoading = fetcher.state !== "idle"
  const [fetcherAlreadyLoaded, setFetcherAlreadyLoaded] = useState(false)
  const [checked, setChecked] = useState(false)

  const toggleShopAutoImageDescriptions = async (enabled: boolean) => {
    const method = enabled ? "POST" : "DELETE"
    const verb = enabled ? "Enabled" : "Disabled"

    await fetcher.submit({},{method, action:"/settings/shop_auto_image_descriptions"});
    setChecked(enabled)
    shopify.toast.show(`${verb} automatic image descriptions`);
  }

  useEffect(() => {
    if ( isLoading ) {
      return
    }

    // we're not loading
    if ( fetcher.data ) {
      setChecked(fetcher?.data?.shop_id)
      return
    }

    // there is no fetcher data
    if ( fetcherAlreadyLoaded ) {
      return
    }

    // the fetcher has not yet loaded
    const loadData = async () => {
      await fetcher.load("/settings/shop_auto_image_descriptions")
      // If automatic image descriptions are disabled we set loaded to true so
      // that this effect doesn't loop forever.
      setFetcherAlreadyLoaded(true)
    }

    loadData()
  }, [fetcher, isLoading, fetcherAlreadyLoaded]);

  return (
      <Checkbox label="Automatic Image Descriptions"
        disabled={isLoading}
        checked={checked}
        onChange={toggleShopAutoImageDescriptions} />
  )
}
