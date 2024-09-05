import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  TypedResponse,
} from "@remix-run/node";

import { json } from "@remix-run/node";
import db from "../db.server";

import { authenticate } from "../shopify.server";
import { useState } from "react";
import { useRoutedFetcher } from "~/fetcher";

import {
  BlockStack,
  Button,
  ButtonGroup,
  FormLayout,
  Link,
  Select,
  TextField,
} from "@shopify/polaris";

import {
  visionatiDescriptionBackends,
  VisionatiDescriptionBackend,
  VisionatiBackend,
  VisionatiRole,
  visionatiRoles,
  DEFAULT_ROLE,
  DEFAULT_BACKEND,
  VisionatiSettings
} from "../visionati.types";


export const loader = async ({ request }: LoaderFunctionArgs): Promise<TypedResponse<VisionatiSettings | null>> => {
  const { session } = await authenticate.admin(request);

  const settings = await db.shopVisionatiSettings.findUnique(
    {
      where: {
        shop_id: session.shop,
      },
    })

  return json(settings ? {
    shopId: settings.shop_id,
    role: (settings.role || '') as VisionatiRole,
    backend: (settings.backend || '') as VisionatiBackend,
    customPrompt: settings.custom_prompt || '',
  } : null)

};

// Note the "action" export name, this will handle our form POST
export const action = async ({
  request,
}: ActionFunctionArgs): Promise<TypedResponse<VisionatiSettings>> => {
  const { session } = await authenticate.admin(request);

  const {
    backend,
    role,
    customPrompt,
  } = await request.json()

  await db.shopVisionatiSettings.upsert(
    {
      where: {
        shop_id: session.shop,
      },
      update: {
        backend,
        role,
        custom_prompt: customPrompt,
      },
      create: {
        shop_id: session.shop,
        backend,
        role,
        custom_prompt: customPrompt,
      },
    })

  return json({
    shopId: session.shop,
    role,
    backend,
    customPrompt,
  })
}

type SelectBackendProps = {
  backend: VisionatiBackend;
  onBackendChange: (b: VisionatiBackend) => void;
  disabled?: boolean;
}

function SelectBackend({
  backend,
  onBackendChange,
  disabled,
}: SelectBackendProps) {
  const options = visionatiDescriptionBackends
    .map((v: VisionatiDescriptionBackend) => ({ label: v, value: v }))

  return (
    <Select
      labelInline
      label="Backend"
      options={options}
      disabled={disabled}
      onChange={onBackendChange}
      value={backend}
    />
  );
}

type SelectRoleProps = {
  role: VisionatiRole;
  onRoleChange: (r: VisionatiRole) => void;
  disabled?: boolean;
}

function SelectRole({
  role,
  onRoleChange,
  disabled,
}: SelectRoleProps) {
  const options = visionatiRoles.map(
    (r: VisionatiRole) => ({ label: r, value: r })
  )

  return (
    <Select
      labelInline
      label="Role"
      options={options}
      disabled={disabled}
      onChange={onRoleChange}
      value={role}
    />
  );

}

type CustomPromptProps = {
  prompt: string;
  onPromptChange: (p: string) => void
  disabled?: boolean;
}

function CustomPrompt({
  prompt,
  onPromptChange,
  disabled,
}: CustomPromptProps) {
  return (
    <TextField label="Custom Prompt"
      clearButton
      onClearButtonClick={() => onPromptChange('')}
      multiline
      disabled={disabled}
      value={prompt}
      onChange={onPromptChange}
      helpText="Set a custom prompt for generating product descriptions. This takes precedent over the role value above."
      autoComplete="off" />
  )
}

export default function Settings() {
  const {
    submit,
    isLoading,
    data: settings,
  } = useRoutedFetcher<VisionatiSettings>("/app/settings/visionati");

  //const [promptLoaded, setPromptLoaded] = useState(false)
  const [localPrompt, setLocalPrompt] = useState('')

  const [timeoutID, setTimeoutID] = useState(null)

  // Only do this once. If the loader comes back with an empty prompt, we don't
  // want to keep settings the local prompt to the empty one loaded from the DB
  // and loop.
  //if (!isLoading && !promptLoaded) {
  //  setLocalPrompt(settings?.customPrompt || '')
  //  setPromptLoaded(true)
  //}

  const saveSettings = (s: VisionatiSettings) => {
    console.log(s)
    submit(s, "POST");
    shopify.toast.show("Settings Saved");
  }

  const saveRole = (role: VisionatiRole) => saveSettings({
    ...settings,
    role,
  })
  const saveBackend = (backend: VisionatiBackend) => saveSettings({
    ...settings,
    backend,
  })

  const debouncedSavePrompt = (customPrompt: string) => {
    setLocalPrompt(customPrompt)

    if (timeoutID) {
      clearTimeout(timeoutID)
    }

    const tid = setTimeout(() => {
      console.log(`Saving ${customPrompt}`)
      saveSettings({
        ...settings,
        customPrompt,
      })
    }, 2000)

    setTimeoutID(tid)
  }


  return (
    <FormLayout>
      <BlockStack gap="200">
        <FormLayout.Group>
          <SelectBackend
            backend={settings?.backend || DEFAULT_BACKEND}
            onBackendChange={saveBackend}
            disabled={isLoading}
          />
          <SelectRole
            role={settings?.role || DEFAULT_ROLE}
            onRoleChange={saveRole}
            disabled={isLoading}
          />
        </FormLayout.Group>

        <CustomPrompt
          prompt={localPrompt}
          onPromptChange={debouncedSavePrompt}
          disabled={isLoading}
        />
      </BlockStack>

    </FormLayout>
  )
}
