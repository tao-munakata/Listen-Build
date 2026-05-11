require("./env").loadEnv();

const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  ROOT,
  DATA_FILE,
  VAULT_ROOT,
  createProject,
  listProjects,
  createEntry,
  listEntries,
  createInbox,
  listInbox,
  updateInboxClassification,
  routeInbox,
  bulkRouteInbox,
  listOrganizeTargets,
  listAuditLogs,
  searchProject,
  generateChangelog,
  readChangelog,
  generateDesignDoc,
  readDesignDoc,
  overview,
  classifyText
} = require("./store");
const { callGemini, classifyWithGemini, listGeminiModels, requireWebhookToken } = require("./integrations");
const { gitStatus, initRepo, commitAll } = require("./git");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "../public");

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": typeof body === "string" ? "text/html; charset=utf-8" : "application/json; charset=utf-8",
    ...headers
  });
  res.end(payload);
}

function sendJson(res, status, body) {
  send(res, status, body, { "content-type": "application/json; charset=utf-8" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(Object.assign(new Error("Body too large"), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(Object.assign(new Error("Invalid JSON"), { statusCode: 400 }));
      }
    });
  });
}

function routeParams(pathname, pattern) {
  const parts = pathname.split("/").filter(Boolean);
  const expected = pattern.split("/").filter(Boolean);
  if (parts.length !== expected.length) return null;
  const params = {};
  for (let i = 0; i < parts.length; i += 1) {
    if (expected[i].startsWith(":")) params[expected[i].slice(1)] = decodeURIComponent(parts[i]);
    else if (parts[i] !== expected[i]) return null;
  }
  return params;
}

