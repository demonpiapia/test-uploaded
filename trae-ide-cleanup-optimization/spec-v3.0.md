# TRAE IDE 定期清理与优化 Spec

## Why

TRAE IDE（基于 VSCode 的便携模式）在长期使用中会积累大量临时文件、冗余备份、过时日志、扩展卸载残留和临时工作产物，导致文件系统臃肿、磁盘空间浪费、IDE 启动变慢。需要建立一套**可复用的系统性盘点-分类-清理流程**，定期执行以保持 IDE 精简运行。

## 目标特性

本规范定义一套**可重复执行的 TRAE IDE 维护流程**，每次执行均按统一标准完成：
1. 全量文件系统盘点
2. 文件分类标注
3. 垃圾文件识别与风险评估
4. 对话记录索引
5. 臃肿根源分析
6. 安全清理执行（含备份+回滚）

### Phase ↔ 目标特性 ↔ 产物文件映射

| Phase | 目标特性 | 产物文件 |
|---|---|---|
| Phase -1 | 中断恢复检查 | `$ProgressFile`（进度状态文件） |
| Phase -0.5 | Environment Discovery / Reconciliation（V3 §2 新增） | `environment/profile.yaml`（本机环境 Profile） |
| Phase 0 | 执行前预检 | Everything CLI 健康报告 + 磁盘空间报告 |
| Phase 1 | 全量文件系统盘点 | `inventory-*.csv`（10 份盘点 CSV：5 根目录 + 5 E 盘子路径，V2-13 修正） |
| Phase 2 | 文件分类、垃圾识别与对话记录索引 | `classification-*.csv` + `junk-*.csv` + 对话记录索引表 |
| Phase 3 | 臃肿根源分析与报告生成 | `report-$ExecutionId.md` + `baseline-$ExecutionId.json` |
| Phase 4 | 安全清理执行 | 事务日志 + 备份快照 + 清理执行报告 |

## 关键目录定义

| 区域 | 路径 | 角色 | 复杂度 | 从属关系 |
|---|---|---|---|---|
| **用户配置区** | `C:\Users\JasonPC\.trae-cn\` | 便携模式用户数据根目录 | 中 | 独立根目录 |
| **MCP 缓存区** | `C:\Users\JasonPC\.trae-cn\mcps\` | MCP server descriptor 运行时缓存 | 低 | ⊆ 用户配置区 |
| **安装区** | `D:\Trae CN\` | TRAE IDE 安装目录 | 高（大量二进制/DLL） | 独立根目录 |
| **安装区核心应用** | `D:\Trae CN\resources\app\` | 编译后的应用代码、内置扩展、模块 | 高 | ⊆ 安装区 |
| **复合工作区 1** | `D:\AI\Workspace` | 多 AI 复合工作区（含 CC-HAHA 等 AI 工作数据） | **极高**（多 AI 交叉） | 独立根目录 |
| **复合工作区 2** | `D:\workspace` | 多 AI 复合工作区（含 Abu/Claude-Code/Roo-code/goose/hermes/opencode/trae 等子项目） | **极高**（多 AI 交叉） | 独立根目录 |
| **E 盘用户目录** | `E:\Users\WIN_11\` | Windows 用户目录（用户配置 + 临时文件在 E 盘） | 高 | 独立根目录 |
| **E 盘 TRAE AppData** | `E:\Users\WIN_11\AppData\Roaming\Trae CN\` | TRAE 非 portable 模式遗留数据（日志/CKG/WebView/VMCache） | 高 | ⊆ E 盘用户目录 |

> **排除**：F 盘为外置硬盘，**不需要盘点**。
> **注意**：两个复合工作区是多个 AI 工具（TRAE、Claude Code、Roo Code、Goose、Hermes、OpenCode 等）的共享工作空间，结构极其复杂庞大。盘点时必须逐目录仔细扫描，不可跳过任何子目录。
> **清理范围声明**：本 spec 的清理范围限于 TRAE IDE 直接相关的文件（配置、缓存、日志、扩展残留）。工作区中其他 AI 工具（Claude CLI、Abu 等）的缓存仅在影响磁盘空间时纳入盘点报告，**不自动清理**，单独列出供用户决策。

## 工具约束

> **P2-6 环境前提**：Engram MCP 为可选增强，用于进度状态的双重保障（文件系统 + 记忆库）。换 Agent 环境时（如非 TRAE IDE），以文件系统进度文件 `$ProgressFile` 为唯一恢复通道，不依赖 Engram。

### 搜索工具使用规则（Engram #617，用户认可）

| 场景 | 主搜索工具 | 校验方式 | 说明 |
|---|---|---|---|
| **系统级查询** | Everything CLI | 不需要 | 直接用 Everything，不走 Glob/Grep |
| **工作区文件名搜索** | Glob | Everything CLI 校验结果数量 | `Glob *.py` → `es.exe ext:py -path "同目录"` 比对 |
| **工作区内容搜索** | Grep | Everything 先校验文件列表完整，再信任 Grep | 两步校验：先确认文件不缺，再信任内容结果 |
| **关键决策搜索** | Everything CLI | 不需要 | 搜索结果影响判断/决策时，直接用 Everything，绕过 Glob/Grep |

**禁止项**：
- **SearchCodebase**：未经用户授权禁止使用
- **Glob/Grep 用于系统级查询**：禁止（工作区范围工具，曾导致错误判断"未安装 Chrome"）
- 具体是 Glob 还是 Grep 产生了历史错误无法确认（4 字符工具，用户也不确定），因此两者均纳入校验制

**校验不一致处置规则**：当 Glob/Grep 结果与 Everything CLI 校验结果数量不一致时，**以 Everything CLI 为准**，记录差异到执行报告，标注差异文件供人工复核。

#### Everything CLI 健康预检（执行前必做）

```powershell
# 1. 确认 es.exe 可执行
& "D:\Program Files\Everything\es.exe" -version

# 2. 确认索引服务在线（测试查询）
& "D:\Program Files\Everything\es.exe" -path "C:\Windows" -n 1

