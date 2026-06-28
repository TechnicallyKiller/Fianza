# zkFetch Stellar Example

A comprehensive demonstration of zero-knowledge proof generation and verification using the Reclaim Protocol integrated with the Stellar blockchain. This project showcases how to fetch data from various sources with cryptographic proofs and verify them on-chain using Soroban smart contracts.

## Supported Data Sources

This project supports **five different data sources** for generating zero-knowledge proofs:

### 1. **Stellar Price Data** (CoinGecko)
- **Source**: CoinGecko API
- **Data**: Real-time Stellar (XLM) cryptocurrency price in USD
- **Use Case**: Cryptocurrency price verification and trading applications

### 2. **Economic Data** (Trading Economics)
- **Source**: Trading Economics website
- **Data**: Countries GDP data and economic indicators
- **Use Case**: Economic analysis and financial reporting

### 3. **Billionaires Data** (Forbes)
- **Source**: Forbes Real-Time Billionaires API
- **Data**: Live billionaire rankings, names, and net worth
- **Use Case**: Wealth tracking and financial analytics

### 4. **Weather Data** (AccuWeather)
- **Source**: AccuWeather NYC weather page
- **Data**: Current temperature and city information for New York
- **Use Case**: Weather verification and climate applications

### 5. **Sports Data** (Goal.com)
- **Source**: Goal.com live scores page
- **Data**: Live football match scores and team information
- **Use Case**: Sports betting verification and match tracking

