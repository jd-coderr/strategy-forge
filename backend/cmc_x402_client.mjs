import axios from "axios";
import { privateKeyToAccount } from "viem/accounts";
import { wrapAxiosWithPayment } from "@x402/axios";

const CMC_X402_QUOTES_URL =
  "https://pro-api.coinmarketcap.com/x402/v3/cryptocurrency/quotes/latest";

function normalizePrivateKey(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function normalizeSymbol(value) {
  return (
    String(value || "ETH")
      .toUpperCase()
      .replace("USDT", "")
      .replace("/", "")
      .replace("-", "")
      .trim() || "ETH"
  );
}

function headersToObject(headers) {
  if (!headers) return {};
  if (typeof headers.toJSON === "function") return headers.toJSON();
  return Object.fromEntries(Object.entries(headers));
}

function safeHeaders(headers) {
  const output = {};
  const headerObject = headersToObject(headers);

  for (const [key, value] of Object.entries(headerObject)) {
    const lower = String(key).toLowerCase();

    if (
      lower === "authorization" ||
      lower === "payment" ||
      lower === "payment-signature" ||
      lower === "x-payment" ||
      lower === "x-api-key" ||
      lower === "cookie" ||
      lower === "set-cookie"
    ) {
      output[key] = "REDACTED";
    } else {
      output[key] = value;
    }
  }

  return output;
}

function extractPrice(payload, symbol) {
  try {
    const data = payload?.data || {};
    const coinData =
      data[symbol] || data[symbol.toUpperCase()] || Object.values(data)[0];

    const price = coinData?.quote?.USD?.price;
    return typeof price === "number" ? price : Number(price);
  } catch {
    return null;
  }
}

async function main() {
  const symbol = normalizeSymbol(process.argv[2] || "ETH");
  const privateKey = normalizePrivateKey(
    process.env.X402_EVM_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY
  );

  if (!privateKey) {
    console.log(
      JSON.stringify({
        success: false,
        paid: false,
        used_in_decision: false,
        status: "not_configured",
        message: "Missing X402_EVM_PRIVATE_KEY or EVM_PRIVATE_KEY",
        symbol,
      })
    );
    process.exit(0);
  }

  const account = privateKeyToAccount(privateKey);
  const api = wrapAxiosWithPayment(axios.create(), account);

  try {
    const response = await api.get(CMC_X402_QUOTES_URL, {
      params: { symbol },
      timeout: 30000,
    });

    const priceUsd = extractPrice(response.data, symbol);
    const success = Boolean(response.status === 200 && priceUsd);

    console.log(
      JSON.stringify({
        success,
        paid: response.status === 200,
        used_in_decision: success,
        status: response.status === 200 ? "paid" : "request_failed",
        http_status: response.status,
        symbol,
        price_usd: priceUsd,
        provider: "CoinMarketCap",
        protocol: "x402",
        endpoint: CMC_X402_QUOTES_URL,
        payment_network: "Base",
        payment_chain_id: 8453,
        payment_asset: "USDC",
        expected_price_usd: "0.01",
        wallet_address: account.address,
        payment_response_header_present: Boolean(
          response.headers?.["payment-response"] ||
            response.headers?.["x-payment-response"]
        ),
        response_body_preview: response.data,
        response_headers: safeHeaders(response.headers),
        message:
          response.status === 200
            ? "CMC x402 quote paid and returned successfully through TypeScript SDK."
            : "CMC x402 request returned non-200 status.",
      })
    );
  } catch (error) {
    const status = error?.response?.status || null;
    const data = error?.response?.data || null;
    const headers = error?.response?.headers || null;

    console.log(
      JSON.stringify({
        success: false,
        paid: false,
        used_in_decision: false,
        status: "error",
        http_status: status,
        symbol,
        provider: "CoinMarketCap",
        protocol: "x402",
        endpoint: CMC_X402_QUOTES_URL,
        payment_network: "Base",
        payment_chain_id: 8453,
        payment_asset: "USDC",
        expected_price_usd: "0.01",
        wallet_address: account.address,
        response_body_preview: data,
        response_headers: safeHeaders(headers),
        message: error?.message || "CMC x402 TypeScript request failed.",
      })
    );
  }
}

main();