# 3. 开关自检：确认本计划使用的开关均可用（P2-5 新增）
#    本计划使用开关清单：-path -size -date-modified -s -export-csv -n /ad
& "D:\Program Files\Everything\es.exe" -h  # 列出所有可用开关，人工比对清单
```

若健康预检失败，终止执行，向用户报告 Everything 索引服务不可用。

#### Everything CLI 超时与重试机制（N6 新增，V3 §14/§16/§17 重写）

每条 `es.exe` 命令必须包裹超时控制和重试逻辑。V3 要求：

1. **§14**：所有 `es.exe` 调用统一收敛到 `Invoke-EverythingQuery`，文档中的裸 `es.exe` 命令仅表示参数语义
2. **§16**：返回结构化状态对象（`[pscustomobject]`），不返回裸文本
3. **§17**：临时输出文件使用 `PID + GUID`，避免并发查询输出竞争

```powershell
function Invoke-EverythingQuery {
    param(
        [string[]]$EsArgs,
        [int]$TimeoutSec = 120,
        [int]$MaxRetries = 3
    )
    $esPath = "D:\Program Files\Everything\es.exe"
    for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
        # §17: 唯一临时文件（PID + GUID）
        $guid = [guid]::NewGuid().ToString()
        $out = "$env:TEMP\es-out-$PID-$guid.txt"
        $err = "$env:TEMP\es-err-$PID-$guid.txt"
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $p = Start-Process -FilePath $esPath -ArgumentList $EsArgs `
                 -NoNewWindow -PassThru `
                 -RedirectStandardOutput $out `
                 -RedirectStandardError $err
            if (-not $p.WaitForExit($TimeoutSec * 1000)) {
                if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
                $sw.Stop()
                if ($attempt -lt $MaxRetries) { Start-Sleep -Seconds (5 * $attempt); continue }
                # §16: 超时返回结构化状态
                return [pscustomobject]@{
                    Success = $false
                    Status  = 'TIMEOUT'
                    ExitCode = $p.ExitCode
                    Stdout  = $null
                    Stderr  = "Timeout after ${TimeoutSec}s"
                    OutputFile = $out
                    DurationMs = $sw.ElapsedMilliseconds
                    Attempts = $attempt
                }
            }
            $sw.Stop()
            $stdout = Get-Content $out -ErrorAction SilentlyContinue
            $stderr = Get-Content $err -ErrorAction SilentlyContinue
            # 清理临时文件
            Remove-Item $out, $err -Force -ErrorAction SilentlyContinue
            # §16: 结构化返回 + 状态分类
            $status = if ($p.ExitCode -eq 0 -and $stdout) { 'SUCCESS' }
                      elseif ($p.ExitCode -eq 0 -and -not $stdout) { 'EMPTY_RESULT' }
                      elseif ($p.ExitCode -ne 0) { 'PROCESS_ERROR' }
                      else { 'UNKNOWN_ERROR' }
            return [pscustomobject]@{
                Success = ($p.ExitCode -eq 0)
                Status  = $status
                ExitCode = $p.ExitCode
                Stdout  = $stdout
                Stderr  = $stderr
                OutputFile = $null
                DurationMs = $sw.ElapsedMilliseconds
                Attempts = $attempt
            }
        } catch {
            $sw.Stop()
            if ($attempt -lt $MaxRetries) { Start-Sleep -Seconds (5 * $attempt); continue }
            return [pscustomobject]@{
                Success = $false
                Status = 'PROCESS_ERROR'
                ExitCode = -1
                Stdout = $null
                Stderr = $_.Exception.Message
                OutputFile = $null
                DurationMs = $sw.ElapsedMilliseconds
                Attempts = $attempt
            }
        }
    }
}
# 调用示例：
# $r = Invoke-EverythingQuery -EsArgs @('ext:tmp;log;bak', '-path', 'D:\AI\Workspace')
# if ($r.Success) { $r.Stdout | ForEach-Object { ... } } else { Write-Warning $r.Status }
```

> **§16 状态枚举**：`SUCCESS` | `EMPTY_RESULT` | `TIMEOUT` | `PROCESS_ERROR` | `INVALID_ARGUMENT` | `IPC_ERROR` | `EXPORT_ERROR` | `UNKNOWN_ERROR`

#### 空结果三分类（N12 新增，V3 §19 重写）

不再简单地将"0 结果"等同于"索引不完整"。按三种情况区分：

| 情况 | 条件 | 状态码 | 处置 |
|---|---|---|---|
| 路径不存在 | `Test-Path` 返回 `$false` | `PATH_UNAVAILABLE` | 跳过，报告磁盘可能未挂载 |
| 路径存在 + 查询成功 + 0 行 | `Test-Path` = `$true`, `Status` = `SUCCESS`/`EMPTY_RESULT`, 行数 = 0 | `VALID_EMPTY` | 正常，目录确实无匹配文件 |
| 路径存在 + 查询失败 | `Test-Path` = `$true`, `Status` ≠ `SUCCESS` | `QUERY_FAILURE` / `QUERY_TIMEOUT` | 报告 Everything 查询失败，不与"空目录"混淆 |

```powershell
# 查询前先验证路径存在
if (-not (Test-Path $TargetPath)) {
    Write-Warning "PATH_UNAVAILABLE: 路径不存在，可能磁盘未挂载: $TargetPath"
    continue
}
# 执行查询
$r = Invoke-EverythingQuery -EsArgs $queryArgs
if (-not $r.Success) {
    Write-Warning "$($r.Status): Everything 查询失败 for $TargetPath — Stderr: $($r.Stderr)"
} elseif ($null -eq $r.Stdout -or $r.Stdout.Count -eq 0) {
    # VALID_EMPTY: 路径存在但无匹配文件，正常情况
    Write-Verbose "VALID_EMPTY: $TargetPath 无匹配文件"
}
```

#### 符号链接处理策略（N13 新增）

- Everything CLI 默认跟随符号链接和 NTFS 联接点
- 盘点时：记录符号链接路径但**不跟随**（用 `es.exe -no-links`（需版本核实支持此开关）或在结果中检出 reparse point 记录路径、不跟随、排除重复计数）
- 备份时：保留链接本身（`robocopy /E /XJ /SL` 排除联接点、保留符号链接本身，不复制目标）
- 统计时：去重——同一 inode 的文件只计一次

#### Everything CLI 常用命令

```powershell
# 列出某路径下所有文件（含大小和修改时间）
& "D:\Program Files\Everything\es.exe" -path "C:\Users\JasonPC\.trae-cn" -size -date-modified -s

# 仅列出目录
& "D:\Program Files\Everything\es.exe" /ad -path "D:\workspace"

# 导出 CSV（含完整路径、大小、修改时间）
& "D:\Program Files\Everything\es.exe" -path "C:\Users\JasonPC\.trae-cn" -size -date-modified -export-csv "$InventoryDir\trae-config.csv"

# 按扩展名搜索（仅扩展名，不混入非扩展名模式）
& "D:\Program Files\Everything\es.exe" ext:db -path "C:\Users\JasonPC\.trae-cn"

# 搜索日志文件
& "D:\Program Files\Everything\es.exe" ext:log -path "D:\AI\Workspace"

# 搜索临时文件（按扩展名）
& "D:\Program Files\Everything\es.exe" ext:tmp;log;bak -path "D:\AI\Workspace"

# 搜索缓存目录/文件（按文件名模式，非 ext:）
& "D:\Program Files\Everything\es.exe" "cache" -path "C:\Users\JasonPC\.trae-cn" -s
```

> **注意**：`ext:` 语法仅用于文件扩展名（如 log/tmp/bak/db）。按文件名或目录名搜索时不使用 `ext:`，直接用关键词。

### 子 Agent 派遣约束

- **严格串行**：一律单子 agent 串行派遣，**严禁并行派出多个子 agent**
- 原因：多 agent 并行曾导致工具调用串包/截断/静默丢弃（Engram #334 记录）
- 每个子 agent 完成后返回结果，主 agent 确认后再派下一个

## 文件分类标准

### 分类矩阵

| 分类 | 定义 | 识别规则 | 清理策略 |
|---|---|---|---|
| **A-核心功能文件** | IDE 运行必需的二进制、编译输出、内置扩展 | 安装区 `resources/app/out/`、`resources/app/extensions/`、`resources/app/modules/`、根目录 DLL/EXE | **不可删除** |
| **B-配置文件** | 用户设置、权限规则、MCP 配置 | TRAE 配置区内**明确属于功能性配置的白名单文件**（V3 §8 修正：不再使用"所有 JSON"宽泛规则）。`protected_config_paths`: `hooks.json`、`sandbox.json`、`argv.json`、`permission/global.json`、`extensions/extensions.json`、`skill-config.json`。工作区中的 JSON **不归入 B 类**，按路径上下文归入 C 或 D | **保留当前版本**，清理历史备份 |
| **C-用户数据文件** | 用户技能、规则、记忆、对话记录 | TRAE 配置区：`skills/`、`user_rules/`、`memory/`、`commands/`、`design_libraries/`。工作区：`sessions/`、`agents/`、`.learnings/`、`.workbuddy/`、`projects/`、`cc-haha/`、`.abu/skills/`、`memory/` | **保留**，按需归档 |
| **D-临时文件** | 运行期产生、可安全重建的文件 | `*.log`、`work/` 临时产物、`feifei-ii-test-mock/`、`*.cleanup` 标记、`.runtime/venv/`、`Cache/` | **可清理**，受年龄阈值约束（见下文），清理前确认无活跃进程引用 |
| **E-冗余/残留文件** | 备份残留、过时缓存、卸载残留 | `*.backup.*`、`*.备份.*`、过期 MCP 缓存、旧模式设置文件 | **可清理**，清理前备份 |
| **F-扩展残留** | VSCode 扩展卸载后遗留 | `extensions/` 下无对应 `extensions.json` 条目的目录、`.obsolete` 标记的扩展 | **可清理**，需核对 extensions.json |

> **P3-8 修正**：`.obsolete` 统一归入 **F-扩展残留**（本质是扩展卸载标记），E-冗余行不再包含 `.obsolete`。

### 混合目录分解规则（P3-3 修正）

当目录标记为 `[C/D-混合]` 时，按以下规则对**目录内每个文件**逐一判定分类：

1. **按扩展名优先判定**：
   - `*.log` / `*.tmp` → D-临时
   - `*.backup.*` / `*.备份.*` → E-冗余
   - `*.db` / `*.sqlite` → C-用户数据（对话记录）
   - `*.json` 在 `sessions/`、`projects/` 下 → C-用户数据
   - `*.json` 在根目录或 `automatic/` 下 → D-临时（测试数据）
2. **按子路径上下文判定**：
   - `.runtime/venv/` → D-临时（Python 虚拟环境）
   - `backups/` → E-冗余
   - `memory/`、`.learnings/`、`agents/`、`sessions/`、`skills/` → C-用户数据
3. **默认倾向**：无法明确判定时，混合目录内文件**默认归入 C-用户数据**（保守策略，避免误删用户数据）

> 此规则确保"每个文件有且仅有一个分类标签"的要求可执行。

### 规则匹配优先级（P3-2 修正）

当同一文件匹配多条 RULE_JUNK 时，按**specific > general** 原则仲裁：

1. **路径限定规则** > 通用规则（如 `RULE_JUNK_TRAE_APPDATA_LOGS` > `RULE_JUNK_LOG`）
2. **文件名模式限定规则** > 扩展名规则（如 `RULE_JUNK_BUILD_LOG` > `RULE_JUNK_LOG`）
3. **扩展名规则** > 通用备份规则
4. 匹配结果记录为"命中规则 X（优先于 Y）"

### 垃圾文件识别规则（可复用，共 21 条）

```
RULE_JUNK_BACKUP:
  匹配模式: *.backup.* | *.备份.* | *.bak
  风险等级: 低（已有当前版本）
  清理策略: 保留最近 1 份，删除其余

RULE_JUNK_LOG:
  匹配模式: *.log | *.log.*
  风险等级: 低（日志可重建）
  年龄阈值: 保留最近 7 天（可配置）
  清理策略: 仅清理 LastWriteTime < (当前时间 - 7天) 的日志，非活跃会话期执行

RULE_JUNK_OBSOLETE:
  匹配模式: .obsolete 文件 + extensions.json 中无对应条目的扩展目录
  风险等级: 中（需确认扩展确已卸载）
  清理策略: 核对后删除目录 + 清理 .obsolete

RULE_JUNK_TEMP_WORK:
  匹配模式: work/ 下的临时脚本、ZIP 包、测试文件
  风险等级: 中（需人工确认无未完成工作）
  清理策略: 逐项确认后删除

RULE_JUNK_MCP_CACHE:
  匹配模式: mcps/ 下过期 session 的 descriptor 缓存
  风险等级: 低（运行时缓存，可重建）
  当前 session 判定方法:
    1. 检查 TRAE 进程命令行参数提取 session ID: `Get-CimInstance Win32_Process -Filter "Name LIKE 'Trae%'" | Select-Object ProcessId, CommandLine`
    2. 或读取 `permission/global.json` 的 `mcpRules` 字段获取当前启用的 MCP server
    3. 或比对 mcps/ 下目录的最后修改时间，最近活跃的为当前 session
  清理策略: 非当前 session 的缓存可清理

RULE_JUNK_TEST_MOCK:
  匹配模式: feifei-ii-test-mock/ 整个目录
  风险等级: 低（测试 mock 数据）
  清理策略: 直接清理

RULE_JUNK_PRODUCT_BACKUP:
  匹配模式: 安装区 product.json.backup.*
  风险等级: 低（安装区自带当前版本）
  清理策略: 直接清理

RULE_JUNK_WORKSPACE_TEMP:
  匹配模式: 工作区下的 *.txt 输出文件、*.ps1 临时扫描脚本、*.json 测试数据
  适用路径: D:\AI\Workspace, D:\workspace
  风险等级: 中（需人工确认无未完成工作引用）
  年龄阈值: 保留最近 14 天（可配置）
  清理策略: 逐项确认后删除
  V3 §11 证据要求（必须满足 ≥ 2 项证据方可列入候选）：
    1. 路径上下文（如 work/ 临时产物目录、intermediate/ 中间产物）
    2. 文件命名模式（如 scan_output_*, test_*, tmp_*）
    3. 生命周期标记（如 .cleanup 标记、明确生成工具签名）
    4. 明确生成工具（如脚本头部注释标明为临时产物）
    5. 非 Git tracked（git ls-files 检查，Git tracked → 默认禁止自动清理）
    6. 年龄阈值（> 14 天）
  Git tracking 检查:
    ```powershell
    # 在文件所在 Git 仓库根目录执行
    $repoRoot = git -C $fileDir rev-parse --show-toplevel 2>$null
    if ($repoRoot) {
        $tracked = git -C $repoRoot ls-files --error-unmatch $filePath 2>$null
        if ($tracked) { Write-Verbose "Git tracked, skip: $filePath"; continue }
    }
    ```

RULE_JUNK_VENV:
  匹配模式: .runtime/venv/ 目录
  适用路径: D:\AI\Workspace, D:\workspace
  风险等级: 中（P0-4 修正：可重建但有时空成本与网络依赖，误删在用项目 venv 会中断工作）
  大小阈值: 仅清理总大小 > 100MB 的 venv（$SizeThreshold_Venv）
  清理策略: 逐项确认后删除
  活跃进程检测命令:
    ```powershell
    # 检测 venv 是否被活跃 Python 进程引用
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match [regex]::Escape($venvPath) }
    ```
  首次执行建议: 首次降为中风险逐项确认，后续执行可依据目录修改时间约束加速

RULE_JUNK_BUILD_LOG:
  匹配模式: build*.log, operit2_check*.log
  适用路径: D:\workspace 下的项目子目录
  风险等级: 低（构建日志，可重建）
  年龄阈值: 保留最近 7 天（可配置）
  清理策略: 直接清理
  优先级: 高于 RULE_JUNK_LOG（路径+文件名限定）

RULE_JUNK_CLAUDE_BACKUP:
  匹配模式: .claude.json.backup.* 文件
  适用路径: D:\AI\Workspace\CC-HAHA\backups\
  风险等级: 低（已有当前版本）
  清理策略: 保留最近 1 份，删除其余
  优先级: 高于 RULE_JUNK_BACKUP（路径限定）

RULE_JUNK_TRAE_APPDATA_LOGS:
  匹配模式: E:\Users\WIN_11\AppData\Roaming\Trae CN\logs\ 下的所有日志
  风险等级: 低（日志可重建）
  年龄阈值: 保留最近 7 天（可配置）
  清理策略: 仅清理过期日志，非活跃会话期执行
  优先级: 高于 RULE_JUNK_LOG（路径限定）

RULE_JUNK_E_TEMP:
  匹配模式: E:\Users\临时文件\ 下的 .tmp / .nfo 文件（P0-3 修正：.dll 移出自动清理，单列人工判定）
  风险等级: 低（系统临时文件，不含 DLL）
  年龄阈值: 保留最近 3 天（$AgeThreshold_Temp）
  清理策略: 仅清理过期临时文件
  注意: .dll 文件不在自动清理范围——临时目录 DLL 可能仍被运行进程加载，强删导致进程崩溃

RULE_JUNK_WEBVIEW_CACHE:
  匹配模式: E:\Users\WIN_11\AppData\Roaming\Trae CN\Partitions\trae-webview\ 下的 IndexedDB/leveldb
  风险等级: 中（WebView 缓存，可能含会话数据）
  清理策略: 非活跃会话期可清理

RULE_JUNK_VM_CACHE:
  匹配模式: E:\Users\WIN_11\AppData\Roaming\Trae CN\VMCache\
  风险等级: 低（VM 缓存可重建）
  大小阈值: 优先清理 > 50MB 的缓存
  清理策略: 直接清理

RULE_JUNK_UV_CACHE:
  匹配模式: E:\Users\WIN_11\AppData\Local\uv\cache\ 下的 Python 包缓存
  风险等级: 中（可重建，但属其他 AI 工具缓存，需用户确认）
  大小阈值: 优先清理 > 200MB 的缓存（$SizeThreshold_UVCache，默认 200）
  清理策略: 需用户确认后清理

RULE_JUNK_TEMP:
  匹配模式: *.cleanup 后缀文件、.cleanup/ 目录下所有文件
  风险等级: 低（清理操作的标记文件，已完成或过期）
  清理策略: 直接清理

RULE_JUNK_WORKSPACE_CACHE:
  匹配模式: 工作区下的 Cache/ 目录及其中的 *.jsonl / *.log 文件
  适用路径: D:\AI\Workspace, D:\workspace
  风险等级: 低（MCP 日志缓存，可重建）
  年龄阈值: 保留最近 7 天（$AgeThreshold_Logs）
  清理策略: 直接清理过期文件

RULE_JUNK_WORKSPACE_DIR:
  匹配模式: 工作区下的 temp/、test/、.todo/ 目录（V3 §12: 不允许整目录删除，须逐项检查）
  适用路径: D:\AI\Workspace, D:\workspace
  风险等级: 中（需确认无未完成工作）
  年龄阈值: 目录内最新文件修改时间 > 14 天方可列入候选（$AgeThreshold_WorkspaceTemp）
  清理策略: 逐项确认后删除
  V3 §12 目录级安全检查（必须全部通过方可列入候选）：
    1. 检查目录内最新文件修改时间（> 14 天）
    2. 检查 Git tracking（目录在 Git 仓库内且被 tracked → 禁止整目录删除）
    3. 检查运行中进程是否引用目录内文件
    4. 检查最近 7 天内是否有文件修改活动
    5. 人工风险评估 + 批准
  安全流程:
    ```text
    目录级候选 → 检查目录内最新文件 → 检查 Git tracking →
    检查运行中进程 → 检查最近修改 → 风险评估 → 人工批准
    ```
  禁止: 仅凭目录名（temp/test/.todo）+ 年龄即自动整目录删除

RULE_JUNK_TMP:
  匹配模式: *.tmp 文件
  适用路径: 全部盘点目录
  风险等级: 低（临时文件）
  年龄阈值: 保留最近 3 天（$AgeThreshold_Temp）
  清理策略: 仅清理过期临时文件

RULE_JUNK_LEGACY_SETTINGS:
  匹配模式: E:\Users\WIN_11\AppData\Roaming\Trae CN\settings.json（旧模式残留）
  风险等级: 中（需确认当前 portable 模式未引用）
  清理策略: 确认后删除或归档
```

