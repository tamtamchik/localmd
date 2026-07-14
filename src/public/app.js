import {
  formatAuthorLabel,
  formatRelativeTime,
  getSaveStatusLabel,
  mapScrollPosition,
  resolveTheme,
} from "./settings.js";

// State
let config = null;
let currentFile = null;
let editor = null;
let isDirty = false;
let saveTimeout = null;
let syncingScroll = false;

// DOM elements
const fileTree = document.getElementById("file-tree");
const currentFileEl = document.getElementById("current-file");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const saveStatusText = document.getElementById("save-status-text");
const preview = document.getElementById("preview");
const themeToggle = document.getElementById("theme-toggle");
const editorContainer = document.getElementById("editor");
const editorLayout = document.querySelector(".editor-container");
const viewModeButtons = document.querySelectorAll(".view-mode-btn");
const fileHistory = document.getElementById("file-history");
const authorAvatars = document.getElementById("author-avatars");
const changedAt = document.getElementById("changed-at");

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function configureMarkdown() {
  const options = {
    breaks: config.preview.breaks,
    gfm: config.preview.gfm,
  };

  if (config.preview.syntaxHighlighting) {
    options.highlight = function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    };
  }

  marked.setOptions(options);
}

// Theme management
function initTheme() {
  const theme = resolveTheme(
    config.ui.theme,
    localStorage.getItem("localmd-theme"),
    systemTheme.matches,
  );
  applyTheme(theme);

  systemTheme.addEventListener("change", function (event) {
    if (config.ui.theme === "system" && !localStorage.getItem("localmd-theme")) {
      applyTheme(event.matches ? "dark" : "light");
    }
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("localmd-theme", next);
  applyTheme(next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  updateHljsTheme(theme);
  updateEditorTheme(theme);
}

function updateHljsTheme(theme) {
  document.getElementById("hljs-light").disabled = theme === "dark";
  document.getElementById("hljs-dark").disabled = theme === "light";
}

function updateEditorTheme(theme) {
  if (editor) {
    editor.setOption("theme", theme === "dark" ? "material-darker" : "default");
  }
}

function isDarkMode() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

themeToggle.addEventListener("click", toggleTheme);

function setViewMode(mode) {
  editorLayout.setAttribute("data-view-mode", mode);

  for (const button of viewModeButtons) {
    const isActive = button.getAttribute("data-view-mode") === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  if (editor && mode !== "preview") {
    editor.refresh();
  }
}

function synchronizeScroll(update) {
  if (syncingScroll || editorLayout.getAttribute("data-view-mode") !== "split") {
    return;
  }

  syncingScroll = true;
  update();
  requestAnimationFrame(function () {
    syncingScroll = false;
  });
}

function syncPreviewFromEditor() {
  if (!editor) return;

  synchronizeScroll(function () {
    const info = editor.getScrollInfo();
    preview.scrollTop = mapScrollPosition(
      info.top,
      info.height,
      info.clientHeight,
      preview.scrollHeight,
      preview.clientHeight,
    );
  });
}

function syncEditorFromPreview() {
  if (!editor) return;

  synchronizeScroll(function () {
    const info = editor.getScrollInfo();
    const top = mapScrollPosition(
      preview.scrollTop,
      preview.scrollHeight,
      preview.clientHeight,
      info.height,
      info.clientHeight,
    );
    editor.scrollTo(null, top);
  });
}

preview.addEventListener("scroll", syncEditorFromPreview);

for (const button of viewModeButtons) {
  button.addEventListener("click", function () {
    setViewMode(button.getAttribute("data-view-mode"));
  });
}

// Editor
function createEditor(content = "") {
  if (editor) {
    editor.toTextArea();
  }

  // Create textarea if it doesn't exist
  let textarea = editorContainer.querySelector("textarea");
  if (!textarea) {
    textarea = document.createElement("textarea");
    editorContainer.appendChild(textarea);
  }
  textarea.value = content;

  editor = CodeMirror.fromTextArea(textarea, {
    mode: "gfm",
    theme: isDarkMode() ? "material-darker" : "default",
    lineNumbers: config.editor.lineNumbers,
    lineWrapping: config.editor.lineWrapping,
    autofocus: true,
  });

  editor.on("change", function () {
    isDirty = true;
    updateSaveStatus();
    schedulePreviewUpdate();
    scheduleAutoSave();
  });
  editor.on("scroll", syncPreviewFromEditor);

  // Set editor height
  editor.setSize("100%", "100%");
}

function getEditorContent() {
  return editor ? editor.getValue() : "";
}

function createAuthorAvatar(author) {
  const avatar = document.createElement("span");
  const image = document.createElement("img");
  const initial = document.createElement("span");
  const pendingUrls = [...author.avatarUrls];
  const label = formatAuthorLabel(author.name, author.lines);

  avatar.className = "author-avatar";
  avatar.title = label;
  avatar.setAttribute("role", "img");
  avatar.setAttribute("aria-label", label);
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.hidden = true;
  initial.setAttribute("aria-hidden", "true");
  initial.textContent = author.name.trim().charAt(0).toUpperCase();

  function loadNextAvatar() {
    const avatarUrl = pendingUrls.shift();

    if (!avatarUrl) {
      image.removeAttribute("src");
      image.hidden = true;
      initial.hidden = false;
      return;
    }

    image.src = avatarUrl;
  }

  image.addEventListener("load", function () {
    image.hidden = false;
    initial.hidden = true;
  });
  image.addEventListener("error", loadNextAvatar);

  avatar.append(image, initial);
  loadNextAvatar();
  return avatar;
}

function updateFileHistory(history) {
  if (!history) {
    fileHistory.hidden = true;
    authorAvatars.replaceChildren();
    return;
  }

  authorAvatars.replaceChildren(...history.authors.map(createAuthorAvatar));
  changedAt.textContent = formatRelativeTime(history.changedAt);
  changedAt.dateTime = history.changedAt;
  changedAt.title = new Date(history.changedAt).toLocaleString();
  fileHistory.hidden = false;
}

// Preview
let previewTimeout = null;

function schedulePreviewUpdate() {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(updatePreview, 150);
}

function updatePreview() {
  const content = getEditorContent();
  preview.innerHTML = marked.parse(content);

  // Re-highlight code blocks
  if (config.preview.syntaxHighlighting) {
    preview.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  syncPreviewFromEditor();
}

// File operations
async function loadFiles() {
  try {
    const response = await fetch("/api/files");
    const files = await response.json();
    renderFileTree(files);

    if (config.files.openReadme) {
      const readme = files.find(
        (item) => !item.isDirectory && item.path.toLowerCase() === "readme.md",
      )?.path;
      if (readme) {
        await openFile(readme);
      }
    }
  } catch (error) {
    console.error("Failed to load files:", error);
    fileTree.innerHTML = '<div class="loading">Failed to load files</div>';
  }
}

function renderFileTree(items, depth = 0) {
  if (depth === 0) {
    fileTree.innerHTML = "";
    if (items.length === 0) {
      fileTree.innerHTML = '<div class="loading">No markdown files found</div>';
      return;
    }
  }

  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const el = document.createElement("div");
    el.className = `tree-item ${item.isDirectory ? "directory" : "file"}`;
    el.setAttribute("data-depth", depth);
    el.setAttribute("data-path", item.path);

    const icon = document.createElement("span");
    icon.className = "icon";
    icon.textContent = item.isDirectory ? "\u25B6" : "\uD83D\uDCC4";

    const name = document.createElement("span");
    name.textContent = item.name;

    el.appendChild(icon);
    el.appendChild(name);

    if (item.isDirectory) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        const childContainer = el.nextElementSibling;
        if (childContainer && childContainer.classList.contains("tree-children")) {
          const isExpanded = childContainer.classList.toggle("expanded");
          icon.textContent = isExpanded ? "\u25BC" : "\u25B6";
        }
      });

      fragment.appendChild(el);

      if (item.children && item.children.length > 0) {
        const childContainer = document.createElement("div");
        childContainer.className = "tree-children";

        const childItems = renderFileTree(item.children, depth + 1);
        childContainer.appendChild(childItems);
        fragment.appendChild(childContainer);
      }
    } else {
      el.addEventListener("click", function () {
        openFile(item.path);
      });
      fragment.appendChild(el);
    }
  }

  if (depth === 0) {
    fileTree.appendChild(fragment);
  }

  return fragment;
}

async function openFile(path) {
  if (isDirty && currentFile) {
    const confirmSave = confirm("You have unsaved changes. Save before switching?");
    if (confirmSave) {
      await saveFile();
    }
  }

  try {
    fileHistory.hidden = true;
    const response = await fetch("/api/file?path=" + encodeURIComponent(path));
    const data = await response.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    currentFile = path;
    isDirty = false;

    // Update UI
    currentFileEl.textContent = path;
    updateFileHistory(data.history);
    saveBtn.disabled = false;
    updateSaveStatus();

    // Update active state in tree
    document.querySelectorAll(".tree-item.active").forEach(function (el) {
      el.classList.remove("active");
    });
    const activeItem = document.querySelector('.tree-item[data-path="' + CSS.escape(path) + '"]');
    if (activeItem) {
      activeItem.classList.add("active");
    }

    // Load content into editor
    createEditor(data.content);
    updatePreview();
  } catch (error) {
    console.error("Failed to open file:", error);
    alert("Failed to open file");
  }
}

async function saveFile() {
  if (!currentFile) return;

  try {
    setSaveStatus("saving");

    const response = await fetch("/api/file?path=" + encodeURIComponent(currentFile), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: getEditorContent(),
      }),
    });

    const data = await response.json();

    if (data.error) {
      setSaveStatus("error");
      alert(data.error);
      return;
    }

    isDirty = false;
    updateSaveStatus();
  } catch (error) {
    console.error("Failed to save file:", error);
    setSaveStatus("error");
  }
}

