import { useState } from 'react'
import { useRoutedFetcher } from '~/fetcher';
import { LoginErrorResp } from './types';
import type { ActionFunctionArgs, LoaderFunctionArgs, TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form } from "@remix-run/react";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { login } from "../../shopify.server";

import { loginErrorMessage } from "./error.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export async function loader({ request }: LoaderFunctionArgs): Promise<TypedResponse<LoginErrorResp>> {
  const errors = loginErrorMessage(await login(request));

  return json({ errors, polarisTranslations });
};

export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<LoginErrorResp>> {
  const errors = loginErrorMessage(await login(request));

  return json({
    errors,
  });
};

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
