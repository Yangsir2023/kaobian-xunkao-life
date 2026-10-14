/* 临时推送脚本：github.com 直连被代理阻断，改走 api.github.com Git Data API。
   用法：node _push_github.mjs （令牌从 .gh_token 读取，绝不进命令行）*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT = 'C:/Users/yangsir/WorkBuddy/2026-10-13-18-05-36/kaobian-xunkao-life';
const OWNER = 'Yangsir2023';
const REPO = 'kaobian-xunkao-life';
const BRANCH = 'main';
const TOKEN = readFileSync(join(ROOT, '.gh_token'), 'utf8').trim();
const API = 'https://api.github.com';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'data', '_data_test_backup', '_shots', '.workbuddy']);
const SKIP_FILES = new Set(['.gh_token', '.env']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('_data')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (!SKIP_FILES.has(name) && !name.endsWith('.log')) out.push(full);
  }
  return out;
}

function gitBlobSha(buf) {
  const header = Buffer.from(`blob ${buf.length}\0`, 'utf8');
  return createHash('sha1').update(Buffer.concat([header, buf])).digest('hex');
}

async function gh(path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'kaobian-push-script',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${(json && json.message) || text.slice(0, 200)}`);
  }
  return json;
}

async function main() {
  // 0. 敏感文件扫描（双保险，walk 已排除，这里再断言一次）
  const files = walk(ROOT);
  const bad = files.filter((f) => /(^|\/)(\.env|\.gh_token)(\/|$)|(^|\/)data\/|(^|\/)node_modules\//.test(f));
  if (bad.length) {
    console.error('敏感文件命中，终止推送：', bad);
    process.exit(1);
  }

  // 1. 取远端当前状态
  const ref = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const remoteCommitSha = ref.object.sha;
  const remoteCommit = await gh(`/repos/${OWNER}/${REPO}/git/commits/${remoteCommitSha}`);
  const baseTreeSha = remoteCommit.tree.sha;
  const remoteTree = await gh(`/repos/${OWNER}/${REPO}/git/trees/${baseTreeSha}?recursive=1`);
  const remoteMap = new Map(remoteTree.tree.filter((t) => t.type === 'blob').map((t) => [t.path, t.sha]));
  console.log(`远端 HEAD: ${remoteCommitSha.slice(0, 7)}，文件 ${remoteMap.size} 个`);

  // 2. 本地文件逐个算 blob sha，变化的才上传
  const entries = [];
  let uploaded = 0;
  let unchanged = 0;
  for (const full of files) {
    const rel = relative(ROOT, full).split(sep).join('/');
    const buf = readFileSync(full);
    const sha = gitBlobSha(buf);
    if (remoteMap.get(rel) === sha) {
      unchanged += 1;
      continue;
    }
    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
    const isBinary = BINARY_EXT.has(ext);
    const blob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, 'POST', {
      content: isBinary ? buf.toString('base64') : buf.toString('utf8'),
      encoding: isBinary ? 'base64' : 'utf-8',
    });
    entries.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
    uploaded += 1;
    console.log(`  ↑ ${rel}`);
  }
  console.log(`变化文件 ${uploaded} 个，未变 ${unchanged} 个`);

  if (uploaded === 0) {
    console.log('没有变化，无需推送');
    return;
  }

  // 3. 建 tree（base_tree 保住未变文件）→ commit → 更新 ref
  const tree = await gh(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', { base_tree: baseTreeSha, tree: entries });
  const message = execSync('git log -1 --pretty=%B', { cwd: ROOT, encoding: 'utf8' }).trim();
  const commit = await gh(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
    message,
    tree: tree.sha,
    parents: [remoteCommitSha],
  });
  await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', { sha: commit.sha });
  console.log(`推送完成：${commit.sha}`);
  console.log(`https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`);
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