> **年龄阈值参数**：所有带 `年龄阈值` 的规则，阈值可通过变量 `$AgeThreshold_Logs`（默认 7）、`$AgeThreshold_Temp`（默认 3）、`$AgeThreshold_WorkspaceTemp`（默认 14）统一调整。
> **大小阈值参数**：所有带 `大小阈值` 的规则，阈值可通过变量 `$SizeThreshold_Venv`（默认 100MB）、`$SizeThreshold_Cache`（默认 50MB）统一调整。

## 已知目录结构（初次盘点基线）

> **注意**：此基线为首次盘点快照，每次执行后应刷新。参见"基线更新机制"。

### 用户配置区 `C:\Users\JasonPC\.trae-cn\`

```
.trae-cn/
├── builtin/                    # [A-核心] 内置 skills（code/design/global/work 四类 harness）
│   ├── code/ design/ global/ work/
│   └── manifests/             # 全局清单文件
├── builtin_skills/            # [A-核心] TRAE 专属技能
├── commands/                  # [C-用户数据] 命令定义
├── design_libraries/          # [C-用户数据] 15+ 内置设计库
├── extensions/                # [F-扩展] VSCode 扩展 + 残留
│   ├── golang.go-0.56.1-universal/
│   ├── vadimcn.vscode-lldb-1.12.3/
│   ├── .obsolete              # [F-扩展残留] 扩展卸载标记
│   ├── extensions.json        # [B-配置] 扩展注册表
│   └── *.备份.*               # [E-残留] 备份残留
├── feifei-ii-test-mock/       # [D-临时] 测试 mock 数据
├── memory/                    # [C-用户数据] 用户记忆
│   ├── .cleanup/              # [D-临时] 清理标记
│   └── user_profile.md
├── permission/                # [B-配置] 权限配置
│   ├── global.json            # [B-配置] 当前版本
│   └── *.backup.* / *.备份.*  # [E-残留] 多份备份
├── plugins/                   # [A-核心] 插件
├── skills/                    # [C-用户数据] 用户技能（40+ 技能）
├── tools/                     # [A-核心] 工具二进制
├── user_rules/                # [C-用户数据] 用户规则文件
├── work/                      # [D-临时] 工作区临时文件
│   ├── 6a1491a1b1ef944238472d4a/  # 临时工作产物
│   └── 6a1598d3d40ca9dc4b19c425/  # 临时工作产物
├── argv.json                  # [B-配置] 启动参数
├── hooks.json                 # [B-配置] 钩子配置
├── *.log                      # [D-临时] 日志文件
├── feifei-ii-state.json       # [B-配置] 状态文件
├── sandbox.json               # [B-配置] 沙箱配置
├── skill-config.json          # [B-配置] 技能配置
├── memory-config.json         # [B-配置] 记忆配置
├── plugin-config.json         # [B-配置] 插件配置
├── installed-plugins.json     # [B-配置] 已装插件清单
└── trae-jwt-token             # [B-配置] 认证令牌
```

### 安装区 `D:\Trae CN\`

