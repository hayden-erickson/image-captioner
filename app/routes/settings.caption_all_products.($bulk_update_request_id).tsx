import { useState, useEffect } from 'react'
import type { LoaderFunctionArgs, ActionFunctionArgs, TypedResponse } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import db from "../db.server";
import {
  useFetcher,
} from '@remix-run/react'
import {
  Button,
  FormLayout,
  Text,
} from "@shopify/polaris";

import {
  bulkProductUpdate,
  logAllProductDescriptionUpdates,
} from "../bulk_product_operations"


export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request)

  if (!params['bulk_update_request_id']) {
    const br = await db.shopProductCatalogBulkUpdateRequests.findFirst({
      where: { shop_id: session.shop },
      orderBy: {
        start_time: 'desc'
      }
    })

    const bru = await db.shopBulkUpdateRequestsDescriptionUpdates.findMany({
      where: { product_catalog_bulk_update_request_id: br?.product_catalog_bulk_update_request_id }
    })

    return json({
      productCatalogBulkUpdateRequestId: br?.product_catalog_bulk_update_request_id,
      productDescriptionUpdateCount: bru.length,
      ...br
    })
  }

  const br = await db.shopProductCatalogBulkUpdateRequests.findUnique({
    where: { product_catalog_bulk_update_request_id: params['bulk_update_request_id'] }
  })

  const bru = await db.shopBulkUpdateRequestsDescriptionUpdates.findMany({
    where: { product_catalog_bulk_update_request_id: params['bulk_update_request_id'] }
  })

  return json({
    productCatalogBulkUpdateRequestId: br?.product_catalog_bulk_update_request_id,
    productDescriptionUpdateCount: bru.length,
    ...br
  })
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request)
  const productCatalogBulkUpdateRequestId = crypto.randomUUID()
  await bulkProductUpdate(
    productCatalogBulkUpdateRequestId,
    session.shop,
    logAllProductDescriptionUpdates(admin, session.shop),
  )

  return json({ productCatalogBulkUpdateRequestId });
}


const POLL_INT = 200
const getPollTime = () => Math.floor(Date.now() / POLL_INT)

export default function CaptionAllProducts() {
  const fetcher = useFetcher<typeof loader>();
  const loading = fetcher.state !== "idle"
  const [sec, setSec] = useState(getPollTime())
  const bulkReqInProgress = fetcher?.data?.productCatalogBulkUpdateRequestId && !fetcher?.data?.end_time
  const productDescriptionUpdateCount = fetcher?.data?.productDescriptionUpdateCount

  const captionAllProducts = async () => {
    fetcher.submit({}, { method: "POST", action: "/settings/caption_all_products" })
    shopify.toast.show('Updating all product descriptions')
  }

  useEffect(() => {
    if (loading) {
      return
    }

    if (!bulkReqInProgress) {
      return
    }

    // only poll every second
    if (getPollTime() === sec) {
      return
    }

    console.log('polling for product description update count')
    fetcher.load(`/settings/caption_all_products`)
    setSec(getPollTime())
  }, [fetcher, loading, bulkReqInProgress, sec])

  useEffect(() => {
    if (!bulkReqInProgress) {
      return
    }

    if (!productDescriptionUpdateCount) {
      return
    }

    const descriptions = productDescriptionUpdateCount > 1 ? 'descriptions' : 'description'
    shopify.toast.show(`${productDescriptionUpdateCount} product ${descriptions} updated`)
  }, [bulkReqInProgress, productDescriptionUpdateCount])

  return (
    <FormLayout>
      <Text as="h2" variant="headingLg">
        Update All Product Descriptions
      </Text>

      <Text as="p" variant="bodyLg">
        Create AI descriptions using visionati for all the products in your catalog.
      </Text>

      <Text tone="caution" as="p" variant="bodySm">
        NOTE: This will use your visionati API credits.
        The more products you have in your catalog the more credits will be consumed.
      </Text>

      <Button variant="primary" loading={!!bulkReqInProgress} onClick={captionAllProducts}>
        Start
      </Button>
    </FormLayout>
  )
}
