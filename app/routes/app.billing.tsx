import { LoaderFunctionArgs, TypedResponse, json } from "@remix-run/node";
import { AppSubscription, BillingCheckResponseObject } from '@shopify/shopify-api'
import { countShopDescriptions } from "~/bulk_product_operations.server";
import { authenticate } from "~/shopify.server";
import { BillingInfo, DEFAULT_DESCRIPTION_COUNT, planDescriptionCountMap } from "~/shopify.types";
import { useBilling } from "~/billing/context";

export function getDescriptionsQuota(bcro: BillingCheckResponseObject): number {
  let descriptionsQuota = DEFAULT_DESCRIPTION_COUNT;

  console.log("===== APP SUBSCRIPTIONS =====")
  console.log(bcro.appSubscriptions)

  if (bcro.appSubscriptions.length > 0) {
    const sortedDescriptionCounts = bcro.appSubscriptions
      .map(({ name }: AppSubscription): number => planDescriptionCountMap[name] || 0)
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

export default function Billing() {
  const billing = useBilling()
  return <h1>Descriptions used: {billing?.descriptions?.usedThisMonth} / {billing?.descriptions?.monthlyQuota}</h1>
}
