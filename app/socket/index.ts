import type { Socket } from 'socket.io'
import { productsHandler } from './products.server';

export default function socketHandler(socket: Socket) {
  // from this point you are on the WS connection with a specific client
  console.log(socket.id, "connected");

  productsHandler(socket)
}
