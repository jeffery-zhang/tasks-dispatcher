import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseWorkspaceRoot(argv) {
  const flagIndex = argv.indexOf("--workspace-root");
  const workspaceRoot = flagIndex === -1 ? undefined : argv[flagIndex + 1];

  if (!workspaceRoot) {
    throw new Error("Missing required --workspace-root argument.");
  }

  return workspaceRoot;
}

const workspaceRoot = parseWorkspaceRoot(process.argv.slice(2));
const runtimeRoot = resolve(workspaceRoot, ".tasks-dispatcher", "runtime");

mkdirSync(runtimeRoot, { recursive: true });

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "workspace-runtime-ready" }));
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "not-found" }));
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind runtime fixture server.");
  }

  writeFileSync(
    resolve(runtimeRoot, "runtime.json"),
    JSON.stringify({
      pid: process.pid,
      port: address.port,
      workspaceRoot
    }),
    "utf8"
  );
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
