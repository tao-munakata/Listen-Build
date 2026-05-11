const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { classifyText, tagToCategory } = require("../../packages/core/classifier");

const ROOT = path.resolve(process.env.AI_DEV_OS_ROOT || path.join(__dirname, "../.."));
const DATA_FILE = path.resolve(ROOT, process.env.AI_DEV_OS_DATA || "data/store.json");
const VAULT_ROOT = path.resolve(ROOT, process.env.AI_DEV_OS_VAULT || "vault/projects");

const WINDOW_DIRS = {
  idea: "1_idea",
  requirement: "2_requirement",
  design: "3_design",
  bug: "4_bug",
  feature: "5_feature",
  version: "6_version"
};

function now() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID();
}

function slugify(value) {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
  return ascii || `project-${Date.now()}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson() {
  if (!fs.existsSync(DATA_FILE)) {
    return { projects: [], entries: [], inbox: [], auditLogs: [] };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeJson(store) {
  ensureDir(path.dirname(DATA_FILE));
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`);
  fs.renameSync(tmp, DATA_FILE);
}

function audit(store, actor, action, targetType, targetId, detail = {}) {
  store.auditLogs.unshift({
    id: id(),
    actor,
    action,
    targetType,
    targetId,
    detail,
    createdAt: now()
  });
}

function projectPath(slug) {
  return path.join(VAULT_ROOT, slug);
}

function ensureProjectVault(project) {
  const root = projectPath(project.slug);
  ensureDir(path.join(root, "inbox"));
  for (const dir of Object.values(WINDOW_DIRS)) ensureDir(path.join(root, "windows", dir));
  ensureDir(path.join(root, "docs"));
  ensureDir(path.join(root, "src"));
  ensureDir(path.join(root, "docker"));
  ensureDir(path.join(root, "scripts"));

  const readme = path.join(root, "README.md");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, `# ${project.name}\n\n${project.description || ""}\n`);
  }
  const changelog = path.join(root, "CHANGELOG.md");
  if (!fs.existsSync(changelog)) {
    fs.writeFileSync(changelog, "# Changelog\n\n## Unreleased\n\n");
  }
}

function safeFilePart(value) {
  const unicode = String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#%{}[\]^~`]+/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return unicode || slugify(value).slice(0, 80) || "entry";
}

function frontmatter(data) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) lines.push(`${key}: ${JSON.stringify(value)}`);
  lines.push("---", "");
  return lines.join("\n");
}

function writeInboxMarkdown(project, message) {
  const stamp = message.createdAt.replace(/[-:]/g, "").replace(/\..+/, "Z");
  const file = message.markdownPath || path.join(projectPath(project.slug), "inbox", `${stamp}_${safeFilePart(message.sourceAi)}.md`);
  fs.writeFileSync(
    file,
    `${frontmatter({
      id: message.id,
      project: project.slug,
      source: message.source,
      source_ai: message.sourceAi,
      suggested_title: message.suggestedTitle || "",
      classified_tag: message.classifiedTag,
      suggested_category: message.suggestedCategory || "",
      confidence: message.confidence,
      status: message.processingStatus,
      classification_reason: message.classificationReason || "",
      created_at: message.createdAt
    })}# Inbox: ${message.sourceAi}\n\n${message.rawContent}\n`
  );
  return file;
}

function writeEntryMarkdown(project, entry) {
  const dir = WINDOW_DIRS[entry.category] || "1_idea";
  const stamp = entry.createdAt.replace(/[-:]/g, "").replace(/\..+/, "Z");
  const file = path.join(projectPath(project.slug), "windows", dir, `${stamp}_${safeFilePart(entry.title)}.md`);
  fs.writeFileSync(
    file,
    `${frontmatter({
      id: entry.id,
      project: project.slug,
      category: entry.category,
      status: entry.status,
      priority: entry.priority,
      source: entry.source,
      source_inbox_id: entry.sourceInboxId || "",
      created_at: entry.createdAt,
      updated_at: entry.updatedAt
    })}# ${entry.title}\n\n${entry.bodyMarkdown}\n`
  );
  return file;
}

