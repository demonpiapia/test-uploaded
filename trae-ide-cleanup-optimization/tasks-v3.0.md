# Tasks

> **执行约束**：所有子 agent 严格串行派遣，前一个完成并返回结果后才派下一个。严禁并行。
> **搜索工具**：按 Engram #617 规则——系统级查询直接用 Everything CLI；工作区搜索用 Glob/Grep 后须用 Everything 校验；关键决策搜索直接用 Everything。禁止 SearchCodebase。
> **排除**：F 盘为外置硬盘，不盘点。
> **路径变量**：使用 `$InventoryDir`、`$ReportDir`、`$BackupDir` 等变量（定义见 spec.md 复用性设计章节），便于复用。
> **中断接续**：每个子任务完成后立即写入 `$ProgressFile`（进度状态文件）。若 LLM API 中断，重入时从进度文件续接。详见 spec.md LLM API 中断接续机制章节。

## Phase -1: 中断恢复检查（新增）

- [ ] Task -1: 检查上次执行进度 + 初始化执行环境
  - [ ] SubTask -1.1: 检查进度文件是否存在
    ```powershell
    $progressFile = Get-ChildItem "$ReportDir\progress-*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($progressFile) {
        $progress = Get-Content $progressFile.FullName -Encoding UTF8 | ConvertFrom-Json
        Write-Host "检测到上次执行进度: $($progress.current_phase) / $($progress.current_task) / $($progress.current_subtask)"
        Write-Host "已完成: $($progress.completed_tasks.Count) 任务, $($progress.completed_subtasks.Count) 子任务"
        Write-Host "中断次数: $($progress.interruption_count)"
        # 询问用户：续接 or 重新开始
    }
    ```
  - [ ] SubTask -1.2: 若无进度文件，检查 Engram 记忆
    ```powershell
    # 通过 mem_search 查询 "trae-cleanup-progress"
    # 若找到，从 Engram 恢复进度 → 重建进度文件
    # 若未找到，全新执行
    ```
  - [ ] SubTask -1.3: 若续接，验证已完成任务的输出文件存在性
    ```powershell
    foreach ($task in $progress.completed_tasks) {
        $expectedOutput = "$InventoryDir\inventory-$task.csv"
        if (-not (Test-Path $expectedOutput)) {
            Write-Warning "任务 $task 输出文件缺失，需重跑"
        }
    }
    ```
  - [ ] SubTask -1.4: 创建中间数据目录
    ```powershell
    New-Item -ItemType Directory -Path "$InventoryDir\intermediate" -Force
    New-Item -ItemType Directory -Path $ReportDir -Force
    ```
  - [ ] SubTask -1.5: 初始化/更新进度文件
    ```powershell
    $ExecutionId = "trae-cleanup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $ProgressFile = "$ReportDir\progress-$ExecutionId.json"
    $IntermediateDir = "$InventoryDir\intermediate"
    # 若续接：更新 interruption_count + last_updated
    # 若全新：创建新进度文件
    ```
  - **完成后**：进入 Phase -0.5

## Phase -0.5: Environment Discovery / Reconciliation（V3 §2 新增）

> 在 Phase 0 之前，先确认当前 PC 的 TRAE 真实部署状态，与历史 Environment Profile 校准。

