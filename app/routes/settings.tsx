import CaptionAllProducts from './settings.caption_all_products.($bulk_update_request_id)'
import VisionatiApiToken from './settings.visionati_api_token'
import { boundary } from "@shopify/shopify-app-remix/server";
import { useRouteError } from "@remix-run/react";
import {
  Card,
  BlockStack,
  Text,
} from "@shopify/polaris";

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export default function Settings() {
  return (
    <Card>
      <BlockStack gap='400'>
        <Text as="h1" variant="headingLg">
          Settings
        </Text>
        <VisionatiApiToken />
        <CaptionAllProducts />
      </BlockStack>
    </Card>
  )
}
