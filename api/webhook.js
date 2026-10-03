import crypto from "node:crypto";

export default async function handler(request, response) {
  console.log("=== OPTGATEWAY WEBHOOK START ===");
  console.log("METHOD:", request.method);
  console.log("HEADERS:", request.headers);

  if (request.method !== "POST") {
    console.log("ERROR: METHOD IS NOT POST");
    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const secret = process.env.OPTGATEWAY_WEBHOOK_SECRET;

  console.log("SECRET EXISTS:", !!secret);

  if (!secret) {
    console.log("ERROR: WEBHOOK SECRET IS MISSING");
    return response.status(500).json({
      error: "Webhook secret missing",
    });
  }

  const signatureHeader =
    request.headers["optgateway-signature"];

  console.log(
    "SIGNATURE HEADER EXISTS:",
    !!signatureHeader
  );

  if (!signatureHeader) {
    console.log(
      "ERROR: OPTGATEWAY-SIGNATURE HEADER NOT FOUND"
    );

    return response.status(400).json({
      error: "Missing webhook signature",
    });
  }

  console.log(
    "SIGNATURE HEADER FORMAT:",
    signatureHeader.substring(0, 20) + "..."
  );

  const parts = signatureHeader
    .split(",")
    .map((part) => part.trim());

  console.log("SIGNATURE PARTS:", parts.length);

  const timestampPart = parts.find((part) =>
    part.startsWith("t=")
  );

  const signatureParts = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  console.log(
    "TIMESTAMP FOUND:",
    !!timestampPart
  );

  console.log(
    "V1 SIGNATURE FOUND:",
    signatureParts.length > 0
  );

  if (!timestampPart || signatureParts.length === 0) {
    console.log("ERROR: INVALID SIGNATURE FORMAT");

    return response.status(400).json({
      error: "Invalid signature format",
    });
  }

  const timestamp = timestampPart.slice(2);
  const timestampNumber = Number(timestamp);

  console.log("TIMESTAMP:", timestamp);
  console.log(
    "TIMESTAMP VALID:",
    Number.isFinite(timestampNumber)
  );

  if (!Number.isFinite(timestampNumber)) {
    console.log("ERROR: INVALID TIMESTAMP");

    return response.status(400).json({
      error: "Invalid timestamp",
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - timestampNumber);

  console.log("TIMESTAMP AGE:", age, "seconds");

  if (age > 300) {
    console.log("ERROR: TIMESTAMP EXPIRED");

    return response.status(400).json({
      error: "Expired signature",
    });
  }

  console.log("REQUEST BODY TYPE:", typeof request.body);

  let rawBody;

  if (typeof request.body === "string") {
    rawBody = request.body;
  } else {
    rawBody = JSON.stringify(request.body);
  }

  console.log(
    "BODY EXISTS:",
    !!rawBody
  );

  console.log(
    "BODY LENGTH:",
    rawBody ? rawBody.length : 0
  );

  const signedPayload = `${timestamp}.${rawBody}`;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  console.log(
    "EXPECTED SIGNATURE GENERATED: YES"
  );

  const valid = signatureParts.some(
    (signature) => signature === expected
  );

  console.log(
    "SIGNATURE VALID:",
    valid
  );

  if (!valid) {
    console.log(
      "ERROR: SIGNATURE DOES NOT MATCH"
    );

    return response.status(400).json({
      error: "Invalid signature",
    });
  }

  console.log("=== WEBHOOK SUCCESS ===");

  return response.status(200).json({
    received: true,
  });
}
