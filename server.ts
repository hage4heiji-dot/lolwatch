import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import { attachGameServer } from "./src/server/gameServer";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;

const httpServer = createServer();
const app = next({ dev, httpServer });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  httpServer.on("request", (req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/game-ws" });
  attachGameServer(wss);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? "development" : "production"})`);
  });
});
