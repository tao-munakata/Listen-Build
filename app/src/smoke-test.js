const assert = require("assert");
const { createProject, createInbox, routeInbox, listEntries } = require("./store");

const project = createProject({ name: `Smoke Test ${Date.now()}`, description: "Automated local check" });
const inbox = createInbox(project.slug, {
  source: "test",
  sourceAi: "codex",
  rawContent: "API設計を改善したい。DB schema と Docker 構成も整理する。"
});
assert.equal(inbox.classifiedTag, "DESIGN");

const routed = routeInbox(inbox.id, { category: "design", title: "Smoke routed design" });
assert.equal(routed.entry.category, "design");

const entries = listEntries(project.slug, "design");
assert(entries.some((entry) => entry.id === routed.entry.id));

console.log("Smoke test passed");
