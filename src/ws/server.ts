import { WebSocketServer } from "ws"

const clients = new Set<any>();

export const broadcast = (message: any) => {
  const payload = typeof message === 'string' ? message : JSON.stringify(message)
  clients.forEach((client: any) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  })
}

export const startWss = (port = 6969) => {
  // avoid creating multiple servers in the same process
  // @ts-ignore - store on global to be idempotent
  if ((global as any).__wssInstance) return (global as any).__wssInstance

  const wss = new WebSocketServer({ port })
  ;(global as any).__wssInstance = wss

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send("Szevasz!");

    ws.on("message", (msg) => {
      // incoming client messages are forwarded to all clients
      broadcast(msg.toString())
    })

    ws.on("close", () => {
      console.log("Pukkadj meg kliens!");
      clients.delete(ws);
    })
  })

  return wss
}

// When run directly (npm run socket) start the server. When imported, don't auto-start.
if (require.main === module) {
  const instance = startWss(6969)
  console.log('WebSocket server started on port 6969', !!instance)
}