- [ ] Task -0.5: Environment Discovery / Reconciliation
  - [ ] SubTask -0.5.1: 读取历史 Environment Profile（若存在）
    ```powershell
    $profilePath = "$ReportDir\environment\profile.yaml"
    if (Test-Path $profilePath) { $oldProfile = Get-Content $profilePath -Raw }
    ```
  - [ ] SubTask -0.5.2: 发现 TRAE 当前运行实例（V3 §3 证据等级 Level 1: Runtime Evidence）
    ```powershell
    # 检查 TRAE 进程命令行
    Get-CimInstance Win32_Process -Filter "Name LIKE 'Trae%'" | Select-Object ProcessId, CommandLine, ExecutablePath
    # 检查实际打开/写入的文件（最近 24 小时内修改的文件）
    Invoke-EverythingQuery -EsArgs @('-path', 'C:\Users\JasonPC\.trae-cn', '-date-modified', 'today')
    Invoke-EverythingQuery -EsArgs @('-path', 'E:\Users\WIN_11\AppData\Roaming\Trae CN', '-date-modified', 'today')
    ```
  - [ ] SubTask -0.5.3: 确认 install_dir / extension_data_dir / runtime_profile 路径
    - 验证 `D:\Trae CN` 存在且含 `Trae CN.exe`
    - 验证 `C:\Users\JasonPC\.trae-cn` 存在且含 extensions/
    - 验证 `E:\Users\WIN_11\AppData\Roaming\Trae CN` 是否仍被写入（检查最近文件活动）
  - [ ] SubTask -0.5.4: 与历史 Profile 比较，判断是否发生变化
    - 若路径变化 → 标记 Profile `STALE`，更新 Profile，旧 baseline 标记 stale
    - 若路径一致 → 标记 Profile `ACTIVE`，继续
  - [ ] SubTask -0.5.5: 生成/更新 Environment Profile（`$ReportDir\environment\profile.yaml`）
  - [ ] SubTask -0.5.6: Capability Detection（V3 §21: 能力 ≠ 部署）
    - 检测 Docker: `Get-Command docker` → `docker_installed = true`（仅能力）
    - 检测 WSL: `wsl -l -v` → `wsl_available = true`（仅能力）
    - 不自动扩展扫描范围，仅记录到 Profile
  - **完成后**：进入 Phase 0

## Phase 0: 执行前预检（P5-1 新增）

> **V2-04 修正**：以下所有 `es.exe` 调用均必须通过 `Invoke-EverythingQuery` 包装器执行（定义见 spec.md §Everything CLI 超时与重试机制）。代码块展示参数，实际调用格式为：
> `Invoke-EverythingQuery -EsArgs @('-version')` 或 `Invoke-EverythingQuery -EsArgs @('-path', '...', '-size', '-s', '-export-csv', '...')`

- [ ] Task 0: Everything CLI 健康预检 + 磁盘空间检查 + 目录存在性验证（N7 新增）
  - [ ] SubTask 0.1: 确认 Everything CLI 可执行
    ```powershell
    & "D:\Program Files\Everything\es.exe" -version
    ```
  - [ ] SubTask 0.2: 确认索引服务在线（测试查询）
    ```powershell
    & "D:\Program Files\Everything\es.exe" -path "C:\Windows" -n 1
    ```
  - [ ] SubTask 0.3: 磁盘空间预检（P4-3，V2-09 同步 spec：取消硬编码，改用动态源目录体积 × 1.5）
    ```powershell
    $backupDriveLetter = ($BackupDir -replace '^([A-Za-z]):.*', '$1')
    $drive = (Get-PSDrive -Name $backupDriveLetter)
    $freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
    $sourceSizeBytes = (Get-ChildItem $TraeConfigDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    $estimatedBackupGB = [math]::Round($sourceSizeBytes / 1GB * 1.5, 2)
    if ($freeSpaceGB -lt $estimatedBackupGB) {
        Write-Error "磁盘空间不足: 剩余 $freeSpaceGB GB, 需要 $estimatedBackupGB GB"
        exit 1
    }
    ```
  - [ ] SubTask 0.4: 验证目标目录存在性（N7 新增）
    ```powershell
    $targetDirs = @(
        "C:\Users\JasonPC\.trae-cn",
        "D:\Trae CN",
        "D:\AI\Workspace",
        "D:\workspace",
        "E:\Users\WIN_11\AppData\Roaming\Trae CN"
    )
    foreach ($d in $targetDirs) {
        if (-not (Test-Path $d)) { Write-Error "目标目录不存在（可能磁盘未挂载）: $d"; exit 1 }
    }
    ```
  - **完成后**：预检通过才进入环境检测

