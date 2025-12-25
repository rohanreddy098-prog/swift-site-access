import { createServer } from "node:http";
import { routeRequest } from "wisp-server-node";

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    return;
  }
  
  res.writeHead(404);
  res.end("Not Found");
});

server.on("upgrade", (req, socket, head) => {
  routeRequest(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`Wisp server running on port ${PORT}`);
});
