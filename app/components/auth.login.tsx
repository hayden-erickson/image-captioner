import { useState } from "react";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { Form } from "@remix-run/react";
import { LoginErrorResp } from '../routes/auth.login/types'
import { useRoutedFetcher } from "~/fetcher";

export default function Auth() {
  const { data, isLoading } = useRoutedFetcher<LoginErrorResp>("/auth/login")
  const [shop, setShop] = useState("");
  const { errors } = isLoading ? { errors: null } : data;

  return (
    <PolarisAppProvider i18n={data?.polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="example.myshopify.com"
                value={shop}
                onChange={setShop}
                autoComplete="on"
                error={errors?.shop}
              />
              <Button submit>Log in</Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </PolarisAppProvider>
  );
}
