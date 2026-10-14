#!/usr/bin/env node
/**
 * 一键推送到 GitHub（把令牌从命令行/环境/文件里取出来，构造带凭据的 URL 推一次）。
 *
 * 为什么需要它：本机 git 没有缓存凭据、且非交互终端无法弹出账号密码框；
 * 而把令牌直接写进 remote URL 会留在 .git/config 里。这个脚本只在单次命令里
 * 使用令牌，且**全程不打印令牌**。
 *
 * 用法（任选一种传令牌）：
 *   node scripts/push-github.mjs --token ghp_xxx
 *   GH_TOKEN=ghp_xxx node scripts/push-github.mjs
 *   echo ghp_xxx > .gh_token && node scripts/push-github.mjs   # .gh_token 已在 .gitignore 里
 *
 * 可选：
 *   --branch main --remote origin --dry-run
 *   --expect <sha>   仅当远端仍停在该提交时才覆盖推送（等价 --force-with-lease=<分支>:<sha>）
 *   --force          覆盖推送（--force-with-lease；需本地已有远端跟踪引用）
 *
 * 什么情况要加 --expect：本地与远端是两条**互不相关**的历史（远端曾由另一份副本独立
 * 初始化过），此时普通推送会被拒绝。用 --expect <远端当前 sha> 可以安全覆盖：
 * 只要远端在你上次看到的那个提交上没被别处改过，才允许覆盖。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

function readToken() {
  const fromArg = arg('token');
  if (fromArg) return fromArg.trim();
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const file = resolve(process.cwd(), '.gh_token');
  if (existsSync(file)) {
    const raw = readFileSync(file, 'utf8').trim();
    if (raw) return raw;
  }
  return null;
}

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`git ${args[0]} 失败：${(err.stderr || err.message || '').toString().split('\n')[0]}`);
  }
}

/** 把 https://github.com/owner/repo.git 变成带令牌的形式；绝不打印令牌 */
function withToken(url, token) {
  const m = url.match(/^https:\/\/([^/]+)\/(.+?)(\.git)?$/);
  if (!m) throw new Error(`不支持的 remote 形式（需要 https://…）：${url}`);
  return `https://x-access-token:${token}@${m[1]}/${m[2]}${m[3] || '.git'}`;
}

function main() {
  const remoteName = arg('remote', 'origin');
  const branch = arg('branch', git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'main');
  const dryRun = hasFlag('dry-run');

  const dirty = git(['status', '--porcelain'], { allowFail: true });
  if (dirty) {
    console.error('⚠ 工作区有未提交改动，请先提交再推送：\n' + dirty.split('\n').slice(0, 10).join('\n'));
    process.exit(2);
  }

  const remoteUrl = git(['remote', 'get-url', remoteName]);
  const head = git(['rev-parse', '--short', 'HEAD']);
  const trackRef = `${remoteName}/${branch}`;
  const baseline = git(['rev-parse', '--verify', '--quiet', trackRef], { allowFail: true })
    ? trackRef
    : git(['rev-parse', '--verify', '--quiet', 'FETCH_HEAD'], { allowFail: true })
      ? 'FETCH_HEAD'
      : null;
  const ahead = baseline ? git(['rev-list', '--count', `${baseline}..HEAD`], { allowFail: true }) : null;

  console.log(`仓库    ${remoteUrl}`);
  console.log(`分支    ${branch}`);
  console.log(
    `提交    ${head}（相对 ${baseline || '远端'} 领先 ${ahead ?? '未知'} 个提交` +
      (baseline === 'FETCH_HEAD' ? '；基线取自上次 fetch' : '') +
      ')'
  );

  if (dryRun) {
    console.log('\n[dry-run] 未实际推送。');
    return;
  }

  const token = readToken();
  if (!token) {
    console.error(
      '\n缺少 GitHub 令牌。请任选一种方式提供后重跑：\n' +
        '  node scripts/push-github.mjs --token <PAT>\n' +
        '  GH_TOKEN=<PAT> node scripts/push-github.mjs\n' +
        '  echo <PAT> > .gh_token   # 已在 .gitignore 中，不会被提交\n' +
        '\n令牌需要 repo 权限（fine-grained 则给 Contents: Read and write）。'
    );
    process.exit(3);
  }

  // 用 -c 临时注入带令牌的 URL，不写进 .git/config
  const expect = arg('expect');
  const pushArgs = ['-c', `remote.${remoteName}.url=${withToken(remoteUrl, token)}`, 'push'];
  if (expect) {
    pushArgs.push(`--force-with-lease=${branch}:${expect}`);
    console.log(`覆盖校验  远端必须仍停在 ${expect.slice(0, 10)}`);
  } else if (hasFlag('force')) {
    pushArgs.push('--force-with-lease');
    console.log('覆盖校验  --force-with-lease（依赖本地远端跟踪引用）');
  }
  pushArgs.push(remoteName, `HEAD:${branch}`);

  try {
    git(pushArgs);
  } catch (err) {
    const msg = String(err.message || '');
    console.error(`\n✗ 推送失败：${msg}`);
    const remoteSha = git(['ls-remote', remoteName, `refs/heads/${branch}`], { allowFail: true });
    if (remoteSha) {
      const sha = remoteSha.split(/\s+/)[0];
      console.error(
        `\n远端 ${branch} 当前在 ${sha.slice(0, 10)}。` +
          `\n若上面提示 non-fast-forward / 历史不相关，说明远端与本地是两条独立历史，加参数重跑即可安全覆盖：` +
          `\n  node scripts/push-github.mjs --expect ${sha}`
      );
    }
    process.exit(1);
  }

  console.log(`\n✓ 已推送到 ${remoteUrl} 的 ${branch} 分支`);
  console.log(`  https://github.com/${remoteUrl.replace(/^https:\/\/[^/]+\//, '').replace(/\.git$/, '')}/tree/${branch}`);
}

main();
