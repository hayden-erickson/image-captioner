import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useFetcher,
} from '@remix-run/react'

import {
  BlockStack,
  Button,
  ButtonGroup,
  Collapsible,
  FormLayout,
  Link,
  Select,
  TextField,
} from "@shopify/polaris";

import {
  SettingsIcon,
  SettingsFilledIcon,
} from '@shopify/polaris-icons';

import db from "../db.server";

import { authenticate } from "../shopify.server";
import { VisionatiBackend, VisionatiRole, DEFAULT_ROLE, DEFAULT_BACKEND } from "../visionati";

// TODO this isn't working when calling `useLoaderData`
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shopVisionatiSettings = await db.shopVisionatiSettings.findUnique(
    {
      where: {
        shop_id: session.shop,
      },
    })

  console.log(shopVisionatiSettings)

  return json(shopVisionatiSettings)

};

// Note the "action" export name, this will handle our form POST
export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const {
    apiKey,
    backend,
    role,
    customPrompt,
  } = await request.json()

  const shopVisionatiSettings = await db.shopVisionatiSettings.upsert(
    {
      where: {
        shop_id: session.shop,
      },
      update: {
        api_key: apiKey,
        backend,
        role,
        custom_prompt: customPrompt,
      },
      create: {
        shop_id: session.shop,
        api_key: apiKey,
        backend,
        role,
        custom_prompt: customPrompt,
      },
    })

  return json(shopVisionatiSettings)
}

type SelectBackendProps = {
  backend: VisionatiBackend;
  onBackendChange: (b: VisionatiBackend) => void;
}

function SelectBackend({
  backend,
  onBackendChange,
}: SelectBackendProps) {
  const options = [
    { label: "Clarifai", value: "clarifai" },
    { label: "Imagga", value: "imagga" },
    { label: "Google Vision", value: "googlevision" },
    { label: "Rekognition", value: "rekognition" },
    { label: "Llava", value: "llava" },
    { label: "Bakllava", value: "bakllava" },
    { label: "Jinaai", value: "jinaai" },
    { label: "Gemini", value: "gemini" },
    { label: "OpenAI", value: "openai" },
  ];

  return (
    <Select
      labelInline
      label="Backend"
      options={options}
      onChange={onBackendChange}
      value={backend}
    />
  );
}

type SelectRoleProps = {
  role: VisionatiRole;
  onRoleChange: (r: VisionatiRole) => void;
}

function SelectRole({
  role,
  onRoleChange,
}: SelectRoleProps) {
  const options = [
    { label: "Artist", value: "artist" },
    { label: "Caption", value: "caption" },
    { label: "Comedian", value: "comedian" },
    { label: "Critic", value: "critic" },
    { label: "General", value: "general" },
    { label: "Ecommerce", value: "ecommerce" },
    { label: "Inspector", value: "inspector" },
    { label: "Promoter", value: "promoter" },
    { label: "Prompt", value: "prompt" },
    { label: "Realtor", value: "realtor" },
    { label: "Tweet", value: "tweet" },
  ];

  return (
    <Select
      labelInline
      label="Role"
      options={options}
      onChange={onRoleChange}
      value={role}
    />
  );

}

type CustomPromptProps = {
  prompt: string;
  onPromptChange: (p: string) => void
}

function CustomPrompt({
  prompt,
  onPromptChange,
}: CustomPromptProps) {
  return (
    <TextField label="Custom Prompt"
      clearButton
      onClearButtonClick={() => onPromptChange('')}
      multiline
      value={prompt}
      onChange={onPromptChange}
      helpText="Set a custom prompt for generating product descriptions. This takes precedent over the role value above."
      autoComplete="off" />
  )
}

type AdvancedSettingsProps = CustomPromptProps & SelectBackendProps & SelectRoleProps

function AdvancedSettings(props: AdvancedSettingsProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = () => setOpen(!open)

  return (
    <BlockStack gap="200">
      <ButtonGroup >
        <Button
          variant="tertiary"
          icon={open ? SettingsFilledIcon : SettingsIcon}
          fullWidth={false}
          onClick={handleToggle}>
          Advanced Settings
        </Button>
      </ButtonGroup>

      <Collapsible
        open={open}
        id="basic-collapsible"
        transition={{ duration: '500ms', timingFunction: 'ease-in-out' }}
        expandOnPrint
      >
        <BlockStack gap="200">
          <FormLayout.Group>
            <SelectBackend
              backend={props.backend}
              onBackendChange={props.onBackendChange}
            />
            <SelectRole
              role={props.role}
              onRoleChange={props.onRoleChange}
            />
          </FormLayout.Group>

          <CustomPrompt
            prompt={props.prompt}
            onPromptChange={props.onPromptChange}
          />
        </BlockStack>
      </Collapsible >
    </BlockStack>
  )
}

export default function Settings() {
  const fetcher = useFetcher<typeof loader>();
  const [apiKey, setVisionatiApiKey] = useState("")
  const [role, setRole] = useState(DEFAULT_ROLE)
  const [backend, setBackend] = useState(DEFAULT_BACKEND)
  const [prompt, setPrompt] = useState('')
  const [fetcherAlreadyLoaded, setFetcherAlreadyLoaded] = useState(false)
  const isLoading = fetcher.state !== "idle"

  const saveSettings = () => {
    const data = {
      apiKey,
      backend,
      role,
      customPrompt: prompt,
    }

    console.log(data)

    fetcher.submit(data, {
      method: "POST",
      action: "/settings/visionati",
      encType: "application/json",
    });
    shopify.toast.show("Settings Saved");
  }

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (fetcher.data) {
      setVisionatiApiKey(fetcher.data?.api_key)
      setRole(fetcher.data?.role as VisionatiRole)
      setBackend(fetcher.data?.backend as VisionatiBackend)
      setPrompt(fetcher.data?.custom_prompt || '')
      return
    }

    if (fetcherAlreadyLoaded) {
      return
    }

    const loadData = () => {
      fetcher.load("/settings/visionati")
      // If there is no visionati api key we set loaded to true so that this
      // effect doesn't loop forever.
      setFetcherAlreadyLoaded(true)
    }

    loadData()
  }, [fetcher, isLoading, fetcherAlreadyLoaded]);

  return (
    <FormLayout>
      <TextField label="API Key"
        disabled={isLoading}
        value={apiKey}
        onChange={k => setVisionatiApiKey(k)}
        helpText={<p>
          Visit your {" "}
          <Link
            target="_blank"
            url="https://api.visionati.com/login" >
            Visionati profile page
          </Link> {" "}
          to get your API key.
          Without this key we can not generate image descriptions.
        </p>}
        autoComplete="off" />

      <AdvancedSettings
        backend={backend}
        onBackendChange={setBackend}
        role={role}
        onRoleChange={setRole}
        prompt={prompt}
        onPromptChange={setPrompt}
      />

      <Button variant="primary"
        loading={isLoading}
        onClick={saveSettings} >
        Save
      </Button>

    </FormLayout>
  )
}
