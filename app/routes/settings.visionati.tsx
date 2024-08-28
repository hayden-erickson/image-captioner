import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useFetcher,
} from '@remix-run/react'

import {
  Banner,
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


type SetTouchedStateFn = (state: any) => void

export default function Settings() {
  const fetcher = useFetcher<typeof loader>();
  const [apiKey, setVisionatiApiKey] = useState("")
  const [role, setRole] = useState(DEFAULT_ROLE)
  const [backend, setBackend] = useState(DEFAULT_BACKEND)
  const [prompt, setPrompt] = useState('')
  const [fetcherAlreadyLoaded, setFetcherAlreadyLoaded] = useState(false)
  const [settingsTouched, setSettingsTouched] = useState(false)
  const [showCredits, setShowCredits] = useState(true)
  const isLoading = fetcher.state !== "idle"
  const credits = fetcher?.data?.credits

  const withTouched = (fn: SetTouchedStateFn): SetTouchedStateFn => {
    return function(state: any): void {
      fn(state)
      setSettingsTouched(true)
    }
  }

  const setVisionatiApiKeyTouched = withTouched(setVisionatiApiKey)
  const setRoleTouched = withTouched(setRole)
  const setBackendTouched = withTouched(setBackend)
  const setPromptTouched = withTouched(setPrompt)

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

    setSettingsTouched(false)
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
      {
        apiKey ? null :
          <Banner tone="warning">
            <p>
              Visit your {" "}
              <Link
                target="_blank"
                url="https://api.visionati.com" >
                Visionati profile page
              </Link> {" "}
              to get your API key.
              Without this key we can not generate image descriptions.
            </p>
          </Banner>
      }
      {
        !credits ? null :
          !showCredits ? null :
            <Banner onDismiss={() => setShowCredits(false)} >
              Remaining Credits: {credits.toString()}
            </Banner>
      }

      <TextField label="API Key"
        disabled={isLoading}
        value={apiKey}
        clearButton
        onClearButtonClick={() => setVisionatiApiKeyTouched('')}
        onChange={k => setVisionatiApiKeyTouched(k)}
        autoComplete="off" />

      <AdvancedSettings
        backend={backend}
        onBackendChange={setBackendTouched}
        role={role}
        onRoleChange={setRoleTouched}
        prompt={prompt}
        onPromptChange={setPromptTouched}
      />

      <ButtonGroup>
        {
          !settingsTouched ? null :
            <Button variant="primary"
              loading={isLoading}
              onClick={saveSettings} >
              Save Settings
            </Button>
        }

        <Link url="https://api.visionati.com/payment?product=starter" target="_blank">
          Buy credits
        </Link>

      </ButtonGroup>

    </FormLayout>
  )
}
