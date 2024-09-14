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
  FormLayout,
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
import { SubscriptionGate } from "~/billing/context";
import { PREMIUM_PLAN, STANDARD_PLAN } from "~/shopify.types";


export const loader = async ({ request }: LoaderFunctionArgs):
  Promise<TypedResponse<Omit<VisionatiSettings, 'apiKey'> | null>> => {
  const { session } = await authenticate.admin(request);

  const settings = await db.shopVisionatiSettings.findUnique(
    {
      where: {
        shop_id: session.shop,
      },
    })

  console.log(settings?.custom_prompt)

  return json(settings ? {
    shopId: settings.shop_id,
    role: (settings.role || '') as VisionatiRole,
    backend: (settings.backend || '') as VisionatiBackend,
    customPrompt: settings.custom_prompt || '',
  } : null)

};

// Note the "action" export name, this will handle our form POST
export const action = async ({ request, }: ActionFunctionArgs):
  Promise<TypedResponse<Omit<VisionatiSettings, 'apiKey'>>> => {
  const { session } = await authenticate.admin(request);

  const {
    backend,
    role,
    customPrompt,
  } = await request.json()

  console.log(customPrompt)

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
    <SubscriptionGate showFor={[STANDARD_PLAN, PREMIUM_PLAN]}>
      <Select
        label="AI Model"
        options={options}
        disabled={disabled}
        onChange={onBackendChange}
        value={backend}
      />
    </SubscriptionGate>
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
    <SubscriptionGate showFor={[STANDARD_PLAN, PREMIUM_PLAN]}>
      <Select
        label="Role"
        options={options}
        disabled={disabled}
        onChange={onRoleChange}
        value={role}
      />
    </SubscriptionGate>
  );

}

type CustomPromptProps = {
  prompt: string;
  onPromptChange: (p: string) => void
  disabled?: boolean;
}

const customPromptHelpText = `
Set a custom prompt for generating product descriptions.
This takes precedent over the role value above.
This prompt is combined with the product image to generate a description.`

function CustomPrompt({
  prompt,
  onPromptChange,
  disabled,
}: CustomPromptProps) {
  return (
    <SubscriptionGate showFor={[PREMIUM_PLAN]}>
      <TextField label="Custom Prompt"
        clearButton
        onClearButtonClick={() => onPromptChange('')}
        multiline
        disabled={disabled}
        value={prompt}
        onChange={onPromptChange}
        helpText={customPromptHelpText}
        autoComplete="off" />
    </SubscriptionGate>
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
  const [promptTouched, setPromptTouched] = useState(false)

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
    setPromptTouched(true)

    if (timeoutID) {
      clearTimeout(timeoutID)
    }

    const tid = setTimeout(() => saveSettings({
      ...settings,
      customPrompt,
    }), 2000)

    setTimeoutID(tid)
  }


  return (
    <FormLayout>
      <BlockStack gap="200">
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

        <CustomPrompt
          prompt={promptTouched ? localPrompt : settings?.customPrompt || ''}
          onPromptChange={debouncedSavePrompt}
          disabled={isLoading}
        />
      </BlockStack>

    </FormLayout>
  )
}
