import axios from "axios";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client, x402HTTPClient } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

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

function safeHeaders(headers) {
  const output = {};
  const source = headers?.toJSON ? headers.toJSON() : Object.fromEntries(Object.entries(headers || {}));

  for (const [key, value] of Object.entries(source)) {
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

function summarizePaymentRequired(paymentRequired) {
  return {
    x402Version: paymentRequired?.x402Version ?? null,
    resource: paymentRequired?.resource ?? null,
    accepts_count: Array.isArray(paymentRequired?.accepts)
      ? paymentRequired.accepts.length
      : null,
    accepts: Array.isArray(paymentRequired?.accepts)
      ? paymentRequired.accepts.map((item) => ({
          scheme: item?.scheme,
          network: item?.network,
          amount: item?.amount,
          asset: item?.asset,
          payTo: item?.payTo,
          maxTimeoutSeconds: item?.maxTimeoutSeconds,
          extra: item?.extra,
        }))
      : null,
  };
}

function summarizePaymentPayload(paymentPayload) {
  const inner = paymentPayload?.payload || {};
  const permit2 = inner?.permit2Authorization || null;
  const witness = permit2?.witness || null;

  return {
    x402Version: paymentPayload?.x402Version ?? null,
    has_payload: Boolean(paymentPayload?.payload),
    payload_keys: inner ? Object.keys(inner) : [],
    has_signature: Boolean(inner?.signature),
    has_authorization: Boolean(inner?.authorization),
    has_permit2Authorization: Boolean(permit2),
    has_permit2_witness: Boolean(witness),
    permit2_from: permit2?.from || null,
    permit2_spender: permit2?.spender || null,
    permit2_permitted: permit2?.permitted || null,
    permit2_witness: witness || null,
    accepted: paymentPayload?.accepted
      ? {
          scheme: paymentPayload.accepted.scheme,
          network: paymentPayload.accepted.network,
          amount: paymentPayload.accepted.amount,
          asset: paymentPayload.accepted.asset,
          extra: paymentPayload.accepted.extra,
        }
      : null,
  };
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

  const signer = privateKeyToAccount(privateKey);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const httpClient = new x402HTTPClient(client);

  const api = axios.create({
    timeout: 30000,
    validateStatus: () => true,
  });

  let paymentRequired = null;
  let paymentPayload = null;
  let paymentHeaders = null;

  try {
    const firstResponse = await api.get(CMC_X402_QUOTES_URL, {
      params: { symbol },
    });

    const getHeader = (name) => {
      const value =
        firstResponse.headers?.[name] ||
        firstResponse.headers?.[String(name).toLowerCase()];
      return typeof value === "string" ? value : undefined;
    };

    try {
      paymentRequired = httpClient.getPaymentRequiredResponse(
        getHeader,
        firstResponse.data
      );
    } catch {
      if (firstResponse.data?.x402Version) {
        paymentRequired = firstResponse.data;
      }
    }

    if (!paymentRequired) {
      console.log(
        JSON.stringify({
          success: false,
          paid: false,
          used_in_decision: false,
          status: "payment_required_parse_failed",
          http_status: firstResponse.status,
          symbol,
          wallet_address: signer.address,
          response_body_preview: firstResponse.data,
          response_headers: safeHeaders(firstResponse.headers),
          message: "Could not parse CMC x402 payment requirements.",
        })
      );
      process.exit(0);
    }

const preferredAccept = (paymentRequired.accepts || []).find((item) => {
  return (
    item?.scheme === "exact" &&
    item?.network === "eip155:8453" &&
    String(item?.asset || "").toLowerCase() ===
      "0x833589fcD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase() &&
    item?.extra?.assetTransferMethod === "eip3009"
  );
});

if (!preferredAccept) {
  console.log(
    JSON.stringify({
      success: false,
      paid: false,
      used_in_decision: false,
      status: "base_usdc_payment_option_missing",
      http_status: firstResponse.status,
      symbol,
      provider: "CoinMarketCap",
      protocol: "x402",
      endpoint: CMC_X402_QUOTES_URL,
      payment_network: "Base",
      payment_chain_id: 8453,
      payment_asset: "USDC",
      expected_price_usd: "0.01",
      wallet_address: signer.address,
      payment_required_debug: summarizePaymentRequired(paymentRequired),
      response_body_preview: firstResponse.data,
      response_headers: safeHeaders(firstResponse.headers),
      message: "CMC did not return a Base USDC eip3009 payment option.",
    })
  );
  process.exit(0);
}

paymentRequired = {
  ...paymentRequired,
  accepts: [preferredAccept],
};

paymentPayload = await client.createPaymentPayload(paymentRequired);
paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

const paidResponse = await api.get(CMC_X402_QUOTES_URL, {
  params: { symbol },
  headers: paymentHeaders,
});

    const priceUsd = extractPrice(paidResponse.data, symbol);
    const success = Boolean(paidResponse.status === 200 && priceUsd);

    console.log(
      JSON.stringify({
        success,
        paid: paidResponse.status === 200,
        used_in_decision: success,
        status: paidResponse.status === 200 ? "paid" : "request_failed",
        http_status: paidResponse.status,
        symbol,
        price_usd: priceUsd,
        provider: "CoinMarketCap",
        protocol: "x402",
        endpoint: CMC_X402_QUOTES_URL,
        payment_network: "Base",
        payment_chain_id: 8453,
        payment_asset: "USDC",
        expected_price_usd: "0.01",
        wallet_address: signer.address,
        payment_required_debug: summarizePaymentRequired(paymentRequired),
        payment_payload_debug: summarizePaymentPayload(paymentPayload),
        payment_headers_sent: Object.keys(compatibleHeaders),
        payment_response_header_present: Boolean(
          paidResponse.headers?.["payment-response"] ||
            paidResponse.headers?.["x-payment-response"]
        ),
        response_body_preview: paidResponse.data,
        response_headers: safeHeaders(paidResponse.headers),
        message:
          paidResponse.status === 200
            ? "CMC x402 quote paid and returned successfully."
            : "CMC x402 request returned non-200 status after sending payment payload.",
      })
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        success: false,
        paid: false,
        used_in_decision: false,
        status: "error",
        http_status: error?.response?.status || null,
        symbol,
        provider: "CoinMarketCap",
        protocol: "x402",
        endpoint: CMC_X402_QUOTES_URL,
        payment_network: "Base",
        payment_chain_id: 8453,
        payment_asset: "USDC",
        expected_price_usd: "0.01",
        wallet_address: signer.address,
        payment_required_debug: paymentRequired
          ? summarizePaymentRequired(paymentRequired)
          : null,
        payment_payload_debug: paymentPayload
          ? summarizePaymentPayload(paymentPayload)
          : null,
        payment_headers_sent: paymentHeaders ? Object.keys(paymentHeaders) : null,
        response_body_preview: error?.response?.data || null,
        response_headers: safeHeaders(error?.response?.headers || {}),
        message: error?.message || "CMC x402 TypeScript request failed.",
      })
    );
  }
}

main();
