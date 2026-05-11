#!/usr/bin/env node
const {
  createProject,
  createInbox,
  createEntry
} = require("../app/src/store");

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "new-project") {
    const [name, description = ""] = args;
    if (!name) throw new Error("Project name is required");
    print(createProject({ name, description }));
  } else if (command === "ai-save") {
    const [project, sourceAi = "other", ...textParts] = args;
    const rawContent = textParts.join(" ");
    if (!project || !rawContent) throw new Error("Project and text are required");
    print(createInbox(project, { source: "cli", sourceAi, rawContent }));
  } else if (command === "bug-add") {
    const [project, title, priority = "5", ...bodyParts] = args;
    const bodyMarkdown = bodyParts.join(" ");
    if (!project || !title) throw new Error("Project and title are required");
    print(
      createEntry(project, {
        category: "bug",
        title,
        priority: Number(priority),
        bodyMarkdown,
        source: "cli"
      })
    );
  } else {
    throw new Error("Usage: os-cli.js new-project|ai-save|bug-add");
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
