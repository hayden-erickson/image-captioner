import { ReactNode } from 'react'
import { createContext, useContext } from "react";
import { AppSubscription } from '@shopify/shopify-api'
import { BillingInfo, PlanKey } from '../shopify.types'

type BillingProps = {
  billing: BillingInfo;
  children: ReactNode;
}

const billingCtx = createContext<BillingInfo | undefined>(undefined)

export function useBilling() {
  return useContext(billingCtx)
}

export function BillingProvider({ billing, children }: BillingProps) {
  return (
    <billingCtx.Provider value={billing}>
      {children}
    </billingCtx.Provider>
  )
}

type SubscriptionGateProps = {
  children: ReactNode;
  hideIfNoActivePayment?: boolean;
  showFor?: PlanKey[];
}

export function SubscriptionGate({
  children,
  hideIfNoActivePayment,
  showFor,
}: SubscriptionGateProps) {
  const billingCtx = useBilling()

  if (hideIfNoActivePayment && !billingCtx?.hasActivePayment) {
    return null
  }

  if (!billingCtx?.appSubscriptions || billingCtx?.appSubscriptions?.length <= 0) {
    return null
  }

  const activeSubs = billingCtx?.appSubscriptions.map((s: AppSubscription) => s.id)

  if (showFor && !showFor?.some((k: PlanKey) => activeSubs.includes(k))) {
    return null
  }

  return children
}
