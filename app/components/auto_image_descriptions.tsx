import {
  BlockStack,
  Checkbox,
  Text,
} from "@shopify/polaris";
import { OptionalShopId } from "../shopify.types";
import { useRoutedFetcher } from "~/fetcher";

export default function ShopAutoImageDescriptions() {
  const {
    data,
    isLoading,
    submit,
  } = useRoutedFetcher<OptionalShopId | null>("/settings/shop_auto_image_descriptions");

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