Check [Other Data Sources](#other-data-sources) for more endpoints.

## Features

- **Zero-Knowledge Proof Generation**: Generate cryptographic proofs for external API data
- **Stellar Blockchain Integration**: Verify proofs on Stellar testnet using Soroban contracts
- **Multi-Source Data Support**: Five different data sources with unique extraction patterns
- **Comprehensive Testing**: Full test suite with utility function validation
- **Modern Development Setup**: ESLint, Prettier, and automated testing
- **CLI Interface**: Easy-to-use command-line interface for all operations

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn package manager
- Stellar testnet account with XLM for transaction fees
- Basic understanding of blockchain and zero-knowledge proofs

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/zkfetch-stellar-example.git
   cd zkfetch-stellar-example
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Download required ZK files**
   ```bash
   npm run download-zk-files
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env file with your Stellar seedphrase
   ```

5. **Run setup script (optional)**
   ```bash
   npm run setup
   ```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Stellar Wallet Configuration
SEEDPHRASE=your twelve word seedphrase goes here for stellar wallet generation

# Optional: Override default network settings
# NETWORK_URL=https://horizon-testnet.stellar.org
# SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
# CONTRACT_ID=CA3EMXR6JOOTNP44T3OAJFMMMGKRRETDJKBLZP2RU3SIY4SDFAH54DU5

# For Mainnet:
# CONTRACT_ID=CD4M2KHW3ESOV3RUT7KCTC6BX37PIL2Z3BEK47IA74KIMFIFUI3JJDMO
```

### Application Configuration

The application uses a centralized configuration system in `src/config.js`:

- **Reclaim Protocol**: APP_ID and APP_SECRET for proof generation
- **Stellar Network**: Testnet configuration and contract details
- **API Endpoints**: CoinGecko API for price data
- **File Paths**: Default locations for proof files

## Usage

### Command Line Interface

```bash
# Generate a new Stellar price proof
npm run request-proof

# Generate a new Trading Economics countries GDP proof
npm run request-trading-economics

# Generate a new Forbes billionaires proof
npm run request-forbes

# Generate a new AccuWeather NYC proof
npm run request-accuweather

# Generate a new Goal.com live scores proof
npm run request-goal

# Verify existing proof on blockchain
npm run verify-proof

# Run complete workflow (request + verify)
npm start workflow

# Display application information
npm start info
```

### Programmatic Usage

```javascript
import { ZkFetchStellarApp } from './src/index.js';

const app = new ZkFetchStellarApp();

// Request a new Stellar price proof
const stellarProof = await app.requestStellarPriceProof();

// Request a new Trading Economics countries GDP proof
const tradingEconomicsProof = await app.requestTradingEconomicsProof();

// Request a new Forbes billionaires proof
const forbesProof = await app.requestForbesProof();

// Request a new AccuWeather NYC proof
const accuWeatherProof = await app.requestAccuWeatherProof();

// Request a new Goal.com live scores proof
const goalProof = await app.requestGoalProof();

// Verify proof on blockchain
const txHash = await app.verifyProofOnStellar();

// Run complete workflow
const result = await app.runCompleteWorkflow();
```

### Individual Module Usage

```javascript
import { requestProof } from './src/requestProof.js';
import { verifyProof } from './src/verifyProof.js';

// Request Stellar price proof with custom output path
const stellarProof = await requestProof('./stellar-proof.json', 'stellar');

// Request Trading Economics proof with custom output path
const tradingEconomicsProof = await requestProof('./trading-economics-proof.json', 'trading-economics');

// Request Forbes proof with custom output path
const forbesProof = await requestProof('./forbes-proof.json', 'forbes');

// Request AccuWeather proof with custom output path
const accuWeatherProof = await requestProof('./accuweather-proof.json', 'accuweather');

// Request Goal.com proof with custom output path
const goalProof = await requestProof('./goal-proof.json', 'goal');

// Verify proof with custom file path
const txHash = await verifyProof('./custom-proof.json');
```

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Categories

- **Proof Structure Validation**: Validates proof format and required fields
- **Signature Verification**: Ensures cryptographic signatures are valid
- **Utility Function Tests**: Tests all helper functions with edge cases
- **Configuration Tests**: Validates application configuration

## Project Structure

```
zkfetch-stellar-example/
├── src/
│   ├── config.js          # Centralized configuration
│   ├── index.js           # Main application entry point
│   ├── requestProof.js     # Proof generation module
│   ├── verifyProof.js      # Blockchain verification module
│   ├── utils.js           # Utility functions
│   └── proof.json         # Generated proof file
├── tests/
│   └── proof.test.js      # Comprehensive test suite
├── scripts/
│   └── setup.js           # Setup automation script
├── .env.example           # Environment variables template
├── .eslintrc.json         # ESLint configuration
├── .prettierrc            # Prettier configuration
├── .gitignore             # Git ignore rules
└── package.json           # Project dependencies and scripts
```

## Development

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Available Scripts

- `npm start` - Run main application
- `npm run request-proof` - Generate new proof
- `npm run verify-proof` - Verify existing proof
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code
- `npm run setup` - Run setup script

## Network Configuration

### Stellar Mainnet

- **Network**: Mainnet
- **Horizon URL**: https://horizon.stellar.org
- **Soroban RPC**: https://soroban.stellar.org
- **Contract ID**: CD4M2KHW3ESOV3RUT7KCTC6BX37PIL2Z3BEK47IA74KIMFIFUI3JJDMO
- **Explorer**: https://stellar.expert/explorer/public/

### Stellar Testnet

- **Network**: Testnet
- **Horizon URL**: https://horizon-testnet.stellar.org
- **Soroban RPC**: https://soroban-testnet.stellar.org
- **Contract ID**: CA3EMXR6JOOTNP44T3OAJFMMMGKRRETDJKBLZP2RU3SIY4SDFAH54DU5
- **Explorer**: https://stellar.expert/explorer/testnet/

### API Endpoints

- **CoinGecko Stellar Price**: https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd
- **Trading Economics Countries**: https://tradingeconomics.com/
- **Forbes Billionaires**: https://www.forbes.com/forbesapi/person/rtb/0/-estWorthPrev/true.json?fields=rank,personName,finalWorth
- **AccuWeather NYC**: https://www.accuweather.com/en/us/new-york/10021/weather-forecast/349727
- **Goal.com Live Scores**: https://www.goal.com/en-in/live-scores

## How It Works

### 1. Proof Generation

The application uses the Reclaim Protocol to generate zero-knowledge proofs for multiple data sources:

1. **API Request**: Fetches data from the selected source (CoinGecko, Trading Economics, Forbes, AccuWeather, or Goal.com)
2. **Data Extraction**: Uses specialized regex patterns to extract relevant information from each source
3. **Proof Generation**: Creates cryptographic proof of the extracted data
4. **File Storage**: Saves proof to JSON file

### 2. Proof Verification

The verification process submits proofs to the Stellar blockchain:

1. **Proof Loading**: Reads and validates proof file
2. **Data Preparation**: Formats proof data for blockchain submission
3. **Transaction Creation**: Builds Stellar transaction with Soroban contract call
4. **Blockchain Submission**: Signs and submits transaction to testnet

### 3. Smart Contract Integration

The application interacts with a Soroban smart contract that:
- Verifies cryptographic signatures
- Validates proof structure
- Stores verification results on-chain

## Other Data Sources


| Name | Endpoint | Regex | extractedParameterValues Example | Use Case (Data Fetched) |
|:-----------|:-----------------|:--------------|:--------------|:--------------|
| Coinmarketcap | https://coinmarketcap.com/ | `<div class="circulating-supply-value">\\s*<span>(?<cap>[0-9]+(?:\\.[0-9]+)?[A-Za-z]?)</span>\\s*<!-- -->BTC` | `{ cap: '19.96M' }` | Bitcoin's Circulating Supply |
| Yahoo Finance | https://finance.yahoo.com/markets/stocks/most-active/ | `<fin-streamer data-test="change" data-symbol="NVDA" data-field="marketCap" data-trend="none" data-value="4261212044021.6064" active="">(?<marketCap>[0-9]+(?:\\.[0-9]+)?[A-Za-z]?)</fin-streamer>` | `{ marketCap: '4.261T' }` | Most Active Stock's Market Cap |
| Github |  https://github.com/torvalds/linux | `<span[^>]*class="[^"]*js-social-count[^"]*"[^>]*>\s*(?<stars>[0-9]+(?:\.[0-9]+)?[kKmM]?)\s*</span>` | `{ stars: '211k' }` | Repository Stars |
| Internet Live Stats | https://www.internetlivestats.com/total-number-of-websites/ | `<td class="val">(?<websites>[0-9,]+)</td>` | `{ websites: '1,630,322,579' }` | Total Number of Registered Websites |
| Flightware | https://www.flightaware.com/resources/airport/KJFK/weather | `<td class="alignleft weatherTemperature" style="width: 79px" >(?<temparature>.*?)</td>` | `{ temparature: '21' }` | Airports Weather |
| Social Counts | https://socialcounts.org/youtube-live-subscriber-count/UCX6OQ3DkcsbYNE6H8uQQuVA | `<<div class=\"tracking-tight text-gray-900 dark:text-white text-xl\">(?<count>.*?)</div>` | `{ count: '103,488,793,716' }` | Youtubers Subscription Counts |
| Planet OSM | https://planet.openstreetmap.org/statistics/data_stats.html | `<tr>\s*<td>[^<]+</td>\s*<td>(?<users>[0-9]+)</td>` | `{ users: '10045083' }` | OpenStreetMap User Count |
| Rotten Tomatoes | https://www.rottentomatoes.com/browse/tv_series_browse/sort:popular | `<span class="p--small" data-qa="discovery-media-list-item-title">\s*(?<show>[^\s].*?[^\s])\s*</span>` | `{ show: 'Pluribus' }` | Rotten Tomatoes Top Show |
| IP API | https://ipapi.co/json/ | `\"ip\"\\s*:\\s*\"(?<ip>[0-9.]+)\"` | ` { ip: '14.244.194.106' }` |  User IP |
| Solana | https://status.solana.com/ | `<h2[^>]*class="status[^"]*"[^>]*>\s*(?<status>[^<]+?)\s*</h2>` | `{ status: 'All Systems Operational' }` | Solana Systems Operational Status |
| Speedtest | https://www.speedtest.net/global-index | `<span class="number">(?<mobileSpeed>[0-9.]+)</span>` | `{ mobileSpeed: '179.55' }` | SpeedTest Mobile Speed Metrics |
| ARXIV | https://arxiv.org/abs/2305.17989| `<meta[^>]*property="og:title"[^>]*content="(?<title>[^"]+)"` | `{title: 'On the Minimal Knowledge Required for Solving Stellar Consensus'` | Research Papers Titles |
| NPM Registry | https://www.npmjs.com/package/@stellar/stellar-sdk | `<p class="f2874b88 fw6 mb3 mt2 truncate black-80 f4">(?<version>[0-9.]+)</p>` | `{ version: '14.4.2' }` | Stellar JS SDK Version |
| Unix Timestamp | https://www.unixtimestamp.com/| `<div[^>]*class="value epoch"[^>]*>\\s*(?<timestamp>[0-9]+)\\s*</div>` | `{ timestamp: '1765773231' }` | Unix Timestamps - Seconds |
| Wikipedia | https://en.wikipedia.org/wiki/Special:Statistics | `<td[^>]*class="mw-statistics-numbers"[^>]*>\s*(?<count>[0-9,]+)\s*</td>` | `{ count: '7,105,949' }` | Content Pages Count |
| Worldometers | https://www.worldometers.info/geography/countries-of-the-world/ | `<td[^>]*data-order="\\d+"[^>]*>\\s*(?<population>[0-9,]+)\\s*</td>` | `{ population: '1,463,865,525' }` | Top Country Population |
| Random Number API | https://www.randomnumberapi.com/api/v1.0/random?min=1&max=100&count=1 | `\\[(?<data>\\d+)\\]` | `{ data: '34' }` | RNG Results |
| Github API | https://api.github.com/rate_limit | `\"rate\"\\s*:\\s*\\{[\\s\\S]*?\"limit\"\\s*:\\s*(?<limit>\\d+),[\\s\\S]*?\"remaining\"\\s*:\\s*(?<remaining>\\d+),[\\s\\S]*?\"reset\"\\s*:\\s*(?<reset>\\d+),[\\s\\S]*?\"used\"\\s*:\\s*(?<used>\\d+),[\\s\\S]*?\"resource\"\\s*:\\s*\"(?<resource>[^\"]+)\"` | `{limit: '60', remaining: '60',reset: '1765806768',resource: 'core',used: '0'}` | Github API Rate Limit Control - Requests per Hour |
| USGS Earthquake | https://earthquake.usgs.gov/fdsnws/event/1/count?format=geojson | `\"count\"\\s*:\\s*(?<count>\\d+)` | `{ count: '9077' }` | Number of Earthquake Events |
| OpenDota | https://api.opendota.com/api/proPlayers | `\"steamid\"\\s*:\\s*\"(?<steamId>\\d+)\"[\\s\\S]*?\"personaname\"\\s*:\\s*\"(?<name>[^\"]+)\"[\\s\\S]*?\"loccountrycode\"\\s*:\\s*\"(?<country>[A-Z]{2})\"` | `{ country: 'US', name: 'Newsham', steamId: '76561197961562353' }` | Dota Top Player Information |
| Postman Echo | https://postman-echo.com/get | `\"user-agent\"\\s*:\\s*\"(?<userAgent>[^\"]+)\"` | `{ userAgent: 'reclaim/0.0.1' }` | Request Sender User Agent |
| Crossref | https://api.crossref.org/works/10.1038/nature12373 | `\"reference-count\"\\s*:\\s*(?<referenceCount>\\d+)` | `{ referenceCount: '30' }` | Research Papers Crossed Reference Counts |

## Troubleshooting

### Common Issues

1. **Missing .env file**
   ```bash
   cp .env.example .env
   # Edit with your seedphrase
   ```

2. **Insufficient XLM balance**
   - Ensure your Stellar testnet account has XLM for transaction fees
   - Get testnet XLM from Stellar Friendbot

3. **ZK files not downloaded**
   ```bash
   npm run download-zk-files
   ```

4. **Network connection issues**
   - Check internet connection
   - Verify Stellar testnet is accessible

### Error Messages

- `Missing required environment variables`: Check your .env file
- `Proof file not found`: Run `npm run request-proof` first
- `Failed to create Stellar wallet`: Verify your seedphrase format
- `Transaction failed`: Check account balance and network status

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Reclaim Protocol](https://reclaimprotocol.org/) for zero-knowledge proof infrastructure
- [Stellar Development Foundation](https://stellar.org/) for blockchain platform
- [CoinGecko](https://coingecko.com/) for cryptocurrency price data
- [Trading Economics](https://tradingeconomics.com/) for economic data
- [Forbes](https://forbes.com/) for billionaires data
- [AccuWeather](https://accuweather.com/) for weather data
- [Goal.com](https://goal.com/) for sports data
- [Soroban](https://soroban.stellar.org/) for smart contract platform

## Additional Resources

- [Reclaim Protocol Documentation](https://docs.reclaimprotocol.org/)
- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Zero-Knowledge Proofs](https://en.wikipedia.org/wiki/Zero-knowledge_proof)

## Links

- **Repository**: https://github.com/your-username/zkfetch-stellar-example
- **Issues**: https://github.com/your-username/zkfetch-stellar-example/issues
- **Stellar Explorer**: https://stellar.expert/explorer/testnet/
- **Reclaim Protocol**: https://reclaimprotocol.org/
