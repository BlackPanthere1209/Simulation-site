const crypto = require('crypto');

function safeEqualHex(a, b) {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const secret = process.env.OPTGATEWAY_WEBHOOK_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Webhook is not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const signatureHeader = request.headers.get('OPGateway-Signature') || '';
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatureParts = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  const timestamp = timestampPart ? timestampPart.slice(2) : '';

  if (!timestamp || signatureParts.length === 0) {
    return new Response(JSON.stringify({ error: 'Invalid signature.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) {
    return new Response(JSON.stringify({ error: 'Invalid signature timestamp.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNumber) > 300) {
    return new Response(JSON.stringify({ error: 'Expired webhook signature.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await request.text();
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const valid = signatureParts.some((signature) => safeEqualHex(signature, expected));

  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid webhook signature.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The webhook is authenticated here. For now we acknowledge the event quickly.
  // Persistent ticket/booking storage can be added once the checkout flow is tested.
  console.log('OPTGATEWAY EVENT:', event.type, event.id);

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
