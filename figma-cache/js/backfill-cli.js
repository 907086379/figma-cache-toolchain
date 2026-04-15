/* eslint-disable no-console */

function collectMarkdownFiles(dir, deps) {
  if (!deps.fs.existsSync(dir)) {
    return [];
  }

  const output = [];
  const list = deps.fs.readdirSync(dir, { withFileTypes: true });
  list.forEach((entry) => {
    const fullPath = deps.path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...collectMarkdownFiles(fullPath, deps));
      return;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      output.push(fullPath);
    }
  });
  return output;
}

function extractFigmaUrls(content) {
  const pattern = /https:\/\/www\.figma\.com\/(?:file|design)\/[^\s)\]]+/g;
  return content.match(pattern) || [];
}

function backfillFromIterations(options, deps) {
  const files = collectMarkdownFiles(options.iterationsDir, deps);
  let hit = 0;

  files.forEach((filePath) => {
    const content = deps.fs.readFileSync(filePath, "utf8");
    const urls = extractFigmaUrls(content);
    urls.forEach((url) => {
      try {
        deps.upsertByUrl(url, { source: "backfill", completeness: [] });
        hit += 1;
      } catch {
        // 忽略无法解析的 URL
      }
    });
  });

  console.log(`Backfill done. scanned files=${files.length}, urls=${hit}`);
}

module.exports = {
  backfillFromIterations,
};