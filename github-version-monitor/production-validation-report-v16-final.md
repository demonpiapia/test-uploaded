# Production Validation Report — SKILL-v1.6 Clean-Room Final Validation

## A. Environment

```text
OS: Microsoft Windows NT 10.0.22621.0
PowerShell: 7.6.4 (harness) / 5.1.22621.963 Desktop (SKILL execution, all tests)
PowerShell Edition: Core (recording shell) — SKILL steps executed under Desktop 5.1 via powershell.exe
Architecture: AMD64
CurrentUser: desktop-mbfj1to\jasonpc
WorkingDirectory: D:\AI
SKILL path: d:\AI\Workspace\automatic\github-version-monitor\SKILL-v1.6.md
Test root: d:\AI\Workspace\automatic\github-version-monitor\.production-validation-v16-final
GitHub API reachable: YES (rate_limit core limit=60 remaining=60 at session start)
GITHUB_TOKEN: set (value never emitted; tests T41/T04 ran with token explicitly cleared)
OLD_TEST_EVIDENCE_USED_AS_CURRENT_PASS = NO
```

## B. Version / SHA256

```text
SKILL_SHA256: 7480B6B5E34BDD8B2F07552F8B174F41421BB7BF3537A8486DF35A9BC3F55CD7
File not modified during validation (hash basis for all executed step scripts, which were
regex-extracted fresh from this file at runtime into scripts\step1..5 + full/fetch/fetch-review).
```

## C. v1.5 → v1.6 diff (T44)

`v15-v16.diff` (git diff --no-index, 67 lines). The complete delta is:

1. `> 版本：v1.6` banner (cosmetic).
2. §4 invariant 6/§5.1/§4-12 prose: flag comparison must be case-sensitive (documentation of the fix).
3. step2 line ~406: `$c[5] -notmatch` → `-cnotmatch`.
4. step2 stats: `Where-Object flag -eq 'yes'` → `Where-Object { $_.flag -ceq 'yes' }`.
5. step5: `badFlag` rewritten to per-cell case-sensitive validation; header compare `-eq` → `-ceq`.
6. Changelog entry for v1.6.

No mock URLs, no debug bypasses, no test-only branches, no credential material, no hardcoded test repositories.

```text
DIFF_CHECK = PASS
```

## D. Test Summary T01–T45

