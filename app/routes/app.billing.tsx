import { LoaderFunctionArgs, ActionFunctionArgs, TypedResponse, json } from "@remix-run/node";
import { AppSubscription, BillingCheckResponseObject } from '@shopify/shopify-api'
import {
  Banner,
  Text,
} from '@shopify/polaris';
import { countShopDescriptions } from "~/bulk_product_operations.server";

import {
  authenticate,
} from "~/shopify.server";

import {
  BillingInfo,
  DEFAULT_DESCRIPTION_COUNT,
  FREE_PLAN,
  planDetailsMap,
  SubscriptionPlanDetails,
} from "~/shopify.types";

import { useBilling } from "~/billing/context";

export function getDescriptionsQuota(bcro: BillingCheckResponseObject): number {
  let descriptionsQuota = DEFAULT_DESCRIPTION_COUNT;

  if (bcro.appSubscriptions.length > 0) {
    const sortedDescriptionCounts = bcro.appSubscriptions
      .map(({ id }: AppSubscription): number => planDetailsMap[id].descriptionCount || 0)
      .sort((a: number, b: number) => b - a)

    descriptionsQuota = sortedDescriptionCounts[0]
  }

  return descriptionsQuota
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<TypedResponse<BillingInfo>> => {
  const { session, billing } = await authenticate.admin(request);
  const shopId = session.shop

  const billingInfo = await billing.check()
  const monthlyQuota = getDescriptionsQuota(billingInfo)
  const usedThisMonth = await countShopDescriptions({ shopId, thisMonth: true })
  const totalUsed = await countShopDescriptions({ shopId })

  return json({
    ...billingInfo,
    descriptions: {
      usedThisMonth,
      totalUsed,
      monthlyQuota,
    }
  })
};

function highestActivePlan(billing: BillingCheckResponseObject | undefined): SubscriptionPlanDetails {
  if (!billing?.appSubscriptions || billing?.appSubscriptions.length <= 0) {
    return planDetailsMap[FREE_PLAN]
  }

  const planDetails = billing.appSubscriptions.map((s: AppSubscription) => planDetailsMap[s.id])
  const plansByPrice = planDetails.sort((a, b: SubscriptionPlanDetails) => b.price - a.price)
  return plansByPrice[0]
}

export default function RemainingDescriptions() {
  const billing = useBilling()
  return <>
    <Text as="h1" variant="headingSm">
      Plan: {highestActivePlan(billing).name}
    </Text>
    <Banner>
      Descriptions used{" "}
      {billing?.descriptions?.usedThisMonth} / {billing?.descriptions?.monthlyQuota}
    </Banner>
  </>
}
