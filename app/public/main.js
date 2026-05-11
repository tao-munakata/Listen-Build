const CATEGORIES = [
  ["inbox", "Inbox"],
  ["today", "今日"],
  ["idea", "アイデア"],
  ["requirement", "要件"],
  ["design", "設計"],
  ["bug", "バグ"],
  ["feature", "機能追加"],
  ["version", "Ver管理"],
  ["scrum", "Scrum"],
  ["docs", "設計書"],
  ["changelog", "変更履歴"],
  ["search", "検索"],
  ["git", "Git"],
  ["audit", "監査"]
];

const WINDOW_CATEGORIES = CATEGORIES.filter(([key]) =>
  ["idea", "requirement", "design", "bug", "feature", "version"].includes(key)
);

let state = {
  projects: [],
  entries: [],
  inbox: [],
  auditLogs: [],
  selectedProject: null,
  selectedTab: "inbox"
};

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}

async function load() {
  const data = await api("/api/overview");
  state.projects = data.projects;
  state.entries = data.entries;
  state.inbox = data.inbox;
  state.auditLogs = data.auditLogs || [];
  if (!state.selectedProject && state.projects.length) state.selectedProject = state.projects[0].id;
  render();
}

function currentProject() {
  return state.projects.find((project) => project.id === state.selectedProject);
}

function projectEntries(category) {
  const project = currentProject();
  if (!project) return [];
  return state.entries.filter((entry) => entry.projectId === project.id && entry.category === category);
}

function projectAllEntries() {
  const project = currentProject();
  if (!project) return [];
  return state.entries.filter((entry) => entry.projectId === project.id);
}

function projectInbox() {
  const project = currentProject();
  if (!project) return [];
  return state.inbox.filter((message) => message.projectId === project.id);
}

function projectAuditLogs() {
  const project = currentProject();
  if (!project) return [];
  const projectEntryIds = new Set(state.entries.filter((entry) => entry.projectId === project.id).map((entry) => entry.id));
  const projectInboxIds = new Set(state.inbox.filter((message) => message.projectId === project.id).map((message) => message.id));
  return state.auditLogs.filter((log) => {
    if (log.targetId === project.id) return true;
    if (log.detail?.projectId === project.id) return true;
    return projectEntryIds.has(log.targetId) || projectInboxIds.has(log.targetId);
  });
}

function render() {
  renderProjects();
  renderHeader();
  renderTabs();
  renderContent();
}

function renderProjects() {
  $("projectList").innerHTML = state.projects
    .map(
      (project) => `
        <button class="projectItem ${project.id === state.selectedProject ? "active" : ""}" data-project="${project.id}">
          <strong>${escapeHtml(project.name)}</strong>
          <span>${escapeHtml(project.slug)}</span>
        </button>
      `
    )
    .join("");

  document.querySelectorAll("[data-project]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedProject = button.dataset.project;
      state.selectedTab = "inbox";
      render();
    });
  });
}

function renderHeader() {
  const project = currentProject();
  $("projectTitle").textContent = project ? project.name : "案件を作成してください";
  const inboxCount = projectInbox().filter((message) => message.processingStatus !== "done").length;
  const entryCount = state.entries.filter((entry) => entry.projectId === state.selectedProject).length;
  $("stats").innerHTML = `
    <div class="stat"><strong>${state.projects.length}</strong><span>案件</span></div>
    <div class="stat"><strong>${inboxCount}</strong><span>未処理Inbox</span></div>
    <div class="stat"><strong>${entryCount}</strong><span>窓エントリー</span></div>
  `;
}

function renderTabs() {
  $("tabs").innerHTML = CATEGORIES.map(([key, label]) => {
    const count =
      key === "inbox"
        ? projectInbox().filter((m) => m.processingStatus !== "done").length
        : key === "today"
          ? projectAllEntries().filter((entry) => entry.status === "in_progress").length
        : key === "audit"
          ? projectAuditLogs().length
          : projectEntries(key).length;
    return `<button class="tab ${state.selectedTab === key ? "active" : ""}" data-tab="${key}">${label} ${count}</button>`;
  }).join("");
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTab = button.dataset.tab;
      render();
    });
  });
}

