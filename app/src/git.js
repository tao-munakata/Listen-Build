const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
}

function isGitRepo() {
  try {
    return runGit(["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch (_) {
    return false;
  }
}

function ensureGitignore() {
  const file = path.join(ROOT, ".gitignore");
  const required = ["node_modules/", ".env", ".env.local", "*.log", ".DS_Store"];
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const lines = new Set(existing.split(/\r?\n/).filter(Boolean));
  for (const item of required) lines.add(item);
  fs.writeFileSync(file, `${Array.from(lines).join("\n")}\n`);
}

function initRepo() {
  ensureGitignore();
  if (!isGitRepo()) {
    runGit(["init"]);
  }
  ensureLocalIdentity();
  return gitStatus();
}

function ensureLocalIdentity() {
  try {
    runGit(["config", "user.name"]);
  } catch (_) {
    runGit(["config", "user.name", "AI Development OS"]);
  }
  try {
    runGit(["config", "user.email"]);
  } catch (_) {
    runGit(["config", "user.email", "ai-development-os@local"]);
  }
}

function gitStatus() {
  if (!isGitRepo()) {
    return {
      initialized: false,
      branch: "",
      changes: [],
      recent: []
    };
  }
  const branch = runGit(["branch", "--show-current"]) || "detached";
  const raw = runGit(["status", "--short"]);
  const changes = raw
    ? raw.split(/\r?\n/).map((line) => ({
        status: line.slice(0, 2).trim() || "??",
        path: line.slice(3)
      }))
    : [];
  return {
    initialized: true,
    branch,
    changes,
    recent: gitLog(8)
  };
}

function gitLog(limit = 8) {
  if (!isGitRepo()) return [];
  try {
    const raw = runGit(["log", `-${limit}`, "--pretty=format:%h%x09%ad%x09%s", "--date=short"]);
    return raw
      ? raw.split(/\r?\n/).map((line) => {
          const [hash, date, subject] = line.split("\t");
          return { hash, date, subject };
        })
      : [];
  } catch (_) {
    return [];
  }
}

function commitAll(message) {
  if (!isGitRepo()) {
    initRepo();
  }
  ensureLocalIdentity();
  runGit(["add", "."]);
  const status = gitStatus();
  if (!status.changes.length) {
    return {
      committed: false,
      message: "No changes to commit",
      status
    };
  }
  const commitMessage = String(message || "").trim() || `AI Development OS snapshot ${new Date().toISOString()}`;
  runGit(["commit", "-m", commitMessage]);
  return {
    committed: true,
    message: commitMessage,
    status: gitStatus()
  };
}

module.exports = { gitStatus, initRepo, commitAll };