- [ ] Task 0b: 环境类型检测（新增）
  - [ ] SubTask 0b.0: 初始化环境类型数组
    ```powershell
    $EnvTypes = @("LOCAL")  # 检测后动态追加 SSH/WSL/CONTAINER/MULTI
    ```
  - [ ] SubTask 0b.1: 检测 SSH Remote 配置
    ```powershell
    $hasSSH = Test-Path "C:\Users\JasonPC\.trae-cn\remoteHosts"
    if ($hasSSH) { $EnvTypes += "SSH" }
    ```
  - [ ] SubTask 0b.2: 检测 WSL（使用 `wsl -l -v` 列出已安装发行版，仅人工确认）
    ```powershell
    $wslCmd = Get-Command wsl -ErrorAction SilentlyContinue
    if ($wslCmd) { wsl -l -v; $EnvTypes += "WSL" }
    ```
  - [ ] SubTask 0b.3: 检测 Dev Container
    ```powershell
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerCmd) {
        $EnvTypes += "CONTAINER"
        # 盘点含 trae 标签的容器卷残留
        docker volume ls
        docker volume ls --filter "label=trae" 2>$null
    }
    ```
  - [ ] SubTask 0b.4: 检测多实例（V2-02 修正：Electron 多进程≠多实例，改为主窗口计数）
    ```powershell
    $traeMainProcs = Get-Process | Where-Object { $_.ProcessName -match '^Trae' -and $_.MainWindowHandle -ne 0 }
    if ($traeMainProcs.Count -gt 1) { $EnvTypes += "MULTI" }
    ```
  - [ ] SubTask 0b.5: 将检测结果写入进度文件
  - **完成后**：进入 Phase 1

## Phase 1: 全量文件系统盘点（串行，6 轮子 agent）

> **V2-04 修正**：以下所有 `es.exe` 调用均必须通过 `Invoke-EverythingQuery` 包装器执行（定义见 spec.md）。代码块展示参数，实际调用格式为 `Invoke-EverythingQuery -EsArgs @(...)`。
> **V2-20 优化**：同一子 agent 内的多条 es.exe 查询（如 SubTask 1.1/1.2/1.3/1.4）可并行发起（不违反单 agent 串行约束——该约束限制的是 agent 数量，不是进程数量）。

> **增量模式（N15 新增，V2-11 同步 spec.md）**：若 `$ReportDir\baseline-*.json` 存在，本 Phase 切换为增量模式：
> 1. 加载上次基线 JSON（`baseline-*.json`）
> 2. 用 Everything CLI 扫描当前文件
> 3. 生成 delta 清单，分为 **added**（新增）、**modified**（修改）、**removed**（删除）三个子清单
> 4. 仅处理 delta 中的 added/modified 文件（Task 7/7b 输入 = 上次 `classification-*.csv` + `junk-*.csv` + delta）
> 5. 新基线 = 旧基线应用 delta（added/modified 更新条目，removed 删除条目）
> 6. 盘点完成后更新基线 JSON
>
> **modified 判定标准（V2-11 新增）**：文件被视为 modified 当且仅当 **size 变化 OR mtime 变化**（不使用哈希，避免全量计算成本）。

