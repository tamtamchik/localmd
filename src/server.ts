import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "path";

interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

async function getMarkdownFiles(dir: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  const glob = new Bun.Glob("**/*.md");

  for await (const path of glob.scan({ cwd: dir, onlyFiles: true })) {
    entries.push({
      path: path,
      name: path.split("/").pop() || path,
      isDirectory: false,
    });
  }

  // Sort alphabetically
  entries.sort((a, b) => a.path.localeCompare(b.path));

  // Build tree structure
  return buildTree(entries);
}

function buildTree(files: FileEntry[]): FileEntry[] {
  const root: FileEntry[] = [];
  const dirs: Map<string, FileEntry> = new Map();

  for (const file of files) {
    const parts = file.path.split("/");
    let currentLevel = root;
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

      if (!dirs.has(currentPath)) {
        const dirEntry: FileEntry = {
          path: currentPath,
          name: parts[i],
          isDirectory: true,
          children: [],
        };
        dirs.set(currentPath, dirEntry);
        currentLevel.push(dirEntry);
      }

      currentLevel = dirs.get(currentPath)!.children!;
    }

    currentLevel.push({
      path: file.path,
      name: parts[parts.length - 1],
      isDirectory: false,
    });
  }

  // Sort each level: directories first, then files, alphabetically
  const sortLevel = (entries: FileEntry[]) => {
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (entry.children) {
        sortLevel(entry.children);
      }
    }
  };

  sortLevel(root);
  return root;
}

export function isPathSafe(basePath: string, requestedPath: string): boolean {
  const resolvedBase = resolve(basePath);
  const resolvedPath = resolve(resolvedBase, requestedPath);

  return isResolvedPathSafe(resolvedBase, resolvedPath);
}

function isResolvedPathSafe(
  resolvedBase: string,
  resolvedPath: string,
  allowBase = false,
): boolean {
  const relativePath = relative(resolvedBase, resolvedPath);

  return (
    (allowBase || relativePath !== "") &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

export async function isPathSafeOnDisk(
  basePath: string,
  requestedPath: string,
): Promise<boolean> {
  if (!isPathSafe(basePath, requestedPath)) {
    return false;
  }

  try {
    const resolvedBase = await realpath(basePath);
    const requestedFullPath = resolve(basePath, requestedPath);

    try {
      const resolvedPath = await realpath(requestedFullPath);
      return isResolvedPathSafe(resolvedBase, resolvedPath);
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        return false;
      }

      const resolvedParent = await realpath(dirname(requestedFullPath));
      return isResolvedPathSafe(resolvedBase, resolvedParent, true);
    }
  } catch {
    return false;
  }
}

export function startServer(directory: string, port: number) {
  const publicDir = join(import.meta.dir, "public");

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      // API routes
      if (path.startsWith("/api/")) {
        return handleApi(req, url, directory);
      }

      // Serve static files from public directory
      let filePath = path === "/" ? "/index.html" : path;
      const staticFile = Bun.file(join(publicDir, filePath));

      if (await staticFile.exists()) {
        return new Response(staticFile, {
          headers: {
            "Content-Type": getContentType(filePath),
          },
        });
      }

      // Fallback to index.html for SPA routing
      return new Response(Bun.file(join(publicDir, "index.html")), {
        headers: { "Content-Type": "text/html" },
      });
    },
  });
}

async function handleApi(req: Request, url: URL, directory: string): Promise<Response> {
  const path = url.pathname;

  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    // GET /api/files - list all markdown files
    if (path === "/api/files" && req.method === "GET") {
      const files = await getMarkdownFiles(directory);
      return new Response(JSON.stringify(files), { headers });
    }

    // GET /api/file?path=... - read file content
    if (path === "/api/file" && req.method === "GET") {
      const filePath = url.searchParams.get("path");

      if (!filePath) {
        return new Response(JSON.stringify({ error: "Missing path parameter" }), {
          status: 400,
          headers,
        });
      }

      if (!isPathSafe(directory, filePath)) {
        return new Response(JSON.stringify({ error: "Invalid path" }), {
          status: 403,
          headers,
        });
      }

      const fullPath = join(directory, filePath);
      const file = Bun.file(fullPath);

      if (!(await file.exists())) {
        return new Response(JSON.stringify({ error: "File not found" }), {
          status: 404,
          headers,
        });
      }

      if (!(await isPathSafeOnDisk(directory, filePath))) {
        return new Response(JSON.stringify({ error: "Invalid path" }), {
          status: 403,
          headers,
        });
      }

      const content = await file.text();
      return new Response(JSON.stringify({ content, path: filePath }), { headers });
    }

    // PUT /api/file?path=... - save file content
    if (path === "/api/file" && req.method === "PUT") {
      const filePath = url.searchParams.get("path");

      if (!filePath) {
        return new Response(JSON.stringify({ error: "Missing path parameter" }), {
          status: 400,
          headers,
        });
      }

      if (!isPathSafe(directory, filePath)) {
        return new Response(JSON.stringify({ error: "Invalid path" }), {
          status: 403,
          headers,
        });
      }

      if (!(await isPathSafeOnDisk(directory, filePath))) {
        return new Response(JSON.stringify({ error: "Invalid path" }), {
          status: 403,
          headers,
        });
      }

      const fullPath = join(directory, filePath);
      const body: unknown = await req.json();

      if (
        !body ||
        typeof body !== "object" ||
        !("content" in body) ||
        typeof body.content !== "string"
      ) {
        return new Response(JSON.stringify({ error: "Missing content" }), {
          status: 400,
          headers,
        });
      }

      await Bun.write(fullPath, body.content);
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers,
    });
  } catch (error) {
    console.error("API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers,
    });
  }
}

function getContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };
  return types[ext || ""] || "application/octet-stream";
}
