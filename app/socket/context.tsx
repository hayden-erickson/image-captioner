import { ReactNode, useEffect, useState } from "react";
import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";
import { Banner } from '@shopify/polaris'

type ProviderProps = {
  socket: Socket | undefined;
  shopId: string;
  children: ReactNode;
};

type ShopifySocket = {
  socket?: Socket;
  shopId?: string;
}

const socketCtx = createContext<ShopifySocket | undefined>(undefined);

export function useSocket() {
  return useContext(socketCtx);
}

export function SocketProvider({ socket, shopId, children }: ProviderProps) {
  const [error, setError] = useState(null)

  socket?.on("error", setError)

  useEffect(console.error, [error])

  return (
    <socketCtx.Provider value={{ socket, shopId }}>
      {
        !error ? null :
          <Banner
            title="There was an error. Try again soon."
            tone="warning"
            onDismiss={() => setError(null)}
          />
      }
      {children}
    </socketCtx.Provider>
  );
}

