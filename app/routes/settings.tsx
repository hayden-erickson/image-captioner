import CaptionAllProducts from './settings.caption_all_products.($bulk_update_request_id)'
import VisionatiSettings from './settings.visionati'
import ShopAutoImageDescriptions from './settings.shop_auto_image_descriptions'
import Products from './settings.products'
import { boundary } from "@shopify/shopify-app-remix/server";
import { useRouteError } from "@remix-run/react";
import {
  Card,
  Text,
} from "@shopify/polaris";

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

//<CaptionAllProducts />

export default function Settings() {
  return (
    <>
      <Text as="h1" variant="headingLg">
        Visionati
      </Text>
      <Card>
        <VisionatiSettings />
      </Card>

      <Text as="h1" variant="headingLg">
        Settings
      </Text>
      <Card>
        <ShopAutoImageDescriptions />
      </Card>

      <Text as="h1" variant="headingLg">
        Products
      </Text>

      <Card>
        <Products />
      </Card>
    </>
  )
}
