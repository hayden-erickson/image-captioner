import type { Socket } from 'socket.io'
import { productsHandler } from './products.server';
import { logger } from '../shopify.server'
const fLog = logger.child({ file: './app/socket/index.ts' })

export default function socketHandler(socket: Socket) {
  // from this point you are on the WS connection with a specific client
  fLog.info({
    socketId: socket.id,
    function: 'socketHandler',
  }, "Socket client connected");

  productsHandler(socket)
}