function serveStatic(req, res, pathname) {
  const file = pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, pathname);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
  const ext = path.extname(file);
  const type = ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : "text/html";
  res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
  fs.createReadStream(file).pipe(res);
  return true;
}

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      root: ROOT,
      dataFile: DATA_FILE,
      vaultRoot: VAULT_ROOT,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      geminiModel: process.env.GEMINI_MODEL || "auto"
    });
  }

  if (req.method === "GET" && pathname === "/api/overview") {
    return sendJson(res, 200, overview());
  }

  if (req.method === "GET" && pathname === "/api/git/status") {
    return sendJson(res, 200, gitStatus());
  }

  if (req.method === "POST" && pathname === "/api/git/init") {
    return sendJson(res, 200, initRepo());
  }

  if (req.method === "POST" && pathname === "/api/git/commit") {
    const body = await readBody(req);
    return sendJson(res, 200, commitAll(body.message));
  }

  if (req.method === "GET" && pathname === "/api/projects") {
    return sendJson(res, 200, listProjects());
  }

  if (req.method === "POST" && pathname === "/api/projects") {
    return sendJson(res, 201, createProject(await readBody(req)));
  }

  let params = routeParams(pathname, "/api/projects/:projectRef/entries");
  if (params && req.method === "GET") {
    return sendJson(res, 200, listEntries(params.projectRef, searchParams.get("category")));
  }

  if (params && req.method === "POST") {
    return sendJson(res, 201, createEntry(params.projectRef, await readBody(req)));
  }

  params = routeParams(pathname, "/api/projects/:projectRef/audit");
  if (params && req.method === "GET") {
    return sendJson(res, 200, listAuditLogs(params.projectRef, { limit: searchParams.get("limit") || 100 }));
  }

  params = routeParams(pathname, "/api/projects/:projectRef/search");
  if (params && req.method === "GET") {
    return sendJson(res, 200, searchProject(params.projectRef, {
      query: searchParams.get("q") || "",
      limit: searchParams.get("limit") || 50
    }));
  }

  params = routeParams(pathname, "/api/projects/:projectRef/changelog");
  if (params && req.method === "GET") {
    return sendJson(res, 200, readChangelog(params.projectRef));
  }

  if (params && req.method === "POST") {
    return sendJson(res, 200, generateChangelog(params.projectRef));
  }

  params = routeParams(pathname, "/api/projects/:projectRef/docs/design");
  if (params && req.method === "GET") {
    return sendJson(res, 200, readDesignDoc(params.projectRef));
  }

  if (params && req.method === "POST") {
    return sendJson(res, 200, generateDesignDoc(params.projectRef));
  }

  if (req.method === "GET" && pathname === "/api/inbox") {
    return sendJson(res, 200, listInbox(searchParams.get("status")));
  }

  if (req.method === "POST" && pathname === "/api/inbox") {
    return sendJson(res, 201, createInbox(null, await readBody(req)));
  }

  params = routeParams(pathname, "/api/webhooks/inbox");
  if (params && req.method === "POST") {
    requireWebhookToken(req, url);
    const body = await readBody(req);
    return sendJson(
      res,
      201,
      createInbox(null, {
        ...body,
        source: body.source || "webhook",
        sourceAi: body.sourceAi || body.source_ai || "webhook"
      })
    );
  }

  params = routeParams(pathname, "/api/webhooks/:source/inbox");
  if (params && req.method === "POST") {
    requireWebhookToken(req, url);
    const body = await readBody(req);
    return sendJson(
      res,
      201,
      createInbox(null, {
        ...body,
        source: "webhook",
        sourceAi: body.sourceAi || body.source_ai || params.source
      })
    );
  }

  if (req.method === "POST" && pathname === "/api/integrations/gemini/generate") {
    const body = await readBody(req);
    const result = await callGemini(body.prompt || body.text || "", {
      model: body.model,
      temperature: body.temperature
    });
    const message = createInbox(null, {
      project: body.project || body.projectId,
      source: "gemini-api",
      sourceAi: "gemini",
      rawContent: result.text
    });
    return sendJson(res, 201, {
      message,
      gemini: {
        model: result.model
      }
    });
  }

  if (req.method === "GET" && pathname === "/api/integrations/gemini/models") {
    return sendJson(res, 200, await listGeminiModels());
  }

  params = routeParams(pathname, "/api/inbox/:id/route");
  if (params && req.method === "POST") {
    return sendJson(res, 200, routeInbox(params.id, await readBody(req)));
  }

  params = routeParams(pathname, "/api/projects/:projectRef/inbox/auto-route");
  if (params && req.method === "POST") {
    return sendJson(res, 200, bulkRouteInbox(params.projectRef, await readBody(req)));
  }

  params = routeParams(pathname, "/api/projects/:projectRef/inbox/organize");
  if (params && req.method === "POST") {
    const body = await readBody(req);
    const threshold = Number(body.threshold ?? 0.8);
    const targets = listOrganizeTargets(params.projectRef, { limit: body.limit || 10 });
    const classified = [];
    for (const inbox of targets) {
      const result = await classifyWithGemini(inbox.rawContent);
      classified.push(updateInboxClassification(inbox.id, result, "ai"));
    }
    const routed = bulkRouteInbox(params.projectRef, { threshold });
    return sendJson(res, 200, {
      projectRef: params.projectRef,
      threshold,
      classifiedCount: classified.length,
      routedCount: routed.count,
      classified,
      routed: routed.routed
    });
  }

  params = routeParams(pathname, "/api/inbox/:id/reclassify");
  if (params && req.method === "POST") {
    const body = await readBody(req);
    if (body.provider && body.provider !== "gemini") {
      return sendJson(res, 400, { error: "Only gemini provider is supported for AI reclassification" });
    }
    const inbox = listInbox().find((message) => message.id === params.id);
    if (!inbox) return sendJson(res, 404, { error: "Inbox message not found" });
    const result = await classifyWithGemini(inbox.rawContent);
    return sendJson(res, 200, updateInboxClassification(params.id, result, "ai"));
  }

  if (req.method === "POST" && pathname === "/api/classify") {
    const body = await readBody(req);
    return sendJson(res, 200, classifyText(body.text || body.rawContent || ""));
  }

  return sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (serveStatic(req, res, url.pathname)) return;
    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`AI Development OS is running at http://localhost:${PORT}`);
  console.log(`Vault: ${VAULT_ROOT}`);
});
