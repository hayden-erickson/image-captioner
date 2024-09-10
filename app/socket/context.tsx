import { ReactNode, useState } from "react";
import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

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
  socket?.on("error", console.log)

  return (
    <socketCtx.Provider value={{ socket, shopId }}>
      {children}
    </socketCtx.Provider>
  );
}