function renderContent() {
  if (!currentProject()) {
    $("content").innerHTML = `<div class="row">左の「案件を作成」から最初の案件を作ってください。</div>`;
    return;
  }
  if (state.selectedTab === "inbox") return renderInbox();
  if (state.selectedTab === "today") return renderToday();
  if (state.selectedTab === "scrum") return renderScrum();
  if (state.selectedTab === "docs") return renderDocs();
  if (state.selectedTab === "changelog") return renderChangelog();
  if (state.selectedTab === "search") return renderSearch();
  if (state.selectedTab === "git") return renderGit();
  if (state.selectedTab === "audit") return renderAudit();
  renderEntries();
}

function renderToday() {
  const entries = projectAllEntries();
  const inbox = projectInbox().filter((message) => message.processingStatus !== "done");
  const inProgress = entries
    .filter((entry) => entry.status === "in_progress")
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const nextEntries = entries
    .filter((entry) => entry.status === "open")
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, 5);

  $("content").innerHTML = `
    <section class="row gitToolbar">
      <div>
        <h3>今日の作業</h3>
        <p class="toolbarText">未処理、対応中、次にやる候補をまとめて確認します。</p>
      </div>
      <button id="todayRefreshButton">更新</button>
    </section>
    <article class="row">
      <div class="stats">
        <div class="stat"><strong>${inbox.length}</strong><span>未処理Inbox</span></div>
        <div class="stat"><strong>${inProgress.length}</strong><span>対応中</span></div>
        <div class="stat"><strong>${nextEntries.length}</strong><span>次候補</span></div>
      </div>
    </article>
    ${todaySection("対応中", inProgress, "対応中の項目はありません。")}
    ${todaySection("次にやる候補", nextEntries, "次候補はありません。")}
    ${inbox.length ? `
      <article class="row">
        <div class="rowHeader">
          <h3>未処理Inbox</h3>
          <span class="pill warn">${inbox.length}</span>
        </div>
        <div class="body">Inboxに未処理の入力があります。AI整理で窓へ振り分けてください。</div>
        <div class="actions entryActions">
          <button data-open-tab="inbox">Inboxを開く</button>
        </div>
      </article>
    ` : ""}
  `;
  $("todayRefreshButton").addEventListener("click", load);
  document.querySelectorAll("[data-open-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTab = button.dataset.openTab;
      render();
    });
  });
  bindEntryStatusButtons();
}

function todaySection(title, entries, emptyText) {
  return `
    <section class="contentBlock">
      <h3 class="sectionTitle">${title}</h3>
      ${
        entries.length
          ? entries.map((entry) => todayEntry(entry)).join("")
          : `<article class="row"><div class="body">${emptyText}</div></article>`
      }
    </section>
  `;
}

function todayEntry(entry) {
  return `
    <article class="row">
      <div class="rowHeader">
        <h3>${escapeHtml(entry.title)}</h3>
        <span class="pill ${entry.status === "in_progress" ? "warn" : "good"}">${escapeHtml(entry.status)}</span>
      </div>
      <div class="meta">
        <span class="pill">${escapeHtml(entry.category)}</span>
        <span class="pill">priority ${entry.priority}</span>
      </div>
      <div class="body">${escapeHtml(entry.bodyMarkdown)}</div>
      <div class="actions entryActions">
        <button data-open-tab="${escapeHtml(entry.category)}">窓を開く</button>
        ${entry.status === "in_progress" ? "" : `<button data-entry-status="${entry.id}" data-status="in_progress">対応中にする</button>`}
        ${entry.status === "done" ? "" : `<button data-entry-status="${entry.id}" data-status="done">完了にする</button>`}
        ${entry.status === "open" ? "" : `<button data-entry-status="${entry.id}" data-status="open">未着手に戻す</button>`}
      </div>
    </article>
  `;
}

