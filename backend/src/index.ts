// Backend entrypoint — boots the underwriting-engine API.
import { buildServer } from "./api/server.js";
import { config } from "./config.js";

const app = await buildServer();
await app.listen({ port: config.port, host: config.host });
