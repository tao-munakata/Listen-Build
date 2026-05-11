#!/usr/bin/env node
const [project, sourceAi, token, rawContent] = process.argv.slice(2);

async function main() {
  const response = await fetch("http://localhost:3000/api/webhooks/cli/inbox", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ai-dev-os-token": token || ""
    },
    body: JSON.stringify({ project, sourceAi, rawContent })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Webhook request failed");
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