function listProjects() {
  return readJson().projects;
}

function createProject(input) {
  const store = readJson();
  const baseSlug = slugify(input.slug || input.name);
  let slug = baseSlug;
  let counter = 2;
  while (store.projects.some((project) => project.slug === slug)) {
    slug = `${baseSlug}-${counter++}`;
  }
  const createdAt = now();
  const project = {
    id: id(),
    name: input.name,
    slug,
    description: input.description || "",
    status: "active",
    owner: input.owner || "",
    vaultPath: projectPath(slug),
    createdAt,
    updatedAt: createdAt
  };
  store.projects.unshift(project);
  ensureProjectVault(project);
  audit(store, "human", "project.create", "project", project.id, { slug });
  writeJson(store);
  return project;
}

function findProject(store, projectRef) {
  return store.projects.find((project) => project.id === projectRef || project.slug === projectRef);
}

function createEntry(projectRef, input) {
  const store = readJson();
  const project = findProject(store, projectRef);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  const createdAt = now();
  const entry = {
    id: id(),
    projectId: project.id,
    category: input.category || "idea",
    title: input.title || "Untitled",
    bodyMarkdown: input.bodyMarkdown || input.body || "",
    structured: input.structured || {},
    priority: Number(input.priority || 5),
    status: input.status || "open",
    source: input.source || "human",
    sourceInboxId: input.sourceInboxId || null,
    markdownPath: "",
    createdAt,
    updatedAt: createdAt
  };
  entry.markdownPath = writeEntryMarkdown(project, entry);
  store.entries.unshift(entry);
  audit(store, "human", "entry.create", "entry", entry.id, { projectId: project.id, category: entry.category });
  writeJson(store);
  return entry;
}

function listEntries(projectRef, category) {
  const store = readJson();
  const project = findProject(store, projectRef);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  return store.entries.filter((entry) => entry.projectId === project.id && (!category || entry.category === category));
}

function createInbox(projectRef, input) {
  const store = readJson();
  const project = findProject(store, projectRef || input.project || input.projectId);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  const result = classifyText(input.rawContent || input.text || "");
  const createdAt = now();
  const message = {
    id: id(),
    projectId: project.id,
    source: input.source || "ui",
    sourceAi: input.sourceAi || input.source_ai || "other",
    rawContent: input.rawContent || input.text || "",
    suggestedTitle: input.suggestedTitle || "",
    classifiedTag: result.tag,
    suggestedCategory: result.category,
    confidence: result.confidence,
    classificationReason: result.reason,
    processingStatus: result.confidence >= 0.8 ? "pending" : "review_required",
    markdownPath: "",
    createdAt,
    updatedAt: createdAt
  };
  message.markdownPath = writeInboxMarkdown(project, message);
  store.inbox.unshift(message);
  audit(store, "human", "inbox.create", "inbox", message.id, {
    projectId: project.id,
    classifiedTag: message.classifiedTag,
    confidence: message.confidence
  });
  writeJson(store);
  return message;
}

function updateInboxClassification(inboxId, result, actor = "ai") {
  const store = readJson();
  const message = store.inbox.find((item) => item.id === inboxId);
  if (!message) throw Object.assign(new Error("Inbox message not found"), { statusCode: 404 });
  const project = findProject(store, message.projectId);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });

  message.classifiedTag = result.tag;
  message.suggestedCategory = result.category;
  message.confidence = Number(result.confidence || 0);
  message.suggestedTitle = result.title || message.suggestedTitle || "";
  message.classificationReason = result.reason || message.classificationReason || "";
  message.classificationModel = result.model || message.classificationModel || "";
  message.processingStatus = message.confidence >= 0.8 ? "pending" : "review_required";
  message.updatedAt = now();
  message.markdownPath = writeInboxMarkdown(project, message);
  audit(store, actor, "inbox.classify", "inbox", message.id, {
    classifiedTag: message.classifiedTag,
    category: message.suggestedCategory,
    confidence: message.confidence,
    model: message.classificationModel
  });
  writeJson(store);
  return message;
}