function setSaveStatus(state) {
  if (!state) {
    saveStatus.removeAttribute("data-save-state");
    saveStatus.removeAttribute("title");
    saveStatusText.textContent = "";
    return;
  }

  const label = getSaveStatusLabel(state);
  saveStatus.setAttribute("data-save-state", state);
  saveStatus.title = label;
  saveStatusText.textContent = label;
}

function updateSaveStatus() {
  if (!currentFile) {
    setSaveStatus(null);
    return;
  }

  if (isDirty) {
    setSaveStatus("unsaved");
  } else {
    setSaveStatus("saved");
  }
}

// Auto-save
function scheduleAutoSave() {
  clearTimeout(saveTimeout);
  if (!config.editor.autosave) {
    return;
  }
  saveTimeout = setTimeout(async function () {
    if (isDirty && currentFile) {
      await saveFile();
    }
  }, config.editor.autosaveDelayMs);
}

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    if (currentFile) {
      saveFile();
    }
  }
});

// Handle beforeunload
window.addEventListener("beforeunload", function (e) {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

saveBtn.addEventListener("click", saveFile);

// Initialize
async function init() {
  const response = await fetch("/api/config");
  config = await response.json();
  configureMarkdown();
  initTheme();
  setViewMode(config.ui.view);
  createEditor("");
  await loadFiles();
}

init().catch(function (error) {
  console.error("Failed to initialize LocalMD:", error);
  fileTree.innerHTML = '<div class="loading">Failed to initialize LocalMD</div>';
});
