import { WebSocketServer } from "ws"

const wss = new WebSocketServer({ port: 8081 });
const clients = new Set<any>();

export const broadcast = (message: any) => {
   const payload = typeof message === 'string' ? message : JSON.stringify(message)
   clients.forEach((client: any) => {
      if (client.readyState === client.OPEN) {
         client.send(payload);
      }
   })
}

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

 const broadcast =(message:any)=>{
   clients.forEach((client:any)=>{
      if(client.readyState === client.OPEN){
         client.send(message);
      }
   });
   };
   
}); 