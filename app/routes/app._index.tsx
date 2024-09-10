import {
  Page,
  Card,
  BlockStack,
  Text,
  Layout,
} from "@shopify/polaris";

import Settings from './app.settings'
import Products from './app.products'


export default function Index() {
  return (
    <Page fullWidth>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Text variant="headingLg" as="h2">
              Products
            </Text>
            <Card>
              <Products />
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Text variant="headingLg" as="h2">
              Settings
            </Text>
            <Card>
              <Settings />
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