| Test | Status | Method / Evidence |
|---|---|---|
| T01 normal 200 | PASS | real API (vscode), ok + latest + publishedUtc + COMMIT_OK (`T01-batch`) |
| T02 404 | PASS | real nonexistent repo → not_found/gitVer=""/gitDate=""/flag preserved/reason not_found |
| T03 401 | PASS | invalid bearer → auth_error + state preserved + review=true |
| T04 403+RLR:0 | **FAIL** | local CONNECT mock proxy → got **forbidden**, expected rate_limited (see §E) |
| T05 403+RLR>0 | PASS | mock proxy 403+4998 → forbidden |
| T06 429 | PASS | mock proxy 429 → rate_limited |
| T07 5xx | PASS | mock proxy 500 → server_error |
| T08 network error | PASS | drop proxy (no HTTP response) → network_error + state preserved + review=true |
| T09 200 no tag_name | BLOCKED | requires TLS MITM with trusted cert for api.github.com (not safely achievable) |
| T10 200 no published_at | BLOCKED | same MITM limitation |
| T11 normal upgrade | PASS | real API, cmp=lt/flag=yes/isNew=true |
| T12 numeric compare | PASS | SKILL-extracted `Compare-Ver` executed under PS 5.1: 1.2.10>1.2.9=gt, reverse lt, rc1<stable, incomparable |
| T13 prerelease < stable | PASS | real API, local=7.6.5-rc1 vs latest v7.6.5 → lt/yes |
| T14 unsupported | PASS | real API, `not-a-version` → incomparable + review + flag preserved |
| T15 versionJump boundary | PASS | 3 real runs on PowerShell/PowerShell: major diff 1→no jump, 2→jump(threshold), 3→jump |
| T16 dateSuspicious | PASS | prev gitDate = published Beijing date +1d → dateSuspicious=true/review=true |
| T17 isFlip | PASS | prevFlag=no + lt → flag=yes + isFlip=true |
| T18 state preservation | BLOCKED | 6/8 statuses verified preserved (auth_error/forbidden/rate_limited/server_error/network_error/http_error-418); invalid_response + metadata_incomplete unreachable without MITM |
| T19 uninstalled | PASS | real API, flag=no but gitVer/gitDate refreshed |
| T20 result.json atomicity | PASS | exclusive lock on result.fetch.tmp → old result.json SHA256 unchanged, lock retained |
| T21 review atomicity | PASS | exclusive lock on result.review.tmp → REVIEW_WRITE_ERROR, result.json valid, lock released |
| T22 md temp write | PASS | exclusive lock on md.tmp → main md unchanged, lock retained |
| T23 md Move-Item | PASS | shared-read lock on main md → VALIDATE_ERROR, md unchanged, RUN_STATUS\|failed\|, lock released |
| T24 5 columns | PASS | PARSE_ERROR, md unchanged |
| T25 7 columns | PASS | PARSE_ERROR, md unchanged |
| T26 illegal flag ×6 | PASS | YES/Yes/NO/No/pending/true all → PARSE_ERROR (case-sensitive confirmed) |
| T27 duplicate repo | PASS | PARSE_ERROR |
| T28 illegal index | PASS | PARSE_ERROR |
| T29 missing anchor ×4 | PASS | each of 结论/更新摘要/备注/核对方法 removed → PARSE_ERROR |
| T30 concurrency | PASS | two real simultaneous processes: exactly 1× RUN_STATUS\|success\| + 1× LOCKED |
| T31 heartbeat | PASS | run.lock contains pid/start/step=2/beat |
| T32 live lock | PASS | foreign fresh lock (alive PID) → LOCKED |
| T33 stale+alive | PASS | heartbeat>30min + PID alive → LOCKED (no takeover) |
| T34 stale+dead | PASS | heartbeat>30min + PID dead → takeover, BACKUP_OK+FETCH_COMPLETE |
| T35 ownership mismatch | PASS | step2 with foreign lock → RUNTIME_ERROR, lock preserved with foreign pid |
| T36 process kill | PASS | Stop-Process at 1800ms → lock retained, md unchanged, backup kept, result.json absent (no corruption) |
| T37 success round | PASS | BACKUP_OK/FETCH_COMPLETE/SUMMARY/REVIEW_WRITE_OK/COMMIT_OK/RUN_STATUS\|success\| + lock released |
| T38 review failure | PASS | REVIEW_WRITE_ERROR, no COMMIT_OK, md untouched |
| T39 commit+release failure | PASS | COMMIT_OK + RUNTIME_ERROR + RUN_STATUS\|failed\| (never success), lock held at release |
| T40 blocked semantics | PASS | STATE_MISSING (no lock side effect) + LOCKED |
| T41 token unset | PASS | stats.token=unset |
| T42 token set | PASS | stats.token=set |
| T43 extended pipeline | PASS | 6 real-repo scenarios + md↔result.json flag consistency (6/6) + backup/log/lock checks |
| T44 diff integrity | PASS | see §C |
| T45 no contamination | PASS | regex scan: NO_CONTAMINATION_FOUND |

```text
TOTAL   = 45
PASS    = 41
FAIL    = 1
BLOCKED = 3
PASS + FAIL + BLOCKED = 45
```

## E. Critical Findings

### P0 = 0

### P1 = 1 — T04: `rate_limited` is unreachable under Windows PowerShell 5.1

- Injected condition (external CONNECT proxy, no SKILL modification): HTTP 403 with `X-RateLimit-Remaining: 0`.
- Observed: `queryStatus=forbidden` (expected `rate_limited`).
- Root cause (probe evidence, `probe-t04-result.txt`, PS 5.1 Desktop):
  - `System.Net.WebHeaderCollection` has **no** `TryGetValues` method (reflection: False).
  - `$_.Exception.Response` is `System.Net.HttpWebResponse`; `StatusCode=403`; header `X-RateLimit-Remaining=0` **is present** in `Headers`.
  - `$resp.Headers.TryGetValues('X-RateLimit-Remaining',[ref]$v)` **throws**; the SKILL's inner `try{}catch{}` swallows it, `$rl` stays empty, and the 403 branch (`$status = if ($rl -eq '0') {'rate_limited'} else {'forbidden'}`) can never select `rate_limited` in this harness.
