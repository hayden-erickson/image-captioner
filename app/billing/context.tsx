import { ReactNode } from 'react'
import { createContext, useContext } from "react";
import { BillingInfo } from '../shopify.types'

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