function renderInbox() {
  const items = projectInbox();
  if (!items.length) {
    $("content").innerHTML = `<div class="row">Inboxは空です。上の入力欄からAI出力を保存できます。</div>`;
    return;
  }
  const autoRouteCount = items.filter(
    (message) =>
      message.processingStatus !== "done" &&
      Number(message.confidence || 0) >= 0.8 &&
      (message.suggestedCategory || message.classifiedTag)
  ).length;
  const organizeCount = items.filter((message) => message.processingStatus !== "done").length;
  $("content").innerHTML = `
    <div class="row inboxToolbar">
      <div>
        <h3>Inbox処理</h3>
        <p class="toolbarText">AI整理は未処理InboxをGeminiで分類し、高信頼のものだけ推奨窓へ振り分けます。</p>
      </div>
      <div class="toolbarActions">
        <button id="organizeButton" ${organizeCount ? "" : "disabled"}>AI整理 ${organizeCount}</button>
        <button id="autoRouteButton" ${autoRouteCount ? "" : "disabled"}>高信頼を自動振り分け ${autoRouteCount}</button>
      </div>
    </div>
  ` + items
    .map((message) => {
      const confidenceClass = message.confidence >= 0.8 ? "good" : message.confidence >= 0.6 ? "warn" : "danger";
      return `
        <article class="row">
          <div class="rowHeader">
            <h3>${escapeHtml(message.suggestedTitle || message.rawContent.split(/\n/).find(Boolean)?.slice(0, 90) || "Untitled")}</h3>
            <span class="pill ${message.processingStatus === "done" ? "good" : "warn"}">${message.processingStatus}</span>
          </div>
          <div class="meta">
            <span class="pill">${escapeHtml(message.sourceAi)}</span>
            <span class="pill">${escapeHtml(message.classifiedTag || "UNCLASSIFIED")}</span>
            <span class="pill ${confidenceClass}">confidence ${message.confidence}</span>
            ${message.classificationModel ? `<span class="pill">${escapeHtml(message.classificationModel)}</span>` : ""}
            <span class="pill">${escapeHtml(message.classificationReason || "")}</span>
          </div>
          <div class="body">${escapeHtml(message.rawContent)}</div>
          ${
            message.processingStatus === "done"
              ? ""
              : `<div class="actions"><button data-reclassify="${message.id}">Gemini分類</button>${routeButtons(message.id, message.suggestedCategory)}</div>`
          }
        </article>
      `;
    })
    .join("");

  const autoRouteButton = $("autoRouteButton");
  if (autoRouteButton) {
    autoRouteButton.addEventListener("click", async () => {
      const project = currentProject();
      if (!project) return;
      autoRouteButton.disabled = true;
      autoRouteButton.textContent = "振り分け中...";
      try {
        const result = await api(`/api/projects/${project.slug}/inbox/auto-route`, {
          method: "POST",
          body: JSON.stringify({ threshold: 0.8 })
        });
        await load();
        alert(`${result.count}件を窓へ振り分けました。`);
      } catch (error) {
        alert(`自動振り分けに失敗しました: ${error.message}`);
        autoRouteButton.disabled = false;
      }
    });
  }

  const organizeButton = $("organizeButton");
  if (organizeButton) {
    organizeButton.addEventListener("click", async () => {
      const project = currentProject();
      if (!project) return;
      organizeButton.disabled = true;
      organizeButton.textContent = "整理中...";
      try {
        const result = await api(`/api/projects/${project.slug}/inbox/organize`, {
          method: "POST",
          body: JSON.stringify({ threshold: 0.8, limit: 10 })
        });
        await load();
        alert(`${result.classifiedCount}件を分類し、${result.routedCount}件を窓へ振り分けました。`);
      } catch (error) {
        alert(`AI整理に失敗しました: ${error.message}`);
        organizeButton.disabled = false;
      }
    });
  }

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/inbox/${button.dataset.route}/route`, {
        method: "POST",
        body: JSON.stringify({ category: button.dataset.category })
      });
      await load();
    });
  });

  document.querySelectorAll("[data-reclassify]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "分類中...";
      try {
        await api(`/api/inbox/${button.dataset.reclassify}/reclassify`, {
          method: "POST",
          body: JSON.stringify({ provider: "gemini" })
        });
        await load();
      } catch (error) {
        alert(`Gemini分類に失敗しました: ${error.message}`);
        button.disabled = false;
        button.textContent = "Gemini分類";
      }
    });
  });
}

function routeButtons(id, suggested) {
  return WINDOW_CATEGORIES
    .map(([key, label]) => `<button data-route="${id}" data-category="${key}">${key === suggested ? "推奨: " : ""}${label}</button>`)
    .join("");
}

function renderEntries() {
  const items = projectEntries(state.selectedTab);
  if (!items.length) {
    $("content").innerHTML = `<div class="row">この窓にはまだエントリーがありません。</div>`;
    return;
  }
  $("content").innerHTML = items
    .map(
      (entry) => `
        <article class="row">
          <div class="rowHeader">
            <h3>${escapeHtml(entry.title)}</h3>
            <span class="pill good">${escapeHtml(entry.status)}</span>
          </div>
          <div class="meta">
            <span class="pill">priority ${entry.priority}</span>
            <span class="pill">${escapeHtml(entry.source)}</span>
            <span class="pill">${new Date(entry.createdAt).toLocaleString()}</span>
          </div>
          <div class="body">${escapeHtml(entry.bodyMarkdown)}</div>
          <div class="actions entryActions">
            ${entry.status === "in_progress" ? "" : `<button data-entry-status="${entry.id}" data-status="in_progress">対応中にする</button>`}
            ${entry.status === "done" ? "" : `<button data-entry-status="${entry.id}" data-status="done">完了にする</button>`}
            ${entry.status === "open" ? "" : `<button data-entry-status="${entry.id}" data-status="open">未着手に戻す</button>`}
          </div>
        </article>
      `
    )
    .join("");
  bindEntryStatusButtons();
}

function renderAudit() {
  const logs = projectAuditLogs();
  if (!logs.length) {
    $("content").innerHTML = `<div class="row">監査ログはまだありません。</div>`;
    return;
  }
  $("content").innerHTML = logs
    .map((log) => {
      const summary = auditSummary(log);
      return `
        <article class="row auditRow">
          <div class="rowHeader">
            <h3>${escapeHtml(summary)}</h3>
            <span class="pill">${escapeHtml(log.actor)}</span>
          </div>
          <div class="meta">
            <span class="pill">${escapeHtml(log.action)}</span>
            <span class="pill">${escapeHtml(log.targetType)}</span>
            <span class="pill">${new Date(log.createdAt).toLocaleString()}</span>
          </div>
          <pre class="auditDetail">${escapeHtml(JSON.stringify(log.detail || {}, null, 2))}</pre>
        </article>
      `;
    })
    .join("");
}

function renderSearch() {
  $("content").innerHTML = `
    <section class="row searchPanel">
      <input id="searchInput" placeholder="Inbox・窓・監査ログを検索" />
      <button id="searchButton">検索</button>
    </section>
    <section class="content" id="searchResults"></section>
  `;
  $("searchButton").addEventListener("click", runSearch);
  $("searchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch();
  });
  $("searchInput").focus();
}

async function runSearch() {
  const project = currentProject();
  const query = $("searchInput").value.trim();
  if (!project || !query) return;
  const results = await api(`/api/projects/${project.slug}/search?q=${encodeURIComponent(query)}&limit=50`);
  $("searchResults").innerHTML = results.length
    ? results.map(renderSearchResult).join("")
    : `<div class="row">検索結果はありません。</div>`;
}

function renderSearchResult(result) {
  return `
    <article class="row">
      <div class="rowHeader">
        <h3>${escapeHtml(result.title)}</h3>
        <span class="pill">${escapeHtml(result.type)}</span>
      </div>
      <div class="meta">
        ${result.category ? `<span class="pill">${escapeHtml(result.category)}</span>` : ""}
        ${result.source ? `<span class="pill">${escapeHtml(result.source)}</span>` : ""}
        ${result.status ? `<span class="pill">${escapeHtml(result.status)}</span>` : ""}
        ${result.createdAt ? `<span class="pill">${new Date(result.createdAt).toLocaleString()}</span>` : ""}
      </div>
      <div class="body">${escapeHtml(result.snippet)}</div>
    </article>
  `;
}

async function renderChangelog() {
  const project = currentProject();
  if (!project) return;
  $("content").innerHTML = `
    <section class="row changelogToolbar">
      <div>
        <h3>CHANGELOG.md</h3>
        <p class="toolbarText">窓エントリーと監査ログから変更履歴を生成します。</p>
      </div>
      <button id="generateChangelogButton">生成</button>
    </section>
    <section class="row">
      <pre class="markdownPreview" id="changelogPreview">読み込み中...</pre>
    </section>
  `;
  $("generateChangelogButton").addEventListener("click", async () => {
    const button = $("generateChangelogButton");
    button.disabled = true;
    button.textContent = "生成中...";
    try {
      const result = await api(`/api/projects/${project.slug}/changelog`, { method: "POST" });
      $("changelogPreview").textContent = result.content;
    } catch (error) {
      alert(`CHANGELOG生成に失敗しました: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = "生成";
    }
  });
  try {
    const result = await api(`/api/projects/${project.slug}/changelog`);
    $("changelogPreview").textContent = result.content || "まだCHANGELOGはありません。";
  } catch (error) {
    $("changelogPreview").textContent = error.message;
  }
}