- [ ] Task 1: 子 agent 盘点用户配置区 `C:\Users\JasonPC\.trae-cn\`
  - [ ] SubTask 1.1: 用 Everything CLI 递归列出所有文件（含大小、修改时间），导出 CSV
    ```powershell
    & "D:\Program Files\Everything\es.exe" -path "C:\Users\JasonPC\.trae-cn" -size -date-modified -s -export-csv "$InventoryDir\inventory-trae-cn.csv"
    ```
  - [ ] SubTask 1.2: 搜索对话记录存储（SQLite/JSON）
    ```powershell
    & "D:\Program Files\Everything\es.exe" ext:db;sqlite;sqlite3;db3 -path "C:\Users\JasonPC\.trae-cn"
    & "D:\Program Files\Everything\es.exe" "storage" -path "C:\Users\JasonPC\.trae-cn"
    & "D:\Program Files\Everything\es.exe" "workspace" -path "C:\Users\JasonPC\.trae-cn"
    ```
  - [ ] SubTask 1.3: 深度探测 MCP 缓存区 `mcps/` 完整目录结构
  - [ ] SubTask 1.4: 统计各顶级子目录的文件数量和总大小
  - **完成后**：主 agent 确认结果，再派 Task 2

- [ ] Task 2: 子 agent 盘点安装区 `D:\Trae CN\`
  - [ ] SubTask 2.1: 用 Everything CLI 递归列出所有文件（含大小、修改时间），导出 CSV
    ```powershell
    & "D:\Program Files\Everything\es.exe" -path "D:\Trae CN" -size -date-modified -s -export-csv "$InventoryDir\inventory-trae-install.csv"
    ```
  - [ ] SubTask 2.2: 统计安装区各顶级目录文件数量和总大小，识别 Top 10 最大目录
  - [ ] SubTask 2.3: 识别安装区中的临时/残留文件（`debug.log`、`product.json.backup.*`）
  - **完成后**：主 agent 确认结果，再派 Task 3

- [ ] Task 3: 子 agent 盘点复合工作区 1 `D:\AI\Workspace`
  - [ ] SubTask 3.1: 用 Everything CLI 递归列出所有文件（含大小、修改时间），导出 CSV
    ```powershell
    & "D:\Program Files\Everything\es.exe" -path "D:\AI\Workspace" -size -date-modified -s -export-csv "$InventoryDir\inventory-workspace-1.csv"
    ```
  - [ ] SubTask 3.2: 搜索日志、临时文件
    ```powershell
    & "D:\Program Files\Everything\es.exe" ext:log;tmp -path "D:\AI\Workspace"
    ```
  - [ ] SubTask 3.3: 搜索缓存目录/文件（按文件名模式，非 ext:）
    ```powershell
    & "D:\Program Files\Everything\es.exe" "cache" -path "D:\AI\Workspace" -s
    ```
  - [ ] SubTask 3.4: 搜索 SQLite 数据库（对话记录）
    ```powershell
    & "D:\Program Files\Everything\es.exe" ext:db;sqlite;sqlite3;db3 -path "D:\AI\Workspace"
    ```
  - [ ] SubTask 3.5: 统计各子目录文件数量和总大小，识别臃肿热点
  - **完成后**：主 agent 确认结果，再派 Task 4

- [ ] Task 4: 子 agent 盘点复合工作区 2 `D:\workspace`（P2-5 分批策略，N21 增强超时分块）
  > **分批策略（N21）**：`D:\workspace` 为极高复杂度目录，采用子目录分批扫描：
  > 1. 先列出顶级子目录列表（`es.exe /ad -path "D:\workspace"`）
  > 2. 对每个顶级子目录单独执行 Everything 查询（每批超时 120 秒）
  > 3. 各批结果导出为独立 CSV 后用 `Import-Csv` + `Export-Csv -Append` 合并（V2-05 修正：`-export-csv` 为覆盖写，不支持追加模式）
  > 4. 单批失败重试 1 次，仍失败则记录到 pending-review 并继续其他批次（V2-12 同步 spec：重试 1 次 + pending-review）
  - [ ] SubTask 4.0: 列出顶级子目录列表（`es.exe /ad -path "D:\workspace"`）
  - [ ] SubTask 4.1: 对每个顶级子目录执行 Everything 查询，逐批导出 CSV 后合并（V2-05 修正 + V3 §18: GUID batch_id，不直接拼接未验证子目录名）
    ```powershell
    # V3 §18: 使用 GUID batch_id，不直接拼接未验证的子目录名到文件名
    $subdirsResult = Invoke-EverythingQuery -EsArgs @('/ad', '-path', 'D:\workspace')
    foreach ($subdir in $subdirsResult.Stdout) {
        $subdirName = $subdir.Trim()
        $batchId = [guid]::NewGuid().ToString().Substring(0, 8)
        $batchCsv = "$InventoryDir\intermediate\workspace2-$batchId.csv"
        $fullPath = Join-Path "D:\workspace" $subdirName  # 安全拼接，不假设格式
        if (-not (Test-Path $fullPath)) { continue }
        $r = Invoke-EverythingQuery -EsArgs @('-path', $fullPath, '-size', '-date-modified', '-s', '-export-csv', $batchCsv)
        if (-not $r.Success) { Write-Warning "Batch $batchId failed: $($r.Status) for $fullPath" }
    }
    # 合并各批 CSV
    Get-ChildItem "$InventoryDir\intermediate\workspace2-*.csv" | Import-Csv | Export-Csv "$InventoryDir\inventory-workspace-2.csv" -Encoding UTF8 -NoTypeInformation
    ```
  - [ ] SubTask 4.2: 搜索日志、临时文件、备份文件（P5-3 修正 ext: 语法）
    ```powershell
    # 按扩展名搜索（仅扩展名）
    & "D:\Program Files\Everything\es.exe" ext:log;tmp;bak -path "D:\workspace"
    # 按文件名模式搜索（非 ext:）
    & "D:\Program Files\Everything\es.exe" "backup" -path "D:\workspace" -s
    & "D:\Program Files\Everything\es.exe" ".备份" -path "D:\workspace" -s
    ```
  - [ ] SubTask 4.3: 搜索 SQLite 数据库（对话记录）
    ```powershell
    & "D:\Program Files\Everything\es.exe" ext:db;sqlite;sqlite3;db3 -path "D:\workspace"
    ```
  - [ ] SubTask 4.4: 搜索大文件（> 50MB）识别臃肿热点
    ```powershell
    & "D:\Program Files\Everything\es.exe" -path "D:\workspace" -size -s 'size:>50mb'
    ```
  - [ ] SubTask 4.5: 特别扫描 `D:\workspace\trae\7\scripts/` 下的大量临时扫描脚本和输出文件
  - **完成后**：主 agent 确认结果，再派 Task 5a

- [ ] Task 5a: 子 agent 盘点 E 盘 TRAE AppData（P2-1 拆分）
  - [ ] SubTask 5a.1: 用 Everything CLI 盘点 TRAE AppData 目录（含大小、修改时间），导出 CSV
    ```powershell
    & "D:\Program Files\Everything\es.exe" -path "E:\Users\WIN_11\AppData\Roaming\Trae CN" -size -date-modified -s -export-csv "$InventoryDir\inventory-e-trae-appdata.csv"
    ```
  - [ ] SubTask 5a.2: 检查 CKG 数据库是否含对话记录
    ```powershell
    & "D:\Program Files\Everything\es.exe" ext:db -path "E:\Users\WIN_11\AppData\Roaming\Trae CN\User"
    ```
  - [ ] SubTask 5a.3: 统计 TRAE AppData 各子目录（logs/VMCache/Partitions/Local Storage）大小
  - **完成后**：主 agent 确认结果，再派 Task 5b

- [ ] Task 5b: 子 agent 盘点 E 盘临时文件和其他 AI 工具缓存（P2-1 拆分）
  - [ ] SubTask 5b.1: 搜索 E 盘临时文件，导出 CSV（P0-5 修正：补 -export-csv）
    ```powershell
    & "D:\Program Files\Everything\es.exe" -path "E:\Users\临时文件" -size -s -export-csv "$InventoryDir\inventory-e-temp.csv"
    & "D:\Program Files\Everything\es.exe" -path "E:\tmp" -size -s -export-csv "$InventoryDir\inventory-e-tmp.csv"
    ```
  - [ ] SubTask 5b.2: 搜索 E 盘 TRAE 相关文件（aha_doctor、UV cache、Claude CLI cache）（P1-3 范围声明），导出 CSV（P0-5 修正）
    ```powershell
    & "D:\Program Files\Everything\es.exe" "Trae" -path "E:\Users\WIN_11\AppData\Local" -s -size -export-csv "$InventoryDir\inventory-e-local-trae.csv"
    & "D:\Program Files\Everything\es.exe" -path "E:\Users\WIN_11\AppData\Local\uv\cache" -size -s -export-csv "$InventoryDir\inventory-e-uv-cache.csv"
    & "D:\Program Files\Everything\es.exe" -path "E:\Users\WIN_11\AppData\Local\claude-cli-nodejs" -size -s -export-csv "$InventoryDir\inventory-e-claude-cache.csv"
    ```
    > **注意**：UV cache 和 Claude CLI cache 属其他 AI 工具缓存，仅纳入盘点报告，不自动清理。
  - [ ] SubTask 5b.3: 统计 E 盘 TRAE 相关目录总大小
  - **完成后**：主 agent 确认结果，进入 Phase 2

## Phase 2: 文件分类、垃圾识别与对话记录索引（串行，主 agent + 子 agent）

> Phase 3（对话记录索引）合并到此 Phase（P2-3 优化）

- [ ] Task 6: 对比扩展注册表与实际目录，识别扩展残留
  - [ ] SubTask 6.1: 读取 `C:\Users\JasonPC\.trae-cn\extensions\extensions.json`，提取活跃扩展 ID 列表
  - [ ] SubTask 6.2: 读取 `.obsolete` 文件，提取已卸载扩展标记
  - [ ] SubTask 6.3: 对比 `extensions/` 下实际目录 vs 注册表条目，列出无对应条目的残留目录

- [ ] Task 7: 对 Phase 1 盘点结果执行 6 级分类标注（P2-2 拆分）
  > **V2-17 修正**：分类与规则匹配应**脚本化**执行（`Import-Csv` + 规则匹配函数），非 LLM 逐文件判定。LLM 仅处理规则外例外与人工判定清单。数十万文件不可由 LLM 逐个判定（token 不可扩展且结果不可复现）。
  - [ ] SubTask 7.1: 按分类矩阵规则标注每个文件的分类（A-核心/B-配置/C-用户数据/D-临时/E-冗余/F-扩展残留）
  - [ ] SubTask 7.2: 对混合目录（[C/D-混合]）按"混合目录分解规则"逐一判定每个文件分类
  - [ ] SubTask 7.3: 验证每个文件有且仅有一个分类标签
  - [ ] SubTask 7.4: 将分类结果导出为 CSV（V2-03 新增：分类结果必须落盘，供增量模式复用与中断恢复）
    ```powershell
    # 分类结果导出（文件路径 + 分类标签 + 大小 + 修改时间）
    $classification | Export-Csv "$InventoryDir\classification-$ExecutionId.csv" -Encoding UTF8 -NoTypeInformation
    ```

- [ ] Task 7b: 垃圾识别与风险评估（P2-2 拆分）
  - [ ] SubTask 7b.1: 对 D/E/F 类文件匹配 21 条垃圾识别规则（含年龄阈值和大小阈值过滤）（P0-6 修正：17→21）
  - [ ] SubTask 7b.2: 对同一文件匹配多条规则时，按优先级仲裁（specific > general），记录"命中规则 X（优先于 Y）"
  - [ ] SubTask 7b.3: 对每个垃圾文件标注风险等级（低/中/高）+ 预计回收空间
  - [ ] SubTask 7b.4: 生成可清理清单（按风险等级排序）
  - [ ] SubTask 7b.5: 将垃圾识别结果导出为 CSV（V2-03 新增：垃圾清单必须落盘，供清理执行与增量模式复用）
    ```powershell
    # 垃圾清单导出（文件路径 + 分类 + 规则 + 风险 + 预计回收空间）
    $junkList | Export-Csv "$InventoryDir\junk-$ExecutionId.csv" -Encoding UTF8 -NoTypeInformation
    ```

- [ ] Task 8: 子 agent 收集并结构化整理所有对话记录（P2-4 工具依赖）
  - [ ] SubTask 8.1: 汇总五个根目录中定位到的所有 SQLite 数据库和 JSON 对话文件（含 E 盘 CKG 数据库）（P0-5 口径修正）
  - [ ] SubTask 8.2: 提取每条对话记录的创建时间、对话类型、关联功能模块（V3 §24/§25: SQLite 只读 + 对话证据模型）
    ```powershell
    # V3 §24: 检查 sqlite3 可用性
    python -c "import sqlite3; print(sqlite3.sqlite_version)"
    # V3 §24: 使用 mode=ro URI 只读连接，禁止 write/VACUUM/checkpoint
    # Python 示例：
    #   conn = sqlite3.connect("file:<db_path>?mode=ro", uri=True)
    #   cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    ```
    V3 §25 对话证据分类流程（每个 DB 候选必须走完）：
      1. Database Candidate（es.exe 发现 .db/.sqlite 文件）
      2. Schema Inspection（读取 sqlite_master 表结构）
      3. Table Classification（按表名/列名判断是否为对话表）
      4. Conversation Evidence（抽样查询确认含对话内容）
      最终分类: conversation_confirmed / conversation_probable / non_conversation / unknown
    特别检查: file_cache.db, CKG database, globalStorage, cache DB — 必须检查表结构和实际内容，不可仅凭文件名判断
  - [ ] SubTask 8.3: 生成结构化对话记录索引表（Markdown 表格）