- Consequence: under PS 5.1, genuinely rate-limited items are misclassified as `forbidden`, which additionally sends them into step-4 evidence collection (1 list-API + 1 HTML request each) — the exact behavior the contract forbids for `rate_limited`.
- Under PowerShell 7 the exception carries `HttpHeaders` (which has `TryGetValues`), so the branch works there; the SKILL does not pin a harness edition and §12.9 already acknowledges cross-harness API divergence, so this is a SKILL-level defect, not an environment excuse.
- Remediation (NOT applied — SKILL untouched, per rules): read the header edition-safely, e.g. `$resp.Headers['X-RateLimit-Remaining']` for `HttpWebResponse` or edition check before `TryGetValues`.

### P2 = 0

## F. Evidence Index

All under `d:\AI\Workspace\automatic\github-version-monitor\.production-validation-v16-final\`:

- Per-test: `report-<TEST_ID>.md` + `<TEST_ID>\{stdout.txt, stderr.txt, md-before.md, md-after.md, result-after.json, lock-after.txt}` (plus `before/`/`after/` snapshots and per-process files where applicable).
- Fault injection: `injector.ps1`; mock proxy: `mockproxy.ps1`, `<TEST_ID>-proxy.out.txt`.
- Root cause probe: `probe-t04.ps1`, `probe-t04-bom.ps1`, `probe-t04-result.txt`, `probe-t04-proxy.out.txt`.
- Version integrity: `sha256.txt`, `v15-v16.diff`, `t45-contamination-scan.txt`, `environment.txt`.
- Harness: `lib-fin.ps1`, `run-a.ps1/run-a2/a3`, `run-b.ps1/run-b2`, `run-c.ps1/run-c2`, `run-t36.ps1`, `run-d.ps1`, `run-e.ps1`, `run-t18b.ps1`, `run-t43.ps1`, `build.ps1`, `setup.ps1`.

No token values or Authorization headers appear in any evidence file.

## G. Production Gate

```text
P0 = 0
P1 = 1        (T04)
FAIL = 1      (T04)
BLOCKED = 3   (T09, T10, T18)
=> PRODUCTION_GATE: CLOSED
=> PRODUCTION_NOT_READY
```

## H. Execution Summary

```text
有没有实际执行 PowerShell: YES（全部 45 项，SKILL 步骤在 powershell.exe 5.1.22621.963 下执行）
有没有实际访问 GitHub API: YES（T01/T02/T03/T11-T19/T37/T41/T42/T43 均为真实 API 调用）
有没有实际执行 mock HTTP: YES（本地 CONNECT 代理注入 403+RLR:0 / 403+RLR:4998 / 429 / 500 / 418；drop 模式注入无响应）
有没有实际执行 network fault injection: YES（T08 drop 代理命中 catch 无 HTTP response 路径）
有没有实际执行并发: YES（T30 两个真实进程同时启动）
有没有实际执行 process kill: YES（T36 Stop-Process 1800ms）
有没有实际测试 result.json 原子写入: YES（T20 SHA256 before/after）
有没有实际测试 review 原子写入: YES（T21）
有没有实际测试 md 原子提交: YES（T22/T23）
有没有实际测试 lock release failure: YES（T39 watcher 注入）
有没有实际测试 403 rate-limited: YES（结果 FAIL，见 P1）
有没有实际测试 403 forbidden: YES（PASS）
有没有实际测试 429: YES（PASS）
有没有实际测试 5xx: YES（PASS）
有没有实际测试 invalid_response: BLOCKED（需 TLS MITM）
有没有实际测试 metadata_incomplete: BLOCKED（需 TLS MITM）
```

## I. Remaining Limitations

1. T09/T10（200 但 body 异常）与 T18 的 invalid_response/metadata_incomplete 子项需要 TLS MITM（受信证书 + `api.github.com` SNI 伪造），无法在不污染机器信任库、不修改 SKILL 的前提下安全实现 → 保持 BLOCKED。
2. 本轮 mock 代理只在 PS 5.1 路径上验证（`HttpWebRequest` 遵循进程内 `DefaultWebProxy`）；pwsh 7 的 `SocketsHttpHandler` 对 CONNECT 失败抛出的异常不带 StatusCode，无法用同一手法注入精确状态码。
3. T04 的修复方案已定位（P1 建议项），但按验证规则本轮未修改 SKILL。
