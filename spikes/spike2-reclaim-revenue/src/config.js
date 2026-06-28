/**
 * Configuration module for the zkfetch-stellar-example project
 * Centralizes all configuration values and environment variables
 */

import * as dotenv from 'dotenv';

// Load environment variables without extra console output
dotenv.config({ quiet: true });

/**
 * Application configuration
 */
export const CONFIG = {
  // Reclaim Protocol credentials (intentionally hardcoded for demo)
  RECLAIM: {
    APP_ID: '0x381994d6B9B08C3e7CfE3A4Cd544C85101b8f201',
    APP_SECRET:
      '0xfdc676e00ac9c648dfbcc271263c2dd95233a8abd391458c91ea88526a299223',
  },

  // Stellar mainnet configuration
  STELLAR_MAINNET: {
    CONTRACT_ID: 'CD4M2KHW3ESOV3RUT7KCTC6BX37PIL2Z3BEK47IA74KIMFIFUI3JJDMO',
    SOROBAN_RPC_URL: 'https://mainnet.sorobanrpc.com',
    EXPLORER_LINK: 'https://stellar.expert/explorer/public/tx/',
    FUNCTION_NAME: 'verify_proof',
    BASE_FEE: '100',
  },

  // Mainnet details
  MAINNET_DETAILS: {
    network: 'MAINNET',
    networkUrl: 'https://horizon.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
  },

  // Stellar testnet configuration
  STELLAR_TESTNET: {
    CONTRACT_ID: 'CA3EMXR6JOOTNP44T3OAJFMMMGKRRETDJKBLZP2RU3SIY4SDFAH54DU5',
    SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
    EXPLORER_LINK: 'https://stellar.expert/explorer/testnet/tx/',
    FUNCTION_NAME: 'verify_proof',
    BASE_FEE: '100',
  },

  // Testnet details
  TESTNET_DETAILS: {
    network: 'TESTNET',
    networkUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  },

  // API endpoints
  API: {
    COINGECKO_STELLAR_PRICE:
      'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd',
    TRADING_ECONOMICS_COUNTRIES: 'https://tradingeconomics.com/',
    FORBES_BILLIONAIRES: 'https://www.forbes.com/forbesapi/person/rtb/0/-estWorthPrev/true.json?fields=rank,personName,finalWorth',
    ACCUWEATHER_NYC: 'https://www.accuweather.com/en/us/new-york/10021/weather-forecast/349727',
    GOAL_LIVE_SCORES: 'https://www.goal.com/en-in/live-scores',
  },

  // File paths
  PATHS: {
    PROOF_FILE: './src/proof.json',
  },

  // Environment variables
  ENV: {
    SEEDPHRASE: process.env.SEEDPHRASE,
  },
};

/**
 * Validates that all required environment variables are set
 * @throws {Error} If required environment variables are missing
 */
export function validateEnvironment() {
  const required = ['SEEDPHRASE'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please create a .env file with the required variables. See .env.example for reference.'
    );
  }
}

/**
 * Gets the Stellar server instance
 * @returns {Object} Stellar Horizon server instance
 */
export async function getStellarServer() {
  const { Horizon } = await import('@stellar/stellar-sdk');
  return new Horizon.Server(CONFIG.TESTNET_DETAILS.networkUrl);
}