function listInbox(status) {
  const store = readJson();
  return store.inbox.filter((message) => !status || message.processingStatus === status);
}

function routeInbox(inboxId, input = {}) {
  const store = readJson();
  const message = store.inbox.find((item) => item.id === inboxId);
  if (!message) throw Object.assign(new Error("Inbox message not found"), { statusCode: 404 });
  const project = findProject(store, message.projectId);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  const category = input.category || tagToCategory(input.tag || message.classifiedTag) || message.suggestedCategory || "idea";
  const title = input.title || message.suggestedTitle || message.rawContent.split(/\n/).find(Boolean)?.slice(0, 80) || "Inbox routed item";
  const createdAt = now();
  const entry = {
    id: id(),
    projectId: project.id,
    category,
    title,
    bodyMarkdown: message.rawContent,
    structured: { routedFromInbox: true, classificationReason: message.classificationReason },
    priority: Number(input.priority || 5),
    status: "open",
    source: message.sourceAi || message.source || "inbox",
    sourceInboxId: message.id,
    markdownPath: "",
    createdAt,
    updatedAt: createdAt
  };
  entry.markdownPath = writeEntryMarkdown(project, entry);
  store.entries.unshift(entry);
  message.processingStatus = "done";
  message.updatedAt = now();
  audit(store, "human", "inbox.route", "inbox", message.id, { entryId: entry.id, category });
  writeJson(store);
  return { message, entry };
}

function bulkRouteInbox(projectRef, input = {}) {
  const threshold = Number(input.threshold ?? 0.8);
  const store = readJson();
  const project = findProject(store, projectRef);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  const candidates = store.inbox
    .filter((message) => message.projectId === project.id)
    .filter((message) => message.processingStatus !== "done")
    .filter((message) => Number(message.confidence || 0) >= threshold)
    .filter((message) => message.suggestedCategory || tagToCategory(message.classifiedTag));

  const routed = [];
  for (const message of candidates) {
    routed.push(routeInbox(message.id, { priority: input.priority || 5 }));
  }
  return {
    projectId: project.id,
    threshold,
    count: routed.length,
    routed
  };
}

function listOrganizeTargets(projectRef, input = {}) {
  const limit = Math.max(1, Math.min(25, Number(input.limit || 10)));
  const store = readJson();
  const project = findProject(store, projectRef);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  return store.inbox
    .filter((message) => message.projectId === project.id)
    .filter((message) => message.processingStatus !== "done")
    .slice(0, limit);
}