async function renderDocs() {
  const project = currentProject();
  if (!project) return;
  $("content").innerHTML = `
    <section class="row changelogToolbar">
      <div>
        <h3>docs/設計書.md</h3>
        <p class="toolbarText">要件・設計・機能追加・バグ窓から設計書Markdownを生成します。</p>
      </div>
      <button id="generateDocsButton">生成</button>
    </section>
    <section class="row">
      <pre class="markdownPreview" id="docsPreview">読み込み中...</pre>
    </section>
  `;
  $("generateDocsButton").addEventListener("click", async () => {
    const button = $("generateDocsButton");
    button.disabled = true;
    button.textContent = "生成中...";
    try {
      const result = await api(`/api/projects/${project.slug}/docs/design`, { method: "POST" });
      $("docsPreview").textContent = result.content;
    } catch (error) {
      alert(`設計書生成に失敗しました: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = "生成";
    }
  });
  try {
    const result = await api(`/api/projects/${project.slug}/docs/design`);
    $("docsPreview").textContent = result.content || "まだ設計書はありません。";
  } catch (error) {
    $("docsPreview").textContent = error.message;
  }
}

async function renderGit() {
  $("content").innerHTML = `
    <section class="row gitToolbar">
      <div>
        <h3>Git連携</h3>
        <p class="toolbarText">Vault・データ・アプリの現在状態をローカルGitに記録します。</p>
      </div>
      <div class="toolbarActions">
        <button id="gitInitButton">初期化</button>
        <button id="gitRefreshButton">更新</button>
      </div>
    </section>
    <section class="row commitPanel">
      <input id="commitMessage" placeholder="コミットメッセージ" />
      <button id="commitButton">コミット</button>
    </section>
    <section id="gitContent" class="content"></section>
  `;
  $("gitInitButton").addEventListener("click", async () => {
    await api("/api/git/init", { method: "POST" });
    await loadGitStatus();
  });
  $("gitRefreshButton").addEventListener("click", loadGitStatus);
  $("commitButton").addEventListener("click", async () => {
    const message = $("commitMessage").value.trim();
    const button = $("commitButton");
    button.disabled = true;
    button.textContent = "コミット中...";
    try {
      const result = await api("/api/git/commit", {
        method: "POST",
        body: JSON.stringify({ message })
      });
      $("commitMessage").value = "";
      renderGitStatus(result.status, result.message);
      alert(result.committed ? "コミットしました。" : result.message);
    } catch (error) {
      alert(`Gitコミットに失敗しました: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = "コミット";
    }
  });
  await loadGitStatus();
}

async function renderScrum() {
  const project = currentProject();
  if (!project) return;
  $("content").innerHTML = `
    <section class="row gitToolbar">
      <div>
        <h3>AI Scrum Master</h3>
        <p class="toolbarText">未処理・高優先度・最近の変更から次アクションを提案します。</p>
      </div>
      <button id="refreshScrumButton">更新</button>
    </section>
    <section id="scrumContent" class="content"></section>
  `;
  $("refreshScrumButton").addEventListener("click", loadScrumPlan);
  await loadScrumPlan();
}

async function loadScrumPlan() {
  const project = currentProject();
  if (!project) return;
  const plan = await api(`/api/projects/${project.slug}/scrum/plan`);
  renderScrumPlan(plan);
}

function renderScrumPlan(plan) {
  $("scrumContent").innerHTML = `
    <article class="row">
      <div class="stats">
        <div class="stat"><strong>${plan.summary.pendingInbox}</strong><span>未処理Inbox</span></div>
        <div class="stat"><strong>${plan.summary.openEntries}</strong><span>Open窓</span></div>
        <div class="stat"><strong>${plan.summary.highPriorityBugs}</strong><span>高優先バグ</span></div>
        <div class="stat"><strong>${plan.summary.recentAudit}</strong><span>最近の監査</span></div>
      </div>
    </article>
    ${plan.recommendations.map((item) => `
      <article class="row">
        <div class="rowHeader">
          <h3>${escapeHtml(item.title)}</h3>
          <span class="pill">P${item.priority}</span>
        </div>
        <div class="meta">
          <span class="pill">${escapeHtml(item.type)}</span>
        </div>
        <div class="body"><strong>理由:</strong> ${escapeHtml(item.reason)}</div>
        <div class="body"><strong>次アクション:</strong> ${escapeHtml(item.action)}</div>
        <div class="actions scrumActions">
          ${scrumActionButtons(item)}
        </div>
      </article>
    `).join("")}
  `;
  bindScrumActionButtons();
}

function scrumActionButtons(item) {
  const openButton = item.category
    ? `<button data-open-tab="${escapeHtml(item.category)}">窓を開く</button>`
    : "";
  const startButton = item.startEntryId
    ? `<button data-entry-status="${escapeHtml(item.startEntryId)}" data-status="in_progress">先頭を対応中にする</button>`
    : "";
  if (item.actionKey === "organize_inbox") {
    return `${openButton}<button data-scrum-action="organize_inbox">AI整理を実行</button>`;
  }
  if (item.actionKey === "generate_docs") {
    return `${openButton}<button data-scrum-action="generate_docs">設計書生成</button>`;
  }
  if (item.actionKey === "generate_changelog") {
    return `${openButton}<button data-scrum-action="generate_changelog">CHANGELOG生成</button>`;
  }
  return `${openButton}${startButton}`;
}

function bindScrumActionButtons() {
  document.querySelectorAll("[data-open-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTab = button.dataset.openTab;
      render();
    });
  });

  document.querySelectorAll("[data-scrum-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const project = currentProject();
      if (!project) return;
      button.disabled = true;
      const original = button.textContent;
      button.textContent = "実行中...";
      try {
        if (button.dataset.scrumAction === "organize_inbox") {
          await api(`/api/projects/${project.slug}/inbox/organize`, {
            method: "POST",
            body: JSON.stringify({ threshold: 0.8, limit: 10 })
          });
        }
        if (button.dataset.scrumAction === "generate_docs") {
          await api(`/api/projects/${project.slug}/docs/design`, { method: "POST" });
        }
        if (button.dataset.scrumAction === "generate_changelog") {
          await api(`/api/projects/${project.slug}/changelog`, { method: "POST" });
        }
        await load();
        state.selectedTab = "scrum";
        render();
      } catch (error) {
        alert(`Scrumアクションに失敗しました: ${error.message}`);
        button.disabled = false;
        button.textContent = original;
      }
    });
  });
  bindEntryStatusButtons();
}