```
Trae CN/
├── aha_doctor/                # [A-核心] 健康检查工具
├── bin/                       # [A-核心] 启动脚本
├── locales/                   # [A-核心] 50+ 语言包
├── resources/
│   └── app/                   # [A-核心] 核心应用
│       ├── extensions/        # [A-核心] 60+ 内置语言扩展
│       ├── modules/           # [A-核心] AI agent / browser-bridge / ckg / sandbox
│       ├── out/               # [A-核心] 编译输出 + 媒体资源
│       ├── resources/         # [A-核心] 文件类型图标
│       ├── product.json       # [A-核心] 产品配置
│       └── product.json.backup.*  # [E-残留] 备份
├── tools/                     # [A-核心] 环境工具
├── *.dll / *.exe              # [A-核心] 运行时二进制
├── debug.log                  # [D-临时] 调试日志
└── LICENSES.chromium.html     # [A-核心] 许可证
```

### 复合工作区 1 `D:\AI\Workspace`

```
AI/Workspace/
├── ABU-TODO/                  # [C-用户数据] 工作状态记录
├── CC-HAHA/                   # [C/D-混合] → 按混合目录分解规则逐一判定
│   ├── .runtime/venv/        # [D-临时] Python 虚拟环境（pip 等大量包）
│   ├── Cache/                 # [D-临时] MCP 日志缓存（JSONL）
│   ├── backups/               # [E-残留] .claude.json 备份残留
│   ├── cc-haha/               # [C-用户数据] HAHA 配置 + SQLite 数据库
│   ├── file-history/          # [D-临时] 文件变更历史快照
│   ├── projects/              # [C-用户数据] 项目会话 JSONL
│   └── *.json                 # [C/D-混合] → 按子路径上下文判定
```

### 复合工作区 2 `D:\workspace`

```
workspace/
├── .workbuddy/                # [C-用户数据] WorkBuddy 记忆
├── Abu/                       # [C/D-混合] → 按混合目录分解规则逐一判定
│   ├── .abu/skills/           # [C-用户数据] Abu 技能
│   ├── automatic/             # [D-临时] 自动化脚本 + 临时输出文件
│   └── *.ps1/*.py/*.json/*.txt  # [D-临时] 大量临时脚本和数据
├── Aider/                     # [C/D-混合] → 按混合目录分解规则
│   ├── .aider-desk/           # [C-用户数据] Aider 配置
│   └── *.py/*.bat             # [D-临时] 测试脚本
├── Claude-Code/               # [C/D-混合] → 按混合目录分解规则
│   ├── .learnings/            # [C-用户数据] 学习记录
│   ├── .runtime/venv/         # [D-临时] Python 虚拟环境
│   ├── agents/                # [C-用户数据] Agent 定义
│   ├── cc-haha/db/            # [C-用户数据] SQLite 数据库（含对话记录，按分解规则 *.db → C）
│   ├── memory/                # [C-用户数据] 记忆文档
│   ├── sessions/              # [C-用户数据] 会话 JSON
│   └── skills/                # [C-用户数据] 技能定义
├── Claude-Code-Haha/          # [C/D-混合] → 按混合目录分解规则
├── Roo-code/                  # [C/D-混合] → 按混合目录分解规则
├── goose/                     # [C-用户数据] Goose AI
├── hermes/                    # [C/D-混合] → 按混合目录分解规则
├── opencode/                  # [C/D-混合] → 按混合目录分解规则
├── trae/                      # [C/D-混合] → 按混合目录分解规则（最大最复杂）
│   ├── .todo/                 # [D-临时] TODO 记录
│   ├── .trae/rules/           # [C-用户数据] TRAE 规则
│   ├── 7/                     # [C/D-混合] → 按混合目录分解规则
│   ├── AgentRelay/            # [C-用户数据] Agent 中继架构文档
│   ├── LLM反代/               # [C/D-混合] → 按混合目录分解规则
│   ├── WorldMonitor/          # [C-用户数据] 监控项目 spec
│   ├── YuanbaoClaw/           # [C/D-混合] → 按混合目录分解规则
│   ├── solo/                  # [C/D-混合] → 按混合目录分解规则
│   ├── temp/                  # [D-临时] 临时文件
│   ├── test/                  # [D-临时] 测试文件
│   └── 记忆系统分析/           # [C-用户数据] TRAE 记忆机制分析
├── workbuddy/                 # [C/D-混合] → 按混合目录分解规则
└── read_leveldb.py 等         # [D-临时] 根目录临时脚本
```

> **注意**：以上为初次 LS 探测的结构概要。两个工作区包含大量临时脚本（.ps1/.py/.bat）、测试输出（.txt/.json/.log）、构建日志、备份文件等，需在执行阶段用 Everything CLI 精确扫描。

### E 盘 TRAE AppData `E:\Users\WIN_11\AppData\Roaming\Trae CN\`

> 通过 Everything CLI 探测发现。此目录是 TRAE 非 portable 模式（旧模式）遗留的 AppData，当前 portable 模式使用 `C:\Users\JasonPC\.trae-cn\`，但此目录仍在被写入日志。

```
Trae CN/ (E:\Users\WIN_11\AppData\Roaming\)
├── logs/                        # [D-临时] 多会话日志（20260904T130329 / 20260905T201237 / 20260906T082122）
│   └── window1/exthost/         # 各扩展日志（ai-code-completion / node-helper / git / ssh 等）
├── User/
│   └── globalStorage/
│       └── .ckg/storage/        # [C-用户数据] CKG 文件缓存数据库（file_cache.db）
├── Local Storage/
│   └── agent_avatar/            # [C-用户数据] Agent 头像图片
├── Partitions/
│   └── trae-webview/            # [D-临时] WebView 数据（含 IndexedDB/leveldb）
├── VMCache/                     # [D-临时] VM 缓存
└── settings.json (历史)         # [E-残留] 旧模式设置文件
```

### E 盘其他 TRAE 相关路径

| 路径 | 分类 | 说明 | 清理范围 |
|---|---|---|---|
| `E:\Users\WIN_11\AppData\Local\aha_doctor\Trae CN` | [A-核心] | aha_doctor 数据 | 不清理 |
| `E:\Users\WIN_11\AppData\Local\aha_doctor\TraeCode CN` | [A-核心] | aha_doctor 数据 | 不清理 |
| `E:\Users\临时文件\trae` | [D-临时] | TRAE 临时文件 | 纳入清理 |
| `E:\Users\临时文件\trae-agent-toolhost` | [D-临时] | TRAE Agent 临时文件 | 纳入清理 |
| `E:\Users\WIN_11\AppData\Local\uv\cache\` | [D-临时] | UV (Python 包管理) 缓存，含 trae_agent | **需用户确认**（其他工具缓存） |
| `E:\Users\WIN_11\AppData\Local\claude-cli-nodejs\Cache\` | [D-临时] | Claude CLI 缓存 | **不自动清理**（其他 AI 工具，仅报告） |
| `E:\Users\临时文件\*.tmp / *.nfo` | [D-临时] | 系统临时文件（不含 .dll） | 纳入清理 |
| `E:\Users\临时文件\*.dll` | [D-临时] | 临时目录 DLL（可能被加载） | **人工判定清单**，不自动清理 |
| `E:\tmp\` | [D-临时] | 额外临时文件目录 | **先盘点输出候选清单**，按规则逐项匹配后清理（P0-3 修正：不整目录清理） |

## Environment Reconciliation（V3 §2/§3/§4/§43 新增）

### 设计原则（V3 §1）

- **Policy 可以复用，Environment Fact 不能盲信**：分类规则、风险规则、垃圾识别规则长期稳定；TRAE 安装目录、runtime profile、扩展目录可能变化
- **当前 PC 的特殊路径允许写死**：`C:\Users\JasonPC\...`、`D:\Trae CN\...`、`E:\Users\WIN_11\...` 等路径保留，但需标注 `role`、`status`、`last_verified`、`verification_method`、`confidence`
- **历史事实不是永久事实**：旧 Spec 中 `.trae-cn = 当前 TRAE 运行 profile` 可能已过时，必须进入 Environment Profile 而非不可变规则

### 证据等级（V3 §3）

发现 TRAE 当前真实 profile 时，按以下优先级采信：

| 等级 | 类型 | 内容 | 优先级 |
|---|---|---|---|
| Level 1 | Runtime Evidence | 当前 TRAE 进程命令行、实际打开/写入的文件、运行期间新增/修改的日志、runtime profile 中持续变化的数据 | 最高 |
| Level 2 | Configuration Evidence | TRAE 配置文件、Electron/VSCode profile 设置、extensions registry、运行配置 | 高 |
| Level 3 | Filesystem Evidence | 目录结构、修改时间、文件数量、最近活跃文件 | 中 |
| Level 4 | Historical Evidence | 旧 baseline、过去的 Spec、以前 Agent 的判断 | 低（仅候选，不得覆盖高等级事实） |

> **铁律**：历史信息只能作为候选，不得覆盖当前高等级事实。

### Environment Profile 结构（V3 §4）

在 `$ReportDir/environment/` 或独立 `environment/` 中维护本机 Profile：

```yaml
profile_version: 1
machine:
  platform: Windows
  host_scope: Jason-PC

trae:
  install_dir:
    path: "D:\\Trae CN"
    status: confirmed
    last_verified: "YYYY-MM-DD"
    verification_method: [filesystem, process]
  extension_data_dir:
    path: "C:\\Users\\JasonPC\\.trae-cn"
    status: confirmed
    role: extension-data
    last_verified: "YYYY-MM-DD"
  runtime_profile:
    path: "E:\\Users\\WIN_11\\AppData\\Roaming\\Trae CN"
    status: confirmed
    role: runtime-profile
    last_verified: "YYYY-MM-DD"
    verification_method: [process, filesystem, runtime-activity]

