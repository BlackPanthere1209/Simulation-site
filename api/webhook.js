import crypto from "node:crypto";

function safeEqualHex(a, b) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");

    return (
      left.length === right.length &&
      crypto.timingSafeEqual(left, right)
    );
  } catch {
    return false;
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const secret = process.env.OPTGATEWAY_WEBHOOK_SECRET;

  if (!secret) {
    return response.status(500).json({
      error: "Webhook is not configured.",
    });
  }

  const signatureHeader =
    request.headers["opgateway-signature"] ||
    request.headers["OPGateway-Signature"];

  if (!signatureHeader) {
    return response.status(400).json({
      error: "Missing webhook signature.",
    });
  }

  const parts = signatureHeader
    .split(",")
    .map((part) => part.trim());

  const timestampPart = parts.find((part) =>
    part.startsWith("t=")
  );

  const signatureParts = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  const timestamp = timestampPart
    ? timestampPart.slice(2)
    : "";

  if (!timestamp || signatureParts.length === 0) {
    return response.status(400).json({
      error: "Invalid signature.",
    });
  }

  const timestampNumber = Number(timestamp);

  if (!Number.isFinite(timestampNumber)) {
    return response.status(400).json({
      error: "Invalid signature timestamp.",
    });
  }

  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - timestampNumber) > 300) {
    return response.status(400).json({
      error: "Expired webhook signature.",
    });
  }

  /*
   * Vercel's Node.js handler provides the raw request body
   * through req.body. For signature verification we need
   * the exact raw JSON string.
   */
  const rawBody =
    typeof request.body === "string"
      ? request.body
      : JSON.stringify(request.body);

  const signedPayload = `${timestamp}.${rawBody}`;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const valid = signatureParts.some((signature) =>
    safeEqualHex(signature, expected)
  );

  if (!valid) {
    return response.status(400).json({
      error: "Invalid webhook signature.",
    });
  }

  let event;

  try {
    event = JSON.parse(rawBody);
  } catch {
    return response.status(400).json({
      error: "Invalid JSON payload.",
    });
  }

  console.log(
    "OPTGATEWAY EVENT:",
    event.type,
    event.id
  );

  return response.status(200).json({
    received: true,
  });
}