## Phase 3: 臃肿根源分析与报告生成（主 agent）

- [ ] Task 9: 分析磁盘占用热点
  - [ ] SubTask 9.1: 汇总全部盘点 CSV 文件（五个根目录 → 6 盘点 Task → 10 CSV，E 盘拆为 5a/5b）（V2-13 修正：口径统一为 10 份），按目录维度统计 Top 20 占用空间最多的目录
  - [ ] SubTask 9.2: 按文件类型维度统计各类文件的总占用
  - [ ] SubTask 9.3: 识别臃肿根源（冗余备份堆积 / 日志膨胀 / 扩展残留 / venv 占用 / 临时脚本堆积 / E 盘 AppData 日志 / WebView 缓存 / UV cache）

- [ ] Task 10: 生成详细汇总报告
  - [ ] SubTask 10.1: 文件系统整体结构可视化（树形图 + 各目录说明 + 文件数量统计）
  - [ ] SubTask 10.2: 垃圾文件清理建议表（文件路径 / 规则 / 风险 / 建议操作 / 预计回收空间）
  - [ ] SubTask 10.3: 对话记录索引表 + 存储优化方案
  - [ ] SubTask 10.4: IDE 臃肿根源分析 + 改进建议（预防性措施 + 量化触发条件）
  - [ ] SubTask 10.5: 生成可复用模板（按 spec 定义的 schema 填充）
  - [ ] SubTask 10.6: 生成盘点基线快照 `baseline-$ExecutionId.json`（供增量模式对比）