function bindEntryStatusButtons() {
  document.querySelectorAll("[data-entry-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const original = button.textContent;
      button.textContent = "更新中...";
      try {
        await api(`/api/entries/${button.dataset.entryStatus}`, {
          method: "PATCH",
          body: JSON.stringify({ status: button.dataset.status })
        });
        await load();
      } catch (error) {
        alert(`ステータス更新に失敗しました: ${error.message}`);
        button.disabled = false;
        button.textContent = original;
      }
    });
  });
}

async function loadGitStatus() {
  const status = await api("/api/git/status");
  renderGitStatus(status);
}

function renderGitStatus(status, notice = "") {
  const changes = status.changes || [];
  const recent = status.recent || [];
  $("gitContent").innerHTML = `
    ${notice ? `<div class="row">${escapeHtml(notice)}</div>` : ""}
    <article class="row">
      <div class="rowHeader">
        <h3>${status.initialized ? `branch: ${escapeHtml(status.branch)}` : "Git未初期化"}</h3>
        <span class="pill">${changes.length} changes</span>
      </div>
      ${
        changes.length
          ? `<div class="gitList">${changes.map((change) => `<div><span class="pill">${escapeHtml(change.status)}</span> ${escapeHtml(change.path)}</div>`).join("")}</div>`
          : `<div class="body">変更はありません。</div>`
      }
    </article>
    <article class="row">
      <h3>Recent commits</h3>
      ${
        recent.length
          ? `<div class="gitList">${recent.map((commit) => `<div><span class="pill">${escapeHtml(commit.hash)}</span> ${escapeHtml(commit.date)} ${escapeHtml(commit.subject)}</div>`).join("")}</div>`
          : `<div class="body">コミット履歴はまだありません。</div>`
      }
    </article>
  `;
}

