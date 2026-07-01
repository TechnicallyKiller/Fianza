// Smoke test: drive the deployed testnet contracts through the SDK (reads only).
import fs from "node:fs";
import { TrustLineAgent } from "../packages/agent-sdk/dist/index.js";

const k = JSON.parse(fs.readFileSync("/tmp/_phase4b_keys.json", "utf8"));

const tl = new TrustLineAgent(k.agent, {
  apiBaseUrl: "http://localhost:8787",
  contracts: {
    registry: "CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX",
    creditLine: "CA2HOO3KKDPQB4URKDJGVP4QD57UTCSKA2XN7U76RAN4VATOKXZV4QSV",
    vault: "CD5RQFFYF57MLI3JI2PHUROMYFWLGDB7RPMGIK5JRWAO6NWHEUE3EC6C",
  },
});

console.log("agent:", tl.publicKey());
console.log("creditLine:", await tl.creditLine());
console.log("availableCreditUsdc:", await tl.availableCreditUsdc());
console.log("vaultState:", await tl.vaultState());
