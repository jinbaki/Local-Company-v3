import express from "express";
import { createServer } from "vite";
import { loadConfig } from "./config.js";
import { createApiRouter } from "./api.js";
import { createDatabaseContext } from "./storage/db.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const context = createDatabaseContext(config);
  const app = express();

  app.use(express.json({ limit: "20mb" }));
  app.use("/api", createApiRouter(context));

  if (process.env.NODE_ENV === "production") {
    app.use(express.static("dist/client"));
  } else {
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }

  app.listen(config.port, config.host, () => {
    console.log(`Local Company V3 listening on http://${config.host}:${config.port}`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
