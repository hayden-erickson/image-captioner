import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  TypedResponse,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

import { authenticate } from "../shopify.server";
import { OptionalShopId } from "../shopify.types"
import {
  BlockStack,
  Checkbox,
  Text,
} from "@shopify/polaris";
import { useRoutedFetcher } from "~/fetcher";


export async function loader({ request }: LoaderFunctionArgs):
  Promise<TypedResponse<OptionalShopId | null>> {
  const { session } = await authenticate.admin(request);

  const enabled = await db.shopAutoImageDescriptions.findUnique(
    {
      where: {
        shop_id: session.shop,
      },
    })

  return json(enabled ? {
    shopId: enabled.shop_id,
  } : null)

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
export async function action({ request, }: ActionFunctionArgs):
  Promise<TypedResponse<OptionalShopId | null>> {
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

  const enabled = await db.shopAutoImageDescriptions.upsert({
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

  return json(enabled ? {
    shopId: enabled.shop_id,
  } : null)
}
export default function ShopAutoImageDescriptions() {
  const {
    data,
    isLoading,
    submit,
  } = useRoutedFetcher<OptionalShopId | null>("/app/settings/shop_auto_image_descriptions");

  const checked = isLoading ? false : Boolean(data?.shopId)

  const toggleShopAutoImageDescriptions = (enabled: boolean) => {
    const method = enabled ? "POST" : "DELETE"
    const verb = enabled ? "Enabled" : "Disabled"

    submit({}, method);
    shopify.toast.show(`${verb} automatic image descriptions`);
  }

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