## Phase 4: 安全清理执行（需用户批准后执行）

- [ ] Task 11: 创建备份点（P4-1 扩大范围 + P4-2 增强 + P4-3 磁盘预检）
  - [ ] SubTask 11.1: 磁盘空间预检（确认备份目标磁盘剩余空间 > 预估备份体积 × 1.5）
  - [ ] SubTask 11.2: 对 `C:\Users\JasonPC\.trae-cn\` 创建备份快照（V2-07 修正：复制到 `$BackupDir\backup-$ExecutionId\`；V2-08 修正：排除 `work/`、`feifei-ii-test-mock/`、`*.log`、`trae-jwt-token`；V2-23 修正：使用 `robocopy /E /XJ /SL`）
    ```powershell
    robocopy "C:\Users\JasonPC\.trae-cn" "$BackupDir\backup-$ExecutionId" /E /XJ /SL /XD "work" "feifei-ii-test-mock" /XF "*.log" "trae-jwt-token"
    ```
  - [ ] SubTask 11.3: 对安装区关键文件 `D:\Trae CN\resources\app\product.json` 创建单文件备份
  - [ ] SubTask 11.4: 对 E 盘 TRAE AppData 关键配置（`settings.json`）创建备份
  - [ ] SubTask 11.5: 首次执行时对工作区 C 类数据（`sessions/`、`memory/`、`agents/`、`.learnings/`）创建备份
  - [ ] SubTask 11.6: 验证备份完整性（文件数量一致 + 总大小偏差 < 1% + B 类/A 类关键文件 SHA256 比对）
  - [ ] SubTask 11.7: 备份轮转（V2-21 新增：保留最近 2 份备份，验证通过后删除旧备份）
    ```powershell
    $backups = Get-ChildItem "$BackupDir\backup-*" -Directory | Sort-Object Name -Descending
    if ($backups.Count -gt 2) {
        $backups | Select-Object -Skip 2 | Remove-Item -Recurse -Force
    }
    ```

- [ ] Task 12: 执行清理（串行，P4-7 事务日志 + P4-6 headless 策略）
  - [ ] SubTask 12.1: TRAE 进程检查（精确匹配，避免误报 VS Code）
    ```powershell
    $traeProcs = Get-Process | Where-Object { $_.ProcessName -match '^Trae' -or $_.Path -like 'D:\Trae CN\*' }
    if ($traeProcs) { Write-Warning "检测到 TRAE 相关进程运行中" }
    ```
  - [ ] SubTask 12.2: 清理低风险项（自动执行，写入事务日志，含文件锁重试 N14）
    - 日志（受年龄阈值约束：仅清理 > 7 天的日志）
    - 测试 mock、产品备份、清理标记（RULE_JUNK_TEMP）
    - 构建日志（受年龄阈值约束）
    - venv（P0-4 修正：已降为中风险，移至 SubTask 12.3）
    - VM cache（受大小阈值约束：优先清理 > 50MB）
    - 工作区 Cache/ 目录 JSONL 缓存（RULE_JUNK_WORKSPACE_CACHE，受年龄阈值约束）
    - *.tmp 文件（RULE_JUNK_TMP，受年龄阈值约束 3 天）
    - *.bak 文件（RULE_JUNK_BACKUP 扩展，保留最近 1 份）
    - E 盘临时文件（受年龄阈值约束：仅清理 > 3 天的）
  - [ ] SubTask 12.3: 清理中风险项（含竞态条件防护 N9）
    - **备份后竞态重检**：清理前重新检查 TRAE 进程，若已启动则**中止清理**（V3 §23：不杀进程，改为 ABORT_CLEANUP / pending-review）
    - **交互模式**：逐项人工确认后清理
    - **Headless 模式**：跳过并记录到 `$ReportDir\pending-review-$ExecutionId.md`
    - 涉及：work 临时文件、扩展残留、工作区临时脚本、WebView 缓存
    - 工作区 temp/test/.todo 目录（RULE_JUNK_WORKSPACE_DIR，逐项确认，P2-7 补充：目录内最新文件修改时间 > 14 天）
    - venv（RULE_JUNK_VENV，P0-4 修正：中风险，仅清理 > 100MB，需检测活跃进程后确认）
    - UV cache（RULE_JUNK_UV_CACHE，需用户确认）
    - E 盘 settings.json 旧模式残留（RULE_JUNK_LEGACY_SETTINGS，需确认）
  - [ ] SubTask 12.4: 清理冗余备份（保留最近 1 份，删除其余）
  - [ ] SubTask 12.5: 每项操作前写入事务日志（`$ReportDir\cleanup-transaction-$ExecutionId.log`）

- [ ] Task 13: 清理后验证
  - [ ] SubTask 13.1: 验证 TRAE IDE 可正常启动（V2-16 修正：定义启动命令 + 验证后关闭）
    ```powershell
    Start-Process "D:\Trae CN\Trae CN.exe"
    Start-Sleep -Seconds 60
    $proc = Get-Process | Where-Object { $_.ProcessName -match '^Trae' -and $_.MainWindowHandle -ne 0 }
    $newLog = Get-ChildItem "$TraeConfigDir\logs" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-2) }
    # 验证后关闭 TRAE（避免污染后续进程检查）
    if ($proc) { Stop-Process -Id $proc.Id -Force }
    ```
    > Headless 模式：跳过启动验证，记录"无法验证"到报告
  - [ ] SubTask 13.2: 统计清理前后磁盘占用对比
  - [ ] SubTask 13.3: 生成清理执行报告（清理了什么 / 回收了多少 / 验证结果 / 待确认清单）

- [ ] Task 13b: 回滚流程（P4-4 新增，仅在 Task 13 验证失败时执行）
  - [ ] SubTask 13b.1: 从 `$BackupDir\backup-$ExecutionId\` 恢复被清理的文件
  - [ ] SubTask 13b.2: 重新验证 IDE 启动
  - [ ] SubTask 13b.3: 记录回滚事件到事务日志
  - [ ] SubTask 13b.4: 向用户报告回滚原因和受影响文件

# Task Dependencies（严格串行）

```
Task -1 → Task -0.5 → Task 0 → Task 0b → Task 1 → Task 2 → Task 3 → Task 4 → Task 5a → Task 5b
                                                                                                ↓
                                                                                      Task 6 → Task 7 → Task 7b → Task 8
                                                                                                            ↓
                                                                                                Task 9 → Task 10
                                                                                                            ↓
                                                                                                 [交互模式:用户批准 / Headless:低风险自动+中高pending]
                                                                                                            ↓
Task 11 → Task 12 → Task 13 → [验证失败?] → Task 13b
```

- Task -1：中断恢复检查（进度文件 + Engram 双重恢复）
- Task -0.5：Environment Discovery / Reconciliation（V3 §2 新增：确认当前 PC 真实部署状态）
- Task 0-0b：预检（Everything CLI 健康 + 磁盘空间 + 目录验证 + 环境检测）
- Task 1-5b：串行盘点（每个完成后主 agent 确认 + 写入进度文件 再派下一个）
- Task 6-8：分类、垃圾识别、对话记录索引（依赖 Phase 1 全部完成）
- Task 9-10：分析与报告（依赖 Task 6-8 完成）
- Task 11-13：清理执行（依赖 Task 10 + 用户批准）
- Task 13b：回滚（仅在 Task 13 验证失败时触发）