function listAuditLogs(projectRef, input = {}) {
  const limit = Math.max(1, Math.min(200, Number(input.limit || 100)));
  const store = readJson();
  const project = projectRef ? findProject(store, projectRef) : null;
  if (projectRef && !project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  if (!project) return store.auditLogs.slice(0, limit);

  const entryIds = new Set(store.entries.filter((entry) => entry.projectId === project.id).map((entry) => entry.id));
  const inboxIds = new Set(store.inbox.filter((message) => message.projectId === project.id).map((message) => message.id));
  return store.auditLogs
    .filter((log) => {
      if (log.targetId === project.id) return true;
      if (log.detail?.projectId === project.id) return true;
      if (entryIds.has(log.targetId)) return true;
      if (inboxIds.has(log.targetId)) return true;
      return false;
    })
    .slice(0, limit);
}

function searchProject(projectRef, input = {}) {
  const query = String(input.query || "").trim();
  const limit = Math.max(1, Math.min(100, Number(input.limit || 50)));
  const store = readJson();
  const project = findProject(store, projectRef);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  if (!query) return [];

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = [];
  const addMatch = (item) => {
    const haystack = item.searchText.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    if (score > 0) {
      matches.push({
        type: item.type,
        id: item.id,
        title: item.title,
        snippet: makeSnippet(item.searchText, terms[0]),
        score,
        category: item.category || "",
        source: item.source || "",
        status: item.status || "",
        createdAt: item.createdAt || ""
      });
    }
  };

  for (const entry of store.entries.filter((entry) => entry.projectId === project.id)) {
    addMatch({
      type: "entry",
      id: entry.id,
      title: entry.title,
      category: entry.category,
      source: entry.source,
      status: entry.status,
      createdAt: entry.createdAt,
      searchText: `${entry.title}\n${entry.category}\n${entry.status}\n${entry.source}\n${entry.bodyMarkdown}\n${JSON.stringify(entry.structured || {})}`
    });
  }

  for (const message of store.inbox.filter((message) => message.projectId === project.id)) {
    addMatch({
      type: "inbox",
      id: message.id,
      title: message.suggestedTitle || message.rawContent.split(/\n/).find(Boolean)?.slice(0, 80) || "Inbox",
      category: message.suggestedCategory || message.classifiedTag || "",
      source: message.sourceAi,
      status: message.processingStatus,
      createdAt: message.createdAt,
      searchText: `${message.suggestedTitle || ""}\n${message.sourceAi}\n${message.classifiedTag || ""}\n${message.suggestedCategory || ""}\n${message.classificationReason || ""}\n${message.rawContent}`
    });
  }

  for (const log of listAuditLogs(project.id, { limit: 200 })) {
    addMatch({
      type: "audit",
      id: log.id,
      title: log.action,
      category: log.targetType,
      source: log.actor,
      status: "",
      createdAt: log.createdAt,
      searchText: `${log.actor}\n${log.action}\n${log.targetType}\n${JSON.stringify(log.detail || {})}`
    });
  }

  return matches.sort((a, b) => b.score - a.score || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
}

function makeSnippet(text, term) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const index = clean.toLowerCase().indexOf(String(term || "").toLowerCase());
  const start = Math.max(0, index - 60);
  const end = Math.min(clean.length, (index >= 0 ? index : 0) + 160);
  return `${start > 0 ? "..." : ""}${clean.slice(start, end)}${end < clean.length ? "..." : ""}`;
}

function generateChangelog(projectRef) {
  const store = readJson();
  const project = findProject(store, projectRef);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });

  const entries = store.entries
    .filter((entry) => entry.projectId === project.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const audits = listAuditLogs(project.id, { limit: 200 });
  const generatedAt = now();
  const lines = [
    "# Changelog",
    "",
    `Project: ${project.name}`,
    `Generated: ${generatedAt}`,
    "",
    "## Unreleased",
    ""
  ];

  const grouped = {
    feature: [],
    requirement: [],
    design: [],
    bug: [],
    idea: [],
    version: []
  };
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }

  const sections = [
    ["feature", "Added"],
    ["requirement", "Requirements"],
    ["design", "Design"],
    ["bug", "Fixed / Bugs"],
    ["idea", "Ideas"],
    ["version", "Version Notes"]
  ];
  for (const [category, label] of sections) {
    if (!grouped[category]?.length) continue;
    lines.push(`### ${label}`, "");
    for (const entry of grouped[category]) {
      lines.push(`- ${entry.title} (${entry.source}, ${formatDate(entry.createdAt)})`);
    }
    lines.push("");
  }

  lines.push("### Activity", "");
  for (const log of audits.slice(0, 30)) {
    lines.push(`- ${formatDateTime(log.createdAt)} ${log.action} by ${log.actor}`);
  }
  lines.push("");

  const content = `${lines.join("\n").trim()}\n`;
  const file = path.join(projectPath(project.slug), "CHANGELOG.md");
  fs.writeFileSync(file, content);
  audit(store, "system", "changelog.generate", "project", project.id, {
    path: file,
    entryCount: entries.length,
    auditCount: audits.length
  });
  writeJson(store);
  return {
    projectId: project.id,
    path: file,
    generatedAt,
    content
  };
}