workspaces:
  - path: "D:\\AI\\Workspace"
    role: mixed-workspace
  - path: "D:\\workspace"
    role: mixed-workspace

excluded:
  - "F:\\"
```

### Profile Staleness 机制（V3 §43）

Environment Profile 增加 staleness 状态：

| 状态 | 含义 | 触发条件 |
|---|---|---|
| `ACTIVE` | Profile 与当前环境一致 | 最近验证通过 |
| `STALE` | 环境可能已变化 | TRAE 安装目录变化、executable 变化、profile 目录变化、重大版本升级、关键目录消失、进程参数结构变化 |
| `INVALID` | Profile 确认失效 | 关键路径不存在或已迁移 |

> 遇到 `STALE`：本次不得直接执行危险清理，应先重新发现环境。

### Reconciliation 流程（V3 §2）

```text
开始执行
  ↓
读取当前 PC Profile
  ↓
发现 TRAE 当前运行实例（进程命令行、实际数据目录）
  ↓
分析启动参数 + 检查实际数据目录 + 检查最近文件活动
  ↓
与历史 Environment Profile 比较
  ↓
是否发生变化？
  ├─ 否 → 使用现有 Profile，继续 Phase 0
  └─ 是 → 标记 Profile Changed → 更新 Profile → 旧 baseline 标记 stale
  ↓
继续 Phase 0
```

### 环境检测语义统一（V3 §20）

> **Environment Detection / Reconciliation 默认是 advisory + profile update，不自动改变清理范围。**

例如 `WSL detected` ≠ 自动扫描整个 WSL，而是报告发现 WSL → 是否存在 TRAE 相关数据 → 只有验证后才加入 Scan Target。

### Capability vs Deployment Detection（V3 §21）

- `docker_installed = true` 只是能力，不等于 `trae_container_usage = active`
- `wsl_available` 不等于 `TRAE_using_WSL`
- 必须区分"能力存在"和"实际使用"

## Space Hotspot ≠ Cleanup Candidate（V3 §7 新增）

必须明确区分：

```text
Space Hotspot (空间热点) ≠ Cleanup Candidate (清理候选)
```

例如 `E:\Users\WIN_11\AppData\Roaming\Trae CN` ≈ 2.6 GB，即使很大，也不能因为空间大就进入删除候选。

概念模型：

```text
Discovered → Classified → Space Hotspot / Normal →
Cleanup Rule Matched? → Evidence Check → Cleanup Candidate
```

增加状态：

| 状态 | 含义 |
|---|---|
| `HEALTHY_LARGE_DIRECTORY` | 目录大但内容健康（如 runtime profile），不进入清理候选 |
| `CLEANUP_CANDIDATE` | 同时满足清理规则和安全条件，可进入清理流程 |

## 环境类型适配

### 环境类型定义与检测

TRAE IDE 在实际使用中可能部署于多种环境。每次执行时先检测当前环境类型，按需扩展盘点范围。

| 环境类型 | 标识 | 检测方法 | 盘点扩展 |
|---|---|---|---|
| **本地环境** | LOCAL | 默认（五个根目录均存在） | spec 主体已覆盖 |
| **SSH Remote** | SSH | 检测 `.trae-cn/` 下 remoteHosts 目录 | + SSH 缓存 + known_hosts 残留 |
| **WSL** | WSL | 检测 `\\wsl$\` 挂载 + TRAE WSL 扩展 | + WSL 文件系统中的 TRAE 临时文件 |
| **Dev Container** | CONTAINER | 检测 Docker 运行 + `.devcontainer/` | + 容器卷映射残留 |
| **多实例** | MULTI | 检测多个 TRAE 进程 | + 额外 session 的缓存和日志 |

### 环境检测命令

```powershell
# 检测 SSH Remote 配置
$hasSSH = Test-Path "C:\Users\JasonPC\.trae-cn\remoteHosts"
if ($hasSSH) {
    $EnvTypes += "SSH"
    # 扫描 SSH 缓存
    & "D:\Program Files\Everything\es.exe" "remoteHosts" -path "C:\Users\JasonPC\.trae-cn" -s
}

# 检测 WSL（使用 wsl -l -v 列出已安装发行版，仅人工确认）
$wslCmd = Get-Command wsl -ErrorAction SilentlyContinue
if ($wslCmd) {
    wsl -l -v  # 列出已安装 WSL 发行版，人工确认（V2-24 修正：移除 es.exe "wsl" 伪扫描，WSL 为提示型检测）
    $EnvTypes += "WSL"
}

# 检测 Dev Container
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
    $EnvTypes += "CONTAINER"
    # 扫描 .devcontainer 配置
    & "D:\Program Files\Everything\es.exe" ".devcontainer" -path "D:\workspace" -s
    # 盘点含 trae 标签的容器卷残留
    docker volume ls
    docker volume ls --filter "label=trae" 2>$null
}

