// Stellar Wallets Kit + Freighter setup.
//
// Phase 3: instantiate StellarWalletsKit (Freighter module), expose
// connect/disconnect + the connected public key, and build/sign Soroban
// transactions for the borrower/lender flows.
//
// Phase 0 scaffold: no implementation yet (keeps uninstalled wallet deps out of
// the build until Phase 3).

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";
