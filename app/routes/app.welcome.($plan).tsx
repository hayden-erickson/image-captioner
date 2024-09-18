import { useParams } from "@remix-run/react";
import {
  BlockStack,
  Page,
  Text,
  CalloutCard,
} from '@shopify/polaris'
import { DEFAULT_PLAN, planDetailsMap } from "~/shopify.types";

export default function() {
  const { plan } = useParams()
  const { name, features } = planDetailsMap[plan || DEFAULT_PLAN]

  return <Page>
    <CalloutCard
      title="Thank you for using Visionati"
      illustration="https://i.pinimg.com/originals/67/21/de/6721debb62c7317678aa775d29be0fcf.gif"
      primaryAction={{
        url: "/app",
        content: "Beam me up Scotty",
      }}
    >
      <Text as="h1" variant="heading3xl">
        🎉 🥳
      </Text>

      {!plan ? null :
        <Text as="p" variant="bodyLg">
          Your {name} plan includes
          <ul>
            {features.map((f: string) => <li>{f}</li>)}
          </ul>
        </Text>
      }
    </CalloutCard>
  </Page>
}