function auditSummary(log) {
  const detail = log.detail || {};
  if (log.action === "project.create") return `案件作成: ${detail.slug || log.targetId}`;
  if (log.action === "inbox.create") return `Inbox投入: ${detail.classifiedTag || "UNCLASSIFIED"} / confidence ${detail.confidence ?? "-"}`;
  if (log.action === "inbox.classify") return `AI分類: ${detail.classifiedTag || "UNCLASSIFIED"} → ${detail.category || "-"}`;
  if (log.action === "inbox.route") return `窓へ振り分け: ${detail.category || "-"}`;
  if (log.action === "entry.create") return `窓エントリー作成: ${detail.category || "-"}`;
  return log.action;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("newProjectButton").addEventListener("click", () => $("projectDialog").showModal());

$("createProjectButton").addEventListener("click", async (event) => {
  event.preventDefault();
  const name = $("projectName").value.trim();
  if (!name) return;
  const project = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, description: $("projectDescription").value.trim() })
  });
  state.selectedProject = project.id;
  $("projectName").value = "";
  $("projectDescription").value = "";
  $("projectDialog").close();
  await load();
});

$("saveInboxButton").addEventListener("click", async () => {
  const project = currentProject();
  const text = $("inboxText").value.trim();
  if (!project || !text) return;
  await api("/api/inbox", {
    method: "POST",
    body: JSON.stringify({
      project: project.slug,
      source: "ui",
      sourceAi: $("sourceAi").value,
      rawContent: text
    })
  });
  $("inboxText").value = "";
  state.selectedTab = "inbox";
  await load();
});

$("geminiGenerateButton").addEventListener("click", async () => {
  const project = currentProject();
  const prompt = $("inboxText").value.trim();
  if (!project || !prompt) return;
  try {
    await api("/api/integrations/gemini/generate", {
      method: "POST",
      body: JSON.stringify({
        project: project.slug,
        prompt
      })
    });
    $("inboxText").value = "";
    state.selectedTab = "inbox";
    await load();
  } catch (error) {
    alert(`Gemini APIを呼び出せませんでした: ${error.message}`);
  }
});

load().catch((error) => {
  $("content").innerHTML = `<div class="row">${escapeHtml(error.message)}</div>`;
});