# 检测多实例（V2-02 修正：Electron 应用多进程≠多实例，改为主窗口计数）
$traeMainProcs = Get-Process | Where-Object { $_.ProcessName -match '^Trae' -and $_.MainWindowHandle -ne 0 }
if ($traeMainProcs.Count -gt 1) { $EnvTypes += "MULTI" }
```

### 环境变量

```powershell
$EnvTypes = @("LOCAL")  # 检测后动态追加 SSH/WSL/CONTAINER/MULTI
```

### 各环境盘点策略

- **LOCAL**：按 spec 主体执行（五个根目录）
- **SSH**：额外盘点 `.trae-cn\remoteHosts\` 下的 SSH 会话缓存、known_hosts 残留条目、SSH 扩展临时文件
- **WSL**：如 WSL 中安装了 TRAE CLI，扫描 `\\wsl$\<distro>\tmp\` 和 `\\wsl$\<distro>\home\<user>\.trae\` 下的临时文件
- **CONTAINER**：扫描已停止容器的卷映射残留（`docker volume ls` + `docker inspect` 检查 labels 含 trae 的卷）
- **MULTI**：检测到多实例时提示用户。RULE_JUNK_MCP_CACHE 的 session 判定默认保留所有活跃 session（不因 MULTI 改变行为）。环境类型检测结果为**提示型**（V2-06 修正：检测并报告，不自动扩展盘点范围）

## 已识别的垃圾文件清单（初次基线快照）

> **注意**：此清单为首次盘点的快照数据，每次执行时路径可能已变化。实际清理以规则匹配为准，不以快照路径为准。此清单仅作参考。
> 完整历史报告归档至 `$ReportDir\report-$ExecutionId.md`（参见"报告版本管理"）。

| # | 文件/目录 | 分类 | 规则 | 风险 |
|---|---|---|---|---|
| 1 | `extensions/.obsolete` | F-扩展残留 | RULE_JUNK_OBSOLETE | 中 |
| 2 | `extensions/extensions.json.备份.20260831_063523` | E-残留 | RULE_JUNK_BACKUP | 低 |
| 3 | `extensions/extensions.json.备份.20260831_0649SS` | E-残留 | RULE_JUNK_BACKUP | 低 |
| 4 | `permission/global.json.backup.20260814_1155` | E-残留 | RULE_JUNK_BACKUP | 低 |
| 5 | `permission/global.json.backup.20260814_1155_2` | E-残留 | RULE_JUNK_BACKUP | 低 |
| 6 | `permission/global.json.备份.20260831_0648SS` | E-残留 | RULE_JUNK_BACKUP | 低 |
| 7 | `hooks.json.备份.20260814_150230` | E-残留 | RULE_JUNK_BACKUP | 低 |
| 8 | `feifei-ii-bridge.log` | D-临时 | RULE_JUNK_LOG | 低 |
| 9 | `feifei-ii-orchestrator.log` | D-临时 | RULE_JUNK_LOG | 低 |
| 10 | `feifei-ii-test-mock/` (整个目录) | D-临时 | RULE_JUNK_TEST_MOCK | 低 |
| 11 | `work/6a1491a1b1ef944238472d4a/` | D-临时 | RULE_JUNK_TEMP_WORK | 中 |
| 12 | `work/6a1598d3d40ca9dc4b19c425/` | D-临时 | RULE_JUNK_TEMP_WORK | 中 |
| 13 | `D:\Trae CN\debug.log` | D-临时 | RULE_JUNK_LOG | 低 |
| 14 | `D:\Trae CN\resources\app\product.json.backup.20260701_204500.json` | E-残留 | RULE_JUNK_PRODUCT_BACKUP | 低 |
| 15 | `memory/.cleanup/.20260901.cleanup` | D-临时 | RULE_JUNK_TEMP | 低 |

## 待深度探测区域

初次 LS 未能完全覆盖，需在执行阶段用 Everything CLI 深入扫描：

| 区域 | 探测目标 | Everything CLI 命令 |
|---|---|---|
| `C:\Users\JasonPC\.trae-cn\` 全部子目录 | 对话记录存储位置（SQLite/JSON） | `es.exe ext:db;sqlite;sqlite3;db3 -path "C:\Users\JasonPC\.trae-cn"` |
| `C:\Users\JasonPC\.trae-cn\` 全部子目录 | storage/workspace 相关文件 | `es.exe "storage" -path "C:\Users\JasonPC\.trae-cn"` |
| `C:\Users\JasonPC\.trae-cn\mcps\` | MCP descriptor 缓存 | `es.exe -path "C:\Users\JasonPC\.trae-cn\mcps" -s` |
| 各目录文件大小统计 | 磁盘占用热点 | `es.exe -path "<path>" -size -s -export-csv "$InventoryDir\size-hotspots.csv"` |
| `extensions/` 深度 | 扩展残留 vs 活跃扩展 | 读取 `extensions.json` 比对目录 |
| `D:\AI\Workspace` 全部子目录 | 临时文件、日志 | `es.exe ext:log;tmp -path "D:\AI\Workspace"` |
| `D:\AI\Workspace` 全部子目录 | 缓存目录/文件 | `es.exe "cache" -path "D:\AI\Workspace" -s` |
| `D:\workspace` 全部子目录 | 临时文件、日志、备份 | `es.exe ext:log;tmp;bak -path "D:\workspace"` |
| `D:\workspace` 全部子目录 | SQLite 数据库（对话记录） | `es.exe ext:db;sqlite;sqlite3;db3 -path "D:\workspace"` |
| `D:\workspace` 全部子目录 | 大文件（> 50MB） | `es.exe -path "D:\workspace" -size -s 'size:>50mb'`（P0-2 修正：用 Everything 查询语法过滤，非 PowerShell 对象。**单引号防止 PowerShell 将 `>` 解释为重定向**） |
| `E:\Users\WIN_11\AppData\Roaming\Trae CN\` | TRAE AppData 日志/缓存大小统计 | `es.exe -path "E:\Users\WIN_11\AppData\Roaming\Trae CN" -size -s -export-csv "$InventoryDir\e-trae-appdata.csv"` |
| `E:\Users\临时文件\` | 系统临时文件 | `es.exe -path "E:\Users\临时文件" -size -s` |
| `E:\tmp\` | 额外临时文件 | `es.exe -path "E:\tmp" -size -s` |

## 安全保障要求

### 1. 备份点创建（P4-1 扩大范围）

清理前必须创建备份，备份范围：

| 备份目标 | 路径 | 备份内容 | 优先级 |
|---|---|---|---|
| 用户配置区 | `C:\Users\JasonPC\.trae-cn\` | 完整目录（**排除** `work/`、`feifei-ii-test-mock/`、`*.log` 临时日志，其余含 D-临时文件一并备份以保留完整状态快照） | **必须** |
| 安装区关键文件 | `D:\Trae CN\resources\app\product.json` | 单文件备份 | **必须** |
| E 盘 TRAE AppData 配置 | `E:\Users\WIN_11\AppData\Roaming\Trae CN\settings.json` | 旧模式设置文件 | 建议 |
| 工作区 C 类数据 | `D:\AI\Workspace`、`D:\workspace` 下的 `sessions/`、`memory/`、`agents/`、`.learnings/` | 用户数据子目录 | 建议（首次执行必须） |

备份路径：`$BackupDir\backup-$ExecutionId\`

> **P2-1 风险声明**：备份与源同在 D 盘，磁盘故障同损——建议异盘备份或声明风险。
> **P2-1 轮转策略**：保留最近 2 份备份，新备份验证通过后删除旧备份。
> **P2-1 Token 处理**：`trae-jwt-token` 明文凭据移出备份范围（可重新登录恢复，降低敏感信息泄露风险）。

### 2. 备份完整性验证（P4-2 增强，N18 定义抽样标准）

- 文件数量比对：备份前后文件数一致
- 文件大小比对：总大小偏差 < 1%
- 哈希校验（全量校验 B 类配置文件和 A 类关键文件，非抽样）：
  - B 类配置文件（`hooks.json`、`permission/global.json`、`argv.json` 等）：逐文件 SHA256 比对
  - A 类关键文件（`product.json`）：SHA256 比对
  - 其他文件：按 10% 随机抽样 SHA256 比对
  - 合格阈值：100% 匹配（B/A 类），抽样匹配率 100%（任一失败升级全量校验，失败则中止清理）

### 3. 磁盘空间预检（P4-3 新增）

备份前检查目标磁盘剩余空间：

```powershell
# 检查备份目标磁盘空间（需大于实测源目录体积的 1.5 倍）
$backupDriveLetter = ($BackupDir -replace '^([A-Za-z]):.*', '$1')
$drive = (Get-PSDrive -Name $backupDriveLetter)
$freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
# 先实测源目录体积再 ×1.5（P2-1 修正：取消硬编码 2.0GB）
$sourceSizeBytes = (Get-ChildItem $TraeConfigDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
$estimatedBackupGB = [math]::Round($sourceSizeBytes / 1GB * 1.5, 2)
if ($freeSpaceGB -lt $estimatedBackupGB) {
    Write-Error "磁盘空间不足: 剩余 $freeSpaceGB GB, 需要 $estimatedBackupGB GB"
    exit 1
}
```

### 4. 非破坏性盘点

盘点阶段仅读取，不修改任何文件。

### 5. 逐项确认与 Headless 模式策略（P4-6 解决矛盾）

**风险等级与处理策略**：

| 风险等级 | 交互模式 | Headless 模式 |
|---|---|---|
| 低 | 自动执行 | 自动执行 |
| 中 | 人工确认后执行 | **落 pending-review 后结束，无需人工批准** |
| 高 | 人工确认后执行 | **落 pending-review 后结束，无需人工批准** |
| **TRAE 进程运行时** | 暂停，提示用户关闭 | 日志/WebView 类统一顺延记入 pending-review（即使低风险） |

待确认清单文件格式：
```
## Pending Review Items ($ExecutionId)
- [ ] [中] <文件路径> | 规则: <RULE> | 原因: <跳过原因>
```

> **V2-14 语义澄清**：表中"落 pending-review 后结束"指**该项**中/高风险清理被跳过并记录到 pending-review 文件，不影响低风险项的自动执行，也不终止整个清理流程。后续 Task（13 验证等）照常执行。

### 5.1 用户批准协议（V2-15 新增）

Task 10 生成报告后、Task 11 清理执行前，需用户批准：

| 模式 | 批准方式 | 超时处理 |
|---|---|---|
| **交互模式** | 用户在对话中回复"approve"或"reject"，可附加修改意见（如排除某项） | 无超时限制，等待用户响应 |
| **Headless 模式** | 自动批准低风险项，中/高风险项落 pending-review | 无需等待 |

批准载体：对话消息（交互模式）/ 进度文件 `approved: true/false` 字段（headless 模式留 false + pending-review 清单）。

### 5.2 启动验证操作细节（V2-16 新增）

Task 13.1 的 60 秒启动验证需定义以下操作细节：

```powershell
# 1. 启动 TRAE
Start-Process "D:\Trae CN\Trae CN.exe"
# 2. 等待 60 秒
Start-Sleep -Seconds 60
# 3. 验证：主窗口进程存在 + 新日志生成 + 无 fatal/crash 关键字
$proc = Get-Process | Where-Object { $_.ProcessName -match '^Trae' -and $_.MainWindowHandle -ne 0 }
$newLog = Get-ChildItem "$TraeConfigDir\logs" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-2) }
# 4. 验证后关闭 TRAE（此为关闭 smoke-test 主动启动的 TRAE，非杀用户进程；V3 §22 例外）
if ($proc) { Stop-Process -Id $proc.Id -Force }
```

- **Headless 模式**：跳过启动验证，记录"无法验证（headless）"到执行报告
- **验证后 TRAE 状态**：关闭（避免运行中进程污染后续进程检查）

### 6. TRAE 进程检查（P4-5 补充命令，N20 修正正则，V3 §22 重写）

清理前确认 TRAE IDE 已关闭。**V3 §22 原则：默认不强制关闭 TRAE，而是阻止清理。**

```powershell
# 检查 TRAE 相关进程（精确匹配，避免误报 VS Code）
$traeProcs = Get-Process | Where-Object { $_.ProcessName -match '^Trae' -or $_.Path -like 'D:\Trae CN\*' }
if ($traeProcs) {
    Write-Warning "检测到 TRAE 相关进程运行中: $($traeProcs.ProcessName -join ', ')"
    # V3 §22: 不自动 Stop-Process -Force
    # 交互模式：提示用户手动关闭 TRAE 后继续
    # Headless 模式：所有清理项进入 pending-review
    # 默认禁止：Stop-Process -Force（除非有明确授权策略）
    throw "TRAE 进程运行中，清理已阻止。请手动关闭 TRAE 后重试。"
}
```

### 6.1 备份后竞态条件防护（N9 新增，V3 §23 重写）

备份完成后、清理执行前需重新检查进程状态。**V3 §23：阻止 Cleanup，而非杀用户进程。**

```powershell
# 备份完成后立即重检
$traeProcsPostBackup = Get-Process | Where-Object { $_.ProcessName -match '^Trae' -or $_.Path -like 'D:\Trae CN\*' }
if ($traeProcsPostBackup) {
    # V3 §23: 安全目标 = 不在运行中的 TRAE 上进行一致性操作
    # 正确逻辑：ABORT CLEANUP / PENDING，不杀进程
    Write-Error "备份后检测到 TRAE 启动（竞态条件）。清理已中止，不强制关闭 TRAE。"
    # 中风险以上项进入 pending-review，低风险项可选择性执行
    throw "ABORT_CLEANUP: TRAE 在备份后重新启动"
}
```

### 7. 清理事务日志（P4-7 新增，N14 文件锁重试）

每项清理操作前写入事务日志，支持断点续清：

```
$ReportDir\cleanup-transaction-$ExecutionId.log
格式: [ISO8601] [ACTION:DELETE/MOVE/SKIP] [RISK:LOW/MED/HIGH] [RULE:RULE_JUNK_XXX] <文件路径> | 结果: <SUCCESS/SKIPPED/FAILED/RETRY>
```

**文件锁重试逻辑（N14 新增）**：
对 FAILED 项执行有限重试（最多 3 次，间隔 5 秒），仍失败则记入 pending-review 文件。
> **P2-3 注意**：以下 `Write-TransactionLog` 和 `AddToPendingReview` 为伪代码，执行时需实现。最小实现：
> - `Write-TransactionLog`: `Add-Content "$ReportDir\cleanup-transaction-$ExecutionId.log" "[$(Get-Date -Format 'o')] $Message" -Encoding UTF8`
> - `AddToPendingReview`: `Add-Content "$ReportDir\pending-review-$ExecutionId.md" "- [ ] $FilePath | 原因: $Reason" -Encoding UTF8`
```powershell
for ($retry = 1; $retry -le 3; $retry++) {
    try { Remove-Item $file -Force; Write-TransactionLog "SUCCESS"; break }
    catch {
        if ($retry -lt 3) { Start-Sleep -Seconds 5 }
        else { Write-TransactionLog "FAILED: $_"; AddToPendingReview $file "文件锁定" }
    }
}
```

### 8. 回滚流程（P4-4 新增）

若清理后验证 IDE 启动失败（脚本化判定：启动后 60 秒内进程不存在 / 新日志含 fatal/crash 关键字 / 无新日志生成）：

1. 从 `$BackupDir\backup-$ExecutionId\` 恢复被清理的文件
2. 重新验证 IDE 启动
3. 记录回滚事件到事务日志
4. 向用户报告回滚原因和受影响文件

## 复用性设计

### 变量参数化（P6-4）

所有路径和阈值通过变量统一管理，便于不同环境复用：

```powershell
# 路径变量
$TraeConfigDir = "C:\Users\JasonPC\.trae-cn"
$TraeInstallDir = "D:\Trae CN"
$Workspace1 = "D:\AI\Workspace"
$Workspace2 = "D:\workspace"
$EUserDir = "E:\Users\WIN_11"
$ETraeAppData = "E:\Users\WIN_11\AppData\Roaming\Trae CN"

