import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import {
  useFetcher,
} from '@remix-run/react'

import {
  BlockStack,
  Checkbox,
  Text,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shopAutoImageDescription = await db.shopAutoImageDescriptions.findUnique(
    {
      where: {
        shop_id: session.shop,
      },
    })

  return json(shopAutoImageDescription)

};

type WebhookSubscription = {
  id: string;
  endpoint: {
    pubSubTopic?: string
  }
}

async function deleteWebhookSubscriptionsIfExist(admin: any) {
  const response = await admin.graphql(
    `#graphql
      query {
        webhookSubscriptions(first:10){
          nodes {
            id
            endpoint{
              ... on WebhookPubSubEndpoint {
                pubSubTopic
              }
            }
          }
        }
      }`
  )

  let {
    data: {
      webhookSubscriptions: {
        nodes
      }
    }
  } = await response.json()

  // There are no webhook subscriptions.
  if (!nodes.length) {
    return
  }

  const pubSubWebhookIds = nodes
    .filter((n: WebhookSubscription) => n.endpoint.pubSubTopic)
    .map((n: WebhookSubscription) => n.id)

  // There are no google pubsub webhooks to delete.
  if (!pubSubWebhookIds.length) {
    return
  }


  await Promise.all(pubSubWebhookIds.map((id: string) =>
    admin.graphql(`#graphql
      mutation deleteWebhookSubscription($id: ID!) {
        webhookSubscriptionDelete(id: $id) {
          deletedWebhookSubscriptionId
        }
      }`,
      {
        variables: { id },
      },
    )
  ))
}

// "image-captioner-408123"
// "shopify-webhooks"
async function createWebhookSubscriptions(admin: any, topic: string) {
  const pubSubProject = process.env.GOOGLE_PROJECT
  const pubSubTopic = process.env.GOOGLE_PUBSUB_TOPIC

  await admin.graphql(
    `#graphql
    mutation createPubSubSubscription($topic: WebhookSubscriptionTopic!, $pubSubProject: String!, $pubSubTopic: String!) {
      pubSubWebhookSubscriptionCreate(
        topic: $topic, webhookSubscription: {
          pubSubProject: $pubSubProject,
          pubSubTopic: $pubSubTopic
        }
      ) {
        userErrors {
          field
          message
        }
      }
    }
  `,
    {
      variables: {
        topic,
        pubSubProject,
        pubSubTopic,
      }
    });
}

// Note the "action" export name, this will handle our form POST
export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (request.method === "DELETE") {
    await deleteWebhookSubscriptionsIfExist(admin)

    await db.shopAutoImageDescriptions.delete({
      where: {
        shop_id: session.shop,
      }
    })
    return json({})
  }

  await createWebhookSubscriptions(admin, "PRODUCTS_CREATE")

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

  const toggleShopAutoImageDescriptions = (enabled: boolean) => {
    const method = enabled ? "POST" : "DELETE"
    const verb = enabled ? "Enabled" : "Disabled"

    fetcher.submit({}, { method, action: "/settings/shop_auto_image_descriptions" });
    setChecked(enabled)
    shopify.toast.show(`${verb} automatic image descriptions`);
  }

  useEffect(() => {
    if (isLoading) {
      return
    }

    // we're not loading
    if (fetcher.data) {
      setChecked(!!fetcher?.data?.shop_id)
      return
    }

    // there is no fetcher data
    if (fetcherAlreadyLoaded) {
      return
    }

    // the fetcher has not yet loaded
    const loadData = () => {
      fetcher.load("/settings/shop_auto_image_descriptions")
      // If automatic image descriptions are disabled we set loaded to true so
      // that this effect doesn't loop forever.
      setFetcherAlreadyLoaded(true)
    }

    loadData()
  }, [fetcher, isLoading, fetcherAlreadyLoaded]);

  return (
    <BlockStack gap='200'>
      <Checkbox label="Generate Automatic Image Descriptions"
        disabled={isLoading}
        checked={checked}
        onChange={toggleShopAutoImageDescriptions} />
      <Text as='p' tone='subdued'>
        Use Visionati to automatically generate image descriptions when new products are created.
      </Text>
    </BlockStack>
  )
}
