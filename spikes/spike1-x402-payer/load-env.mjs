// Load the shared spikes/.env regardless of which script's cwd we run from.
// (spikes/.env lives one directory above spike1-x402-payer.)
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");
dotenv.config({ path: envPath });
export { envPath };