# 输出目录变量
$InventoryDir = "d:\AI\.trae\specs\trae-ide-cleanup-optimization\inventory"
$ReportDir = "d:\AI\.trae\specs\trae-ide-cleanup-optimization\reports"
$BackupDir = "d:\AI\.trae\specs\trae-ide-cleanup-optimization\backups"

# 阈值变量
$AgeThreshold_Logs = 7        # 日志保留天数
$AgeThreshold_Temp = 3        # 临时文件保留天数
$AgeThreshold_WorkspaceTemp = 14  # 工作区临时文件保留天数
$SizeThreshold_Venv = 100     # MB，venv 优先清理阈值
$SizeThreshold_Cache = 50     # MB，VM 缓存优先清理阈值
$SizeThreshold_UVCache = 200  # MB，UV cache 优先清理阈值（N16 新增）
```

### 报告版本管理（P6-5）

每次执行生成带时间戳的报告归档：

```
$ReportDir/
├── report-$ExecutionId.md         # 执行报告
├── cleanup-transaction-$ExecutionId.log  # 事务日志
├── pending-review-$ExecutionId.md # 待确认清单（headless 模式）
├── baseline-$ExecutionId.json     # 盘点基线快照
├── progress-$ExecutionId.json     # 执行进度文件（断点续清）
├── classification-*.csv           # 分类结果（按目录分批）
├── junk-*.csv                     # 垃圾文件清单（按目录分批）
└── size-hotspots.csv              # 磁盘占用热点统计
```

### 增量清理模式（P6-3）

首次执行为全量盘点。后续执行支持增量模式：

1. 加载上次基线 JSON（`baseline-$ExecutionId.json`）
2. 用 Everything CLI 扫描当前文件
3. 生成 delta 清单，分为 **added**（新增）、**modified**（修改）、**removed**（删除）三个子清单
4. 仅处理 delta 中的 added/modified 文件（Task 7/7b 输入 = `classification-*.csv + junk-*.csv` + delta）
5. 新基线 = 旧基线应用 delta（added/modified 更新条目，removed 删除条目）
6. 更新基线 JSON 文件

### 触发条件（P6-6 量化）

建议在以下条件之一满足时执行清理：

| 条件 | 阈值 | 检测命令 |
|---|---|---|
| 磁盘占用增量 | `.trae-cn\` 目录大小增长 > 500MB | `(Get-ChildItem $TraeConfigDir -Recurse \| Measure-Object Length -Sum).Sum` |
| 日志文件数 | `.log` 文件数 > 50 | `$count = @(& "D:\Program Files\Everything\es.exe" ext:log -path $TraeConfigDir).Count` |
| `.obsolete` 条目 | `.obsolete` 文件存在或条目 > 0 | 检查文件存在性 |
| 距上次清理天数 | > 30 天 | 读取 `$ReportDir\baseline-*.json` 最新日期 |

### 基线更新机制（P6-7）

每次执行后：
1. 生成新的基线快照 `baseline-$ExecutionId.json`（含目录结构、文件数、总大小）
2. 与上次基线对比，标注变更（新增/删除/大小变化）
3. 更新 spec 中的"已知目录结构"章节（仅结构变化时）

### 可复用模板 Schema（P6-2，N17 扩展）

模板字段定义：

```json
{
  "execution_date": "YYYY-MM-DD",
  "directories_scanned": ["path1", "path2"],
  "total_files": 0,
  "total_size_mb": 0,
  "junk_files_found": 0,
  "junk_size_mb": 0,
  "files_cleaned": 0,
  "space_recovered_mb": 0,
  "pending_review": 0,
  "rules_matched": {"RULE_JUNK_LOG": 0, "RULE_JUNK_BACKUP": 0},
  "per_directory": [{"dir": "...", "junk_files": 0, "recovered_mb": 0}],
  "risk_distribution": {"low": 0, "medium": 0, "high": 0},
  "failed_operations": 0,
  "rollback_events": 0,
  "backup_verified": true,
  "thresholds_used": {"age_logs": 7, "age_temp": 3, "size_venv": 100, "size_uv_cache": 200}
}
```

### 基线 JSON Schema（N22 新增）

每次执行生成的基线快照格式：

> **V2-19 优化建议**：大目录下基线 JSON 可达几十 MB，PS 5.1 的 `ConvertFrom-Json` 解析慢且吃内存。建议按目录分片存储（每个根目录一个 JSON），或改用 CSV 基线格式。

```json
{
  "execution_date": "YYYY-MM-DD",
  "directories": [
    {
      "path": "C:\\Users\\JasonPC\\.trae-cn",
      "file_count": 0,
      "total_size_mb": 0,
      "files": [
        {"path": "relative/path", "size": 0, "modified": "ISO8601"}
      ]
    }
  ]
}
```

### 报告 Markdown 格式（N25 新增）

执行报告 `report-$ExecutionId.md` 的章节结构：

```markdown
# TRAE IDE 清理报告 YYYY-MM-DD

## 1. 执行概要
- 执行日期 / 模式（全量/增量）/ 盘点目录数 / 总文件数 / 总大小

## 2. 文件系统结构
- 目录树形图 / 各目录文件数统计 / Top 20 占用目录

## 3. 垃圾文件清单
- 表格：文件路径 | 分类 | 规则 | 风险 | 建议操作 | 预计回收空间
- 按风险等级排序

## 4. 对话记录索引
- 表格：存储位置 | 创建时间 | 类型 | 关联模块（可选）

## 5. 臃肿根源分析
- 根源列表 + 数据支撑 + 改进建议

## 6. 清理执行结果
- 清理项数 / 回收空间 / 失败项 / 待确认项
- 事务日志摘要

## 7. 安全验证
- 备份完整性 / IDE 启动验证 / 回滚事件（如有）

