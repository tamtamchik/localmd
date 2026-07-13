// State
let currentFile = null;
let editor = null;
let isDirty = false;
let saveTimeout = null;

// DOM elements
const fileTree = document.getElementById("file-tree");
const currentFileEl = document.getElementById("current-file");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const preview = document.getElementById("preview");
const themeToggle = document.getElementById("theme-toggle");
const editorContainer = document.getElementById("editor");

// Configure marked
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true,
});

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem("localmd-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateHljsTheme(savedTheme);
  updateEditorTheme(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("localmd-theme", next);
  updateHljsTheme(next);
  updateEditorTheme(next);
}

function updateHljsTheme(theme) {
  document.getElementById("hljs-light").disabled = theme === "dark";
  document.getElementById("hljs-dark").disabled = theme === "light";
}

function updateEditorTheme(theme) {
  if (editor) {
    editor.setOption("theme", theme === "dark" ? "one-dark" : "default");
  }
}

function isDarkMode() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

themeToggle.addEventListener("click", toggleTheme);

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
    theme: isDarkMode() ? "one-dark" : "default",
    lineNumbers: true,
    lineWrapping: true,
    autofocus: true,
  });

  editor.on("change", function () {
    isDirty = true;
    updateSaveStatus();
    schedulePreviewUpdate();
    scheduleAutoSave();
  });

  // Set editor height
  editor.setSize("100%", "100%");
}

function getEditorContent() {
  return editor ? editor.getValue() : "";
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
  preview.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });
}

// File operations
async function loadFiles() {
  try {
    const response = await fetch("/api/files");
    const files = await response.json();
    renderFileTree(files);
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

        const childItems = renderFileTreeItems(item.children, depth + 1);
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

function renderFileTreeItems(items, depth) {
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

        const childItems = renderFileTreeItems(item.children, depth + 1);
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
    saveStatus.textContent = "Saving...";
    saveStatus.className = "save-status";

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
      saveStatus.textContent = "Save failed";
      alert(data.error);
      return;
    }

    isDirty = false;
    updateSaveStatus();
  } catch (error) {
    console.error("Failed to save file:", error);
    saveStatus.textContent = "Save failed";
  }
}

function updateSaveStatus() {
  if (!currentFile) {
    saveStatus.textContent = "";
    return;
  }

  if (isDirty) {
    saveStatus.textContent = "Unsaved changes";
    saveStatus.className = "save-status";
  } else {
    saveStatus.textContent = "Saved";
    saveStatus.className = "save-status saved";
  }
}

// Auto-save
function scheduleAutoSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async function () {
    if (isDirty && currentFile) {
      await saveFile();
    }
  }, 2000);
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
initTheme();
createEditor("");
loadFiles();
