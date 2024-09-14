import VisionatiSettings from './app.settings.visionati'
import ShopAutoImageDescriptions from './app.settings.shop_auto_image_descriptions'
import RemainingDescriptions from './app.billing'
import { boundary } from "@shopify/shopify-app-remix/server";
import { useRouteError } from "@remix-run/react";
import { BlockStack } from '@shopify/polaris';

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export default function Settings() {
  return (
    <BlockStack gap="400">
      <RemainingDescriptions />
      <VisionatiSettings />
      <ShopAutoImageDescriptions />
    </BlockStack>
  )
}
