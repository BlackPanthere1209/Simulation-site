import crypto from "node:crypto";

const ALLOWED_ORIGIN =
  "https://fatihboutique.github.io";

const PLANS = {
  essential: {
    amount: "25.00",
    name: "Essential",
  },

  vip: {
    amount: "30.00",
    name: "Gourmand V.I.P",
  },
};

function setCors(response) {
  response.setHeader(
    "Access-Control-Allow-Origin",
    ALLOWED_ORIGIN
  );

  response.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  response.setHeader(
    "Vary",
    "Origin"
  );
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

export default async function handler(request, response) {

  setCors(response);

  // Handle browser CORS preflight
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json");

    response.end(
      JSON.stringify({
        error: "Method not allowed",
      })
    );

    return;
  }

  const apiKey = process.env.OPTGATEWAY_API_KEY;

  if (!apiKey) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json");

    response.end(
      JSON.stringify({
        error: "Payment service is not configured.",
      })
    );

    return;
  }

  let body;

  try {
    body = await readBody(request);
  } catch {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json");

    response.end(
      JSON.stringify({
        error: "Invalid JSON body.",
      })
    );

    return;
  }

  const plan = String(
    body?.plan || ""
  ).toLowerCase();

  const selected = PLANS[plan];

  if (!selected) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json");

    response.end(
      JSON.stringify({
        error: "Invalid ticket category.",
      })
    );

    return;
  }

  const reference =
    `CB-${plan.toUpperCase()}-${crypto.randomUUID()}`;

  const payload = {
    amount: selected.amount,
    currency: "USD",
    reference,

    return_url:
      "https://fatihboutique.github.io/Canon-Beach-7-Novembre-2026/payment-success.html",

    cancel_url:
      "https://fatihboutique.github.io/Canon-Beach-7-Novembre-2026/#billets",

    methods: [
      "illicocash",
      "mobile_money",
      "card",
    ],

    expires_in_minutes: 60,

    metadata: {
      event: "Canon Beach — 07 Novembre 2026",
      category: selected.name,
      plan,
    },
  };

  try {

    const upstream = await fetch(
      "https://pay.optsolution.pro/v1/checkout/sessions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      }
    );

    const data =
      await upstream.json().catch(() => ({}));

    console.log(
      "OPTGateway response:",
      upstream.status,
      data
    );

    if (!upstream.ok) {

      response.statusCode = upstream.status;
      response.setHeader(
        "Content-Type",
        "application/json"
      );

      response.end(
        JSON.stringify({
          error:
            "Unable to create payment session.",

          details:
            data?.message ||
            data?.error ||
            null,
        })
      );

      return;
    }

    if (!data?.url) {

      response.statusCode = 502;
      response.setHeader(
        "Content-Type",
        "application/json"
      );

      response.end(
        JSON.stringify({
          error:
            "Payment session created without a checkout URL.",
        })
      );

      return;
    }

    response.statusCode = 200;
    response.setHeader(
      "Content-Type",
      "application/json"
    );

    response.end(
      JSON.stringify({
        url: data.url,

        session_id:
          data.id ||
          data.session_id ||
          null,

        reference,

        category: selected.name,

        amount: selected.amount,

        currency: "USD",
      })
    );

  } catch (error) {

    console.error(
      "Checkout error:",
      error
    );

    response.statusCode = 502;
    response.setHeader(
      "Content-Type",
      "application/json"
    );

    response.end(
      JSON.stringify({
        error:
          "Payment service is temporarily unavailable.",
        details:
          error?.message || null,
      })
    );
  }
}