function readChangelog(projectRef) {
  const store = readJson();
  const project = findProject(store, projectRef);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  const file = path.join(projectPath(project.slug), "CHANGELOG.md");
  return {
    projectId: project.id,
    path: file,
    content: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
  };
}

function generateDesignDoc(projectRef) {
  const store = readJson();
  const project = findProject(store, projectRef);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });

  const entries = store.entries
    .filter((entry) => entry.projectId === project.id)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const byCategory = {
    requirement: entries.filter((entry) => entry.category === "requirement"),
    design: entries.filter((entry) => entry.category === "design"),
    feature: entries.filter((entry) => entry.category === "feature"),
    bug: entries.filter((entry) => entry.category === "bug"),
    idea: entries.filter((entry) => entry.category === "idea"),
    version: entries.filter((entry) => entry.category === "version")
  };
  const generatedAt = now();
  const lines = [
    `# ${project.name} 設計書`,
    "",
    `Generated: ${generatedAt}`,
    `Status: ${project.status}`,
    "",
    "## 1. 概要",
    "",
    project.description || "このドキュメントはAI開発OSの窓エントリーから自動生成されています。",
    "",
    "## 2. 要件",
    ""
  ];

  appendEntrySection(lines, byCategory.requirement, "登録済み要件はありません。");
  lines.push("## 3. 設計", "");
  appendEntrySection(lines, byCategory.design, "登録済み設計はありません。");
  lines.push("## 4. 機能追加", "");
  appendEntrySection(lines, byCategory.feature, "登録済み機能追加はありません。");
  lines.push("## 5. バグ・課題", "");
  appendEntrySection(lines, byCategory.bug, "登録済みバグはありません。");
  lines.push("## 6. アイデア", "");
  appendEntrySection(lines, byCategory.idea, "登録済みアイデアはありません。");
  lines.push("## 7. バージョン管理", "");
  appendEntrySection(lines, byCategory.version, "登録済みバージョン情報はありません。");

  const content = `${lines.join("\n").trim()}\n`;
  const file = path.join(projectPath(project.slug), "docs", "設計書.md");
  fs.writeFileSync(file, content);
  audit(store, "system", "docs.generate", "project", project.id, {
    path: file,
    entryCount: entries.length
  });
  writeJson(store);
  return {
    projectId: project.id,
    path: file,
    generatedAt,
    content
  };
}

function readDesignDoc(projectRef) {
  const store = readJson();
  const project = findProject(store, projectRef);
  if (!project) throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  const file = path.join(projectPath(project.slug), "docs", "設計書.md");
  return {
    projectId: project.id,
    path: file,
    content: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
  };
}

function appendEntrySection(lines, entries, emptyText) {
  if (!entries.length) {
    lines.push(emptyText, "");
    return;
  }
  for (const entry of entries) {
    lines.push(`### ${entry.title}`, "");
    lines.push(`- Status: ${entry.status}`);
    lines.push(`- Priority: ${entry.priority}`);
    lines.push(`- Source: ${entry.source}`);
    lines.push(`- Created: ${formatDateTime(entry.createdAt)}`);
    lines.push("");
    lines.push(entry.bodyMarkdown || "_No details._");
    lines.push("");
  }
}

function formatDate(value) {
  return String(value || "").slice(0, 10);
}

function formatDateTime(value) {
  return String(value || "").replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function overview() {
  const store = readJson();
  return {
    projects: store.projects,
    entries: store.entries,
    inbox: store.inbox,
    auditLogs: store.auditLogs.slice(0, 50)
  };
}

module.exports = {
  ROOT,
  DATA_FILE,
  VAULT_ROOT,
  WINDOW_DIRS,
  classifyText,
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
  slugify
};