## 8. 下次执行建议
- 触发条件检测 / 增量模式建议
```

## LLM API 中断接续机制

### 设计原则

TRAE Agent 执行过程中，LLM API 可能因限流（429）、超时、服务波动导致主 agent 或子 agent 中断。本机制确保：

1. **中断后可恢复**——不丢失已完成的盘点数据和分类结果
2. **重入可识别**——能正确判断上次执行到哪个 Phase / Task / SubTask
3. **断点可续接**——从中断的子任务重新开始，而非从头重跑
4. **进度可持久化**——进度状态同时写入文件和 Engram 记忆（双重保障）

### 进度状态文件

每次执行生成一个进度状态文件：

```
$ReportDir\progress-$ExecutionId.json
```

格式：
```json
{
  "execution_id": "trae-cleanup-YYYYMMDD-HHmmss",
  "started_at": "ISO8601",
  "last_updated": "ISO8601",
  "current_phase": "Phase 1: 全量文件系统盘点",
  "current_task": "Task 3",
  "current_subtask": "SubTask 3.4",
  "completed_tasks": ["Task 0", "Task 1", "Task 2"],
  "completed_subtasks": ["SubTask 0.1", "SubTask 0.2", "SubTask 1.1", "SubTask 1.2", ...],
  "in_progress": {
    "task": "Task 3",
    "subtask": "SubTask 3.4",
    "started_at": "ISO8601",
    "intermediate_files": ["$InventoryDir\\intermediate\\task3-partial.csv"]
  },
  "pending_tasks": ["Task 4", "Task 5a", "Task 5b", "Task 6", ...],
  "interruption_count": 0,
  "last_error": null,
  "env_types": ["LOCAL"],
  "inventory_files": {
    "inventory-trae-cn.csv": "completed",
    "inventory-trae-install.csv": "completed",
    "inventory-workspace-1.csv": "completed",
    "inventory-workspace-2.csv": "pending",
    "inventory-e-trae-appdata.csv": "pending",
    "inventory-e-temp.csv": "pending",
    "inventory-e-tmp.csv": "pending",
    "inventory-e-local-trae.csv": "pending",
    "inventory-e-uv-cache.csv": "pending",
    "inventory-e-claude-cache.csv": "pending",
    "classification-trae-cleanup-*.csv": "pending",
    "junk-trae-cleanup-*.csv": "pending"
  }
}
```

### 断点保存时机

| 时机 | 操作 | 写入内容 |
|---|---|---|
| 每个 Phase 开始 | 写入进度文件 | `current_phase` + `started_at` |
| 每个 Task 开始 | 写入进度文件 | `current_task` + 移入 `in_progress` |
| 每个子任务完成 | **立即写入**进度文件 | 子任务移入 `completed_subtasks` + 更新 `current_subtask` |
| 子 agent 返回结果 | 写入进度文件 + 验证输出文件 | 更新 `inventory_files` 状态 |
| 子 agent 中间数据 | 写入 `$InventoryDir\intermediate\` | 保存部分结果到中间文件 |
| 执行完成或中断 | 写入进度文件 + Engram 记忆 | 最终状态 + `interruption_count` |

### 中断检测方法

重入时（再次启动执行），首先检查进度文件：

```powershell
$progressFile = Get-ChildItem "$ReportDir\progress-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($progressFile) {
    $progress = Get-Content $progressFile.FullName -Encoding UTF8 | ConvertFrom-Json
    Write-Host "检测到上次执行进度:"
    Write-Host "  Phase: $($progress.current_phase)"
    Write-Host "  Task: $($progress.current_task) / $($progress.current_subtask)"
    Write-Host "  已完成: $($progress.completed_tasks.Count) 个任务, $($progress.completed_subtasks.Count) 个子任务"
    Write-Host "  中断次数: $($progress.interruption_count)"
    if ($progress.last_error) { Write-Host "  上次错误: $($progress.last_error)" }
    # 默认续接，用户可选择重新开始
}
```

### 断点续接策略

1. **加载进度文件** → 识别已完成和进行中的任务
2. **验证已完成任务的输出文件** → 确认数据未损坏
   ```powershell
   foreach ($task in $progress.completed_tasks) {
       $expectedOutput = "$InventoryDir\inventory-$task.csv"
       if (-not (Test-Path $expectedOutput)) {
           Write-Warning "任务 $task 标记为已完成但输出文件缺失，需重跑此任务"
           # 将此任务从 completed 移回 pending
       }
   }
   ```
3. **从中断的子任务重新开始** → 不恢复子 agent 上下文（LLM 上下文无法恢复），而是重跑当前子任务
4. **中间数据检查** → 检查 `$InventoryDir\intermediate\` 下是否有可用的部分数据
   ```powershell
   $intermediateFiles = Get-ChildItem "$IntermediateDir\*" -ErrorAction SilentlyContinue
   if ($intermediateFiles) {
       # 评估中间数据的完整性（行数、字段数）
       # 若中间数据足够完整，可跳过部分子任务
   }
   ```
5. **更新 `interruption_count`** → 记录本次中断+恢复

### Engram MCP 进度持久化（双重保障）

进度状态同时写入 Engram 记忆，防止进度文件损坏或丢失：

```json
{
  "title": "trae-cleanup-progress-YYYYMMDD",
  "type": "note",
  "content": "**Execution ID**: trae-cleanup-YYYYMMDD-HHmmss\n**Phase**: Phase 1\n**Task**: Task 3\n**SubTask**: SubTask 3.4\n**Completed**: Task 0,1,2 (8 subtasks)\n**Status**: interrupted\n**Interruption Count**: 1\n**Inventory files**: inventory-trae-cn.csv ✓, inventory-trae-install.csv ✓, inventory-workspace-1.csv (in_progress)\n**Last Error**: LLM API timeout on SubTask 3.4"
}
```

重入时用 `mem_search(query="trae-cleanup-progress")` 回查进度。

**进度同步时机**：
- 每个 Task 完成时：`mem_save` 更新进度
- 中断恢复时：`mem_search` 回查上次进度 + `mem_save` 记录恢复
- 执行完成时：`mem_save` 记录最终状态

### 子 Agent 中断处理

子 agent 可能返回三种状态：

| 状态 | 检测方式 | 主 Agent 处理 |
|---|---|---|
| ✅ 正常完成 | 返回完整结果 | 更新进度文件 + 验证输出 + 派下一个 |
| ❌ 超时/异常 | 返回错误或无响应 | 记录 `last_error` + 更新进度 + 决定重试（max 2 次）或跳过+记入 pending-review |
| ⏳ 部分完成 | 返回部分结果 + intermediate 文件 | 检查中间数据完整性 → 若可用则合并 → 从下一子任务继续 |

### 中断恢复流程

```
重入执行
  ↓
检查 $ReportDir\progress-*.json
  ↓
  ├─ 存在 → 加载进度 → 验证已完成输出 → 从中断点续接
  └─ 不存在 → 检查 Engram mem_search("trae-cleanup-progress")
       ↓
       ├─ 找到 → 从 Engram 恢复进度 → 重建进度文件 → 从中断点续接
       └─ 未找到 → 全新执行（Phase 0 开始）
```

### 变量

```powershell
$ExecutionId = "trae-cleanup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$ProgressFile = "$ReportDir\progress-$ExecutionId.json"
$IntermediateDir = "$InventoryDir\intermediate"
```

## Impact

- **受影响范围**: TRAE IDE 用户配置目录、安装目录、复合工作区、E 盘用户目录
- **预期收益**: 回收磁盘空间、减少启动扫描时间、消除扩展残留导致的潜在冲突
- **复用性**: 本 spec 设计为可定期执行，支持全量和增量两种模式

## ADDED Requirements

### Requirement: 全量文件系统盘点
系统 SHALL 对 TRAE IDE 相关的五个根目录（用户配置区 + 安装区 + 复合工作区 1 + 复合工作区 2 + E 盘用户目录/TRAE AppData）执行递归盘点，覆盖所有子目录，记录每个文件的路径、大小、最后修改时间。**排除 F 盘**（外置硬盘）。盘点通过**串行派遣子 agent**完成，严禁并行。E 盘盘点范围为**指定子路径清单**（非全量递归 `E:\Users\WIN_11\`），覆盖 TRAE AppData、临时文件目录、uv cache、claude-cli cache、aha_doctor 数据。

#### Scenario: 盘点完成
- **WHEN** 执行盘点流程
- **THEN** 输出包含所有文件的完整清单，无遗漏子目录，且盘点过程中任一时刻最多 1 个子 agent 运行

#### Scenario: 盘点批次失败
- **WHEN** 某盘点批次扫描失败
- **THEN** 对失败批次重试 1 次，仍失败时在报告中声明覆盖缺口并写入 pending-review 清单

### Requirement: 文件分类标注
系统 SHALL 按照 6 级分类标准（A-核心/B-配置/C-用户数据/D-临时/E-冗余/F-扩展残留）对每个文件标注分类。混合目录下的文件按"混合目录分解规则"逐一判定，确保每个文件有且仅有一个分类标签。

#### Scenario: 分类完成
- **WHEN** 盘点完成后执行分类
- **THEN** 每个文件有且仅有一个分类标签，混合目录无遗留未分类文件，分类规则可复用

### Requirement: 垃圾文件识别与风险评估
系统 SHALL 对 D-临时 和 E-冗余 和 F-扩展残留 类文件执行风险评估，输出可清理清单。识别遵循规则匹配优先级（specific > general），受年龄阈值和大小阈值约束。

#### Scenario: 识别完成
- **WHEN** 分类完成后执行垃圾识别
- **THEN** 输出含文件路径、规则匹配（含优先级仲裁）、风险等级、建议操作的清单

### Requirement: 对话记录索引
系统 SHALL 收集所有对话记录存储位置，按创建时间、对话类型、关联功能模块维度整理。提取 SQLite 对话记录需使用 `sqlite3` 模块或 Python `sqlite3` 库。

#### Scenario: 索引完成
- **WHEN** 对话记录探测完成
- **THEN** 输出结构化对话记录索引表

### Requirement: 安全清理执行
系统 SHALL 在清理前创建备份点（含用户配置区 + 安装区关键文件 + 工作区 C 类数据），清理时逐项执行并写入事务日志，清理后验证 IDE 完整性。若验证失败，执行回滚流程从备份恢复。中高风险项在 headless 模式下跳过并记录到待确认清单文件。

#### Scenario: 清理完成
- **WHEN** 用户批准清理清单
- **THEN** 先创建备份并验证完整性，再逐项清理（写入事务日志），最后验证 TRAE IDE 可正常启动（脚本化定义：启动后 60 秒内进程存在 + 新日志生成且无 fatal/crash 关键字，否则触发 13b 回滚）

#### Scenario: 清理失败回滚
- **WHEN** 清理后 IDE 验证失败
- **THEN** 从备份恢复受影响文件，重新验证，记录回滚事件

### Requirement: Everything CLI 健康预检
系统 SHALL 在执行盘点前验证 Everything CLI 可执行性和索引服务在线状态。

#### Scenario: 预检通过
- **WHEN** 执行盘点前
- **THEN** `es.exe -version` 返回版本号，测试查询返回结果，预检通过后继续执行

#### Scenario: 预检失败
- **WHEN** Everything CLI 不可用或索引服务离线
- **THEN** 终止执行，向用户报告

### Requirement: 环境类型适配
系统 SHALL 在执行前检测 TRAE IDE 部署的环境类型（本地/SSH Remote/WSL/Dev Container/多实例），按检测结果扩展盘点范围。

#### Scenario: 环境检测完成
- **WHEN** Phase 0b 环境检测执行后
- **THEN** `$EnvTypes` 数组已填充检测结果，非 LOCAL 的环境类型已触发扩展盘点

#### Scenario: 多环境检测
- **WHEN** 检测到多个环境类型（如 LOCAL+SSH+WSL）
- **THEN** 所有检测到的环境的扩展盘点范围已纳入执行计划

### Requirement: LLM API 中断接续
系统 SHALL 维护进度状态文件，确保 LLM API 中断后可恢复执行。每个子任务完成后立即写入进度。重入时从进度文件或 Engram 记忆恢复，从中断点续接而非从头重跑。

#### Scenario: 中断后恢复
- **WHEN** LLM API 中断后重入执行
- **THEN** 加载进度文件 → 验证已完成输出 → 从中断的子任务重新开始

#### Scenario: 进度文件损坏
- **WHEN** 进度文件损坏或丢失
- **THEN** 回退到 Engram `mem_search("trae-cleanup-progress")` 恢复进度，若 Engram 也无记录则全新执行

#### Scenario: 子 agent 部分完成
- **WHEN** 子 agent 返回部分结果 + 中间数据文件
- **THEN** 检查中间数据完整性，若可用则合并并从下一子任务继续
