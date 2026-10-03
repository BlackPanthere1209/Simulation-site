import crypto from "node:crypto";
const ALLOWED_ORIGIN = 'https://blackpanthere1209.github.io';

const PLANS = {
  essential: {
    amount: '25.00',
    name: 'Essential',
  },
  vip: {
    amount: '30.00',
    name: 'Gourmand V.I.P',
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders(),
    });
  }

  const apiKey = process.env.OPTGATEWAY_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Payment service is not configured.' }), {
      status: 500,
      headers: corsHeaders(),
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const plan = String(body?.plan || '').toLowerCase();
  const selected = PLANS[plan];

  if (!selected) {
    return new Response(JSON.stringify({ error: 'Invalid ticket category.' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const reference = `CB-${plan.toUpperCase()}-${crypto.randomUUID()}`;

  const payload = {
    amount: selected.amount,
    currency: 'USD',
    reference,
    return_url: 'https://blackpanthere1209.github.io/Canon-Beach-7-novembre/payment-success.html',
    cancel_url: 'https://blackpanthere1209.github.io/Canon-Beach-7-novembre/#billets',
    methods: ['illicocash', 'mobile_money', 'card'],
    expires_in_minutes: 60,
    metadata: {
      event: 'Canon Beach — 07 Novembre 2026',
      category: selected.name,
      plan,
    },
  };

  try {
    const upstream = await fetch('https://pay.optsolution.pro/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return new Response(JSON.stringify({
        error: 'Unable to create payment session.',
        details: data?.message || data?.error || undefined,
      }), {
        status: upstream.status,
        headers: corsHeaders(),
      });
    }

    if (!data?.url) {
      return new Response(JSON.stringify({ error: 'Payment session created without a checkout URL.' }), {
        status: 502,
        headers: corsHeaders(),
      });
    }

    return new Response(JSON.stringify({
      url: data.url,
      session_id: data.id || data.session_id || null,
      reference,
      category: selected.name,
      amount: selected.amount,
      currency: 'USD',
    }), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Payment service is temporarily unavailable.' }), {
      status: 502,
      headers: corsHeaders(),
    });
  }
}
