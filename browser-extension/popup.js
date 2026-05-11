const $ = (id) => document.getElementById(id);

async function getSelectionText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return "";
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection().toString()
  });
  const selected = result?.result || "";
  return selected.trim() ? `${selected}\n\nSource URL: ${tab.url}` : `Page: ${tab.title}\nURL: ${tab.url}`;
}

async function loadSettings() {
  const values = await chrome.storage.local.get(["project", "token", "sourceAi"]);
  $("project").value = values.project || "aios-demo";
  $("token").value = values.token || "";
  $("sourceAi").value = values.sourceAi || "gemini";
  $("memo").value = await getSelectionText();
}

async function saveSettings() {
  await chrome.storage.local.set({
    project: $("project").value.trim(),
    token: $("token").value,
    sourceAi: $("sourceAi").value
  });
}

$("send").addEventListener("click", async () => {
  $("status").textContent = "送信中...";
  await saveSettings();
  const response = await fetch("http://localhost:3000/api/webhooks/browser/inbox", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ai-dev-os-token": $("token").value
    },
    body: JSON.stringify({
      project: $("project").value.trim(),
      sourceAi: $("sourceAi").value,
      rawContent: $("memo").value.trim()
    })
  });
  const data = await response.json();
  if (!response.ok) {
    $("status").textContent = data.error || "送信に失敗しました";
    return;
  }
  $("status").textContent = `Inboxへ保存しました: ${data.classifiedTag || "UNCLASSIFIED"}`;
});

loadSettings().catch((error) => {
  $("status").textContent = error.message;
});
