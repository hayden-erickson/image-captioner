import VisionatiSettings from './app.settings.visionati'
import ShopAutoImageDescriptions from './app.settings.shop_auto_image_descriptions'
import { boundary } from "@shopify/shopify-app-remix/server";
import { useRouteError } from "@remix-run/react";
import {
  Card,
  BlockStack,
  Page,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export default function Settings() {
  return (
    <Page>
      <TitleBar title="Settings" />
      <Card>
        <BlockStack gap="400">
          <VisionatiSettings />
          <ShopAutoImageDescriptions />
        </BlockStack>
      </Card>
    </Page>
  )
}
