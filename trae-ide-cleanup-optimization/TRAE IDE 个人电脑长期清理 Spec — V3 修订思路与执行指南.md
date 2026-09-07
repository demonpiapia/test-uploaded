# TRAE IDE 个人电脑长期清理 Spec
## V3 修订思路与本地 Agent 执行指南

## 0. 修订目标

本次修订的目标不是把 Spec 改造成跨电脑、跨用户、跨 TRAE 版本的通用清理规范。

本项目的真实目标是：

> 为当前这台 Windows PC 建立一套可长期复用的 TRAE IDE 维护规则，使后续每次清理都能够：
>
> 1. 首先确认当前 PC 上 TRAE 的真实部署状态；
> 2. 在历史经验和当前真实状态之间进行校准；
> 3. 使用固定的个人清理政策进行盘点、分类和清理；
> 4. 保留当前 PC 的特殊路径、特殊目录和特殊历史问题；
> 5. TRAE 升级后能够识别环境事实是否发生变化；
> 6. 清理行为可恢复、可审计、可中断续接；
> 7. 不因为“文件大”“文件名看起来像临时文件”就误删真实用户数据。

因此，本版本不追求“Universal TRAE Cleanup Spec”。

推荐定位名称：

**TRAE IDE Personal Maintenance Spec — Jason-PC**

---

# 1. 首要设计原则

本次修订必须建立以下原则，并贯穿 `spec.md`、`tasks.md`、`checklist.md`：

### 原则 1：Policy 可以复用，Environment Fact 不能盲信

长期稳定的是：

- 分类规则；
- 风险规则；
- 垃圾识别规则；
- 年龄阈值；
- 大小阈值；
- 备份规则；
- 回滚规则；
- 中断恢复规则；
- 报告规则。

可能发生变化的是：

- TRAE 安装目录；
- TRAE runtime profile；
- 用户数据目录；
- 扩展目录；
- WebView / SQLite / CKG 数据位置；
- 某些缓存目录；
- Electron 参数；
- 当前 TRAE 版本对应的数据结构。

因此：

> Spec 复用的是“怎么判断”，不是“永远相信以前发现的路径”。

---

### 原则 2：当前 PC 的特殊路径允许写死

以下信息可以保留：

- `C:\Users\JasonPC\...`
- `D:\Trae CN\...`
- `E:\Users\WIN_11\...`
- `D:\AI\Workspace`
- `D:\workspace`
- 当前 PC 特有的 TRAE 工作区；
- 当前 PC 特有的 AI 工具目录；
- 当前 PC 特有的历史遗留目录。

这是本项目的设计目标，不需要为了“通用性”强行抽象掉。

但是必须给这些信息增加：

- `role`
- `status`
- `last_verified`
- `verification_method`
- `confidence`

---

### 原则 3：历史事实不是永久事实

例如：

当前发现：

```text
C:\Users\JasonPC\.trae-cn\
```

可能只承担扩展相关职责。

而当前运行实例的真实 profile 可能位于：

```text
E:\Users\WIN_11\AppData\Roaming\Trae CN\
```

因此不能再把旧判断：

```text
.trае-cn = 当前 TRAE 运行 profile
```

视为永久架构事实。

这类信息必须进入：

**Current Environment Profile / Environment Facts**

而不是不可变的分类规则。

---

# 2. 第一优先级：增加 Environment Reconciliation 阶段

当前 Spec 应增加一个比原 Phase 0 更早的阶段：

```text
Phase -0.5: Environment Discovery / Reconciliation
```

推荐流程：

```text
开始执行
  ↓
读取当前 PC Profile
  ↓
发现 TRAE 当前运行实例
  ↓
检查 TRAE 进程
  ↓
分析启动参数
  ↓
检查实际数据目录
  ↓
检查最近文件活动
  ↓
检查安装目录
  ↓
检查扩展目录
  ↓
与历史 Environment Profile 比较
  ↓
是否发生变化？
  ├─ 否 → 使用现有 Profile
  └─ 是 → 标记 Profile Changed
             ↓
          更新 Profile
             ↓
          旧 baseline 标记 stale
  ↓
继续 Phase 0
```

---

# 3. TRAE 当前真实 profile 的发现优先级

本次修订必须避免：

> “进程 argv 里看到什么路径，就直接认为那是真实用户数据路径”。

推荐证据等级：

### Level 1：Runtime Evidence

优先级最高：

- 当前 TRAE 进程命令行；
- 当前 TRAE 实际打开/写入的文件；
- 当前运行期间新增/修改的日志；
- 当前 runtime profile 中明显持续变化的数据。

### Level 2：Configuration Evidence

包括：

- TRAE 配置文件；
- Electron / VSCode profile 设置；
- extensions registry；
- 相关运行配置。

### Level 3：Filesystem Evidence

包括：

- 目录结构；
- 修改时间；
- 文件数量；
- 最近活跃文件。

### Level 4：Historical Evidence

包括：

- 旧 baseline；
- 过去的 Spec；
- 以前 Agent 的判断。

历史信息只能作为候选，不得覆盖当前高等级事实。

---

# 4. 本机 Environment Profile 建议结构

建议在 `$ReportDir` 或独立 `environment/` 中维护：

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
    verification_method:
      - filesystem
      - process

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
    verification_method:
      - process
      - filesystem
      - runtime-activity

workspaces:
  - path: "D:\\AI\\Workspace"
    role: mixed-workspace

  - path: "D:\\workspace"
    role: mixed-workspace

excluded:
  - "F:\\"
```

注意：

这里的路径可以写死，因为这是“本机 Profile”。

---

# 5. `spec.md` 的结构应重新划分

建议将当前 Spec 调整为以下结构：

```text
1. Purpose
2. Scope
3. Operating Principles
4. Current PC Environment Profile
5. Environment Reconciliation
6. Scan Targets
7. Classification Policy
8. Junk Rules
9. Risk Policy
10. Conversation Indexing
11. Inventory Strategy
12. Incremental Baseline
13. Backup / Rollback Policy
14. Transaction Model
15. Interruption Recovery
16. Reporting
17. Maintenance / Versioning
```

其中：

### “当前 PC 目录结构”

不再和“长期政策”混在一起。

改成：

```text
Current PC Environment Profile
Current Baseline
```

---

# 6. 将“Scan Targets”替换“固定五根目录”概念

当前“五个根目录”概念已经不够准确。

实际情况已经是多个扫描目标，例如：

```text
TRAE extension data
TRAE runtime profile
TRAE install
Workspace 1
Workspace 2
E:\Users\临时文件
E:\tmp
UV cache
Claude CLI cache
aha_doctor
```

因此改成：

```yaml
scan_targets:
```

每个 Target 具有：

```yaml
id
path
role
scope
classification_policy
cleanup_policy
enabled
```

例如：

```yaml
- id: trae-runtime-profile
  path: "E:\\Users\\WIN_11\\AppData\\Roaming\\Trae CN"
  role: runtime-profile
  enabled: true

- id: trae-extension-data
  path: "C:\\Users\\JasonPC\\.trae-cn"
  role: extension-data
  enabled: true
```

这样以后发现新目录，只增加一个 Scan Target。

不需要重新设计整个 Spec。

---

# 7. 重新定义“空间热点”和“清理候选”

必须明确：

```text
Space Hotspot
≠
Cleanup Candidate
```

例如：

```text
E:\Users\WIN_11\AppData\Roaming\Trae CN
≈ 2.6 GB
```

即使它很大，也不能因为空间大就进入删除候选。

应该有：

```text
HEALTHY_LARGE_DIRECTORY
```

状态。

只有同时满足清理规则和安全条件，才进入：

```text
CLEANUP_CANDIDATE
```

建议概念模型：

```text
Discovered
    ↓
Classified
    ↓
Space Hotspot / Normal
    ↓
Cleanup Rule Matched?
    ↓
Evidence Check
    ↓
Cleanup Candidate
```

---

# 8. 分类矩阵保持六级，但修正文案

六级分类继续保持：

```text
A Core
B Config
C User Data
D Temporary
E Redundant
F Extension Residual
```

这是目前设计中比较成熟的部分，不建议推翻。

但是 B 类定义需要从：

> “TRAЕ 配置区根目录下 JSON”

改成：

> “TRAE 配置区内明确属于功能性配置的白名单文件”。

因为：

```text
permission/global.json
extensions/extensions.json
```

等文件并不都位于根目录。

推荐：

```yaml
protected_config_paths:
  - hooks.json
  - sandbox.json
  - argv.json
  - permission/global.json
  - extensions/extensions.json
  - skill-config.json
```

不要使用“所有 JSON”这种宽泛规则。

---

# 9. 保留混合目录分解规则，但升级为 Evidence-Based Classification

当前：

> 混合目录中无法判断时默认 C。

这个原则可以保留，属于正确的保守策略。

但是增加：

```text
classification_confidence:
  high
  medium
  low
```

例如：

```text
C / high
C / medium
C / low
```

低置信度项目进入 review，而不是直接清理。

最终：

```text
classification
classification_confidence
classification_reason
matched_rule
```

都应该落到 CSV。

---

# 10. 重写垃圾规则的“可信度模型”

当前 21 条规则可以继续保留，不需要因为这次修订而大量增加新规则。

但是增加：

```text
evidence_level
```

推荐：

```text
CONFIRMED
LIKELY
SUSPECTED
```

定义：

### CONFIRMED

有明确生命周期证据，例如：

- `.cleanup`
- 已确认 obsolete extension
- TRAE 专属旧日志
- product.json.backup
- 明确的 runtime cache

可以自动清理。

### LIKELY

满足多个条件：

- 路径
- 文件名
- 年龄
- 当前版本关系
- 进程状态

可以进入人工批准。

### SUSPECTED

只有：

```text
文件名像垃圾
+
很久没修改
```

不得自动删除。

---

# 11. 工作区规则必须明显收紧

当前最需要修改的是：

```text
*.txt
*.json
*.ps1
*.py
test/
temp/
.todo/
```

不能因为名字或年龄就直接认为是垃圾。

尤其：

```text
*.json
*.ps1
*.py
```

完全可能是正式项目资产。

因此：

### 禁止

```text
workspace/*.json older than 14 days → cleanup
```

### 改成

必须至少满足两个或以上证据：

```text
路径上下文
+
文件命名模式
+
生命周期标记
+
明确生成工具
+
非 Git tracked
+
年龄阈值
```

对于 Git 工作区，特别建议检查：

```text
git status
git ls-files
```

如果文件被 Git 跟踪：

> 默认禁止列为自动清理候选。

---

# 12. Workspace Cache、temp、test、.todo 目录也不要“整目录删除”

当前规则：

```text
temp/
test/
.todo/
```

容易误删用户仍在使用的内容。

改成：

```text
目录级候选
↓
检查目录内最新文件
↓
检查 Git tracking
↓
检查运行中进程
↓
检查最近修改
↓
风险评估
↓
人工批准
```

只允许非常明确的临时目录自动删除。

---

# 13. Backup Rule 必须按“逻辑文件”分组

不能：

```text
整个目录所有 *.bak
→ 只保留最近一份
```

正确方式：

```text
logical basename grouping
```

例如：

```text
global.json.backup.1
global.json.backup.2

hooks.json.backup.1
hooks.json.backup.2
```

分别：

```text
global.json → 保留最新
hooks.json → 保留最新
```

并要求：

```text
current file exists
+
backup basename matches
```

才允许删除旧备份。

---

# 14. Everything CLI 执行层必须重新实现

这是本次修订的 P0。

必须把所有 `es.exe` 调用统一收敛到：

```text
Invoke-EverythingQuery
```

同时不要再复制粘贴裸 `es.exe` 命令作为“实际执行代码”。

文档里的代码只能表示参数语义。

---

# 15. 修正 Everything CSV 参数

当前 Spec / Tasks 中的：

```powershell
-csv-encoding "utf-8"
```

应删除。

不要把它继续作为规则。

统一：

```powershell
-export-csv "$OutputFile"
```

如果确实需要 BOM，再显式使用支持的方式。

这项修改必须同步：

```text
spec.md
tasks.md
checklist.md
```

否则会重新产生三份不一致的事实源。

---

# 16. `Invoke-EverythingQuery` 必须返回结构化状态

不要：

```powershell
return Get-Content $out
```

建议：

```powershell
[pscustomobject]@{
    Success    = $true/$false
    ExitCode   = $p.ExitCode
    Stdout     = ...
    Stderr     = ...
    OutputFile = ...
    DurationMs = ...
    Attempts   = ...
}
```

至少区分：

```text
SUCCESS
EMPTY_RESULT
TIMEOUT
PROCESS_ERROR
INVALID_ARGUMENT
IPC_ERROR
EXPORT_ERROR
UNKNOWN_ERROR
```

这样后面的：

```text
空结果
索引不完整
Everything 失败
路径为空
```

才能被准确区分。

---

# 17. Everything 临时输出必须唯一

禁止：

```powershell
$env:TEMP\es-out-$PID.txt
```

因为同一 Agent 内允许并发查询时，会发生输出竞争。

必须使用：

```text
PID + GUID
```

例如：

```powershell
es-out-$PID-$(New-Guid).txt
es-err-$PID-$(New-Guid).txt
```

执行结束清理临时文件。

---

# 18. D:\workspace 分批扫描必须改成“明确的 FullPath / SafeFileName”

当前：

```powershell
"D:\workspace\$($subdir.Trim())"
```

存在对子目录输出格式的隐含假设。

修订时必须明确：

```text
subdir_name
full_path
batch_id
batch_csv
```

不要用未经验证的 CLI 输出直接进行字符串拼接。

建议：

```text
batch_id = GUID
batch_csv = workspace2-$batch_id.csv
```

而不是直接把目录名拼进文件名。

---

# 19. 空结果必须分成三种情况

当前逻辑：

```text
路径存在 + Everything 返回 0
→ index may be incomplete
```

过于简单。

改为：

```text
Path Missing
    = PATH_UNAVAILABLE

Path Exists + Query Success + 0 rows
    = VALID_EMPTY

Path Exists + Query Failed
    = QUERY_FAILURE

Path Exists + Query Timeout
    = QUERY_TIMEOUT
```

不能把：

```text
真正没有文件
```

和：

```text
Everything 查询失败
```

混在一起。

---

# 20. 环境检测语义统一

当前 Spec 曾经存在：

```text
检测环境
→ 自动扩展扫描范围
```

与：

```text
检测环境
→ 仅提示，不自动扩展
```

两个版本。

V3 统一采用后者：

> **Environment Detection / Reconciliation 默认是 advisory + profile update，不自动改变清理范围。**

除非 Scan Target 明确被启用。

例如：

```text
WSL detected
```

不等于：

```text
自动扫描整个 WSL
```

而是：

```text
报告发现 WSL
→ 是否存在 TRAE 相关数据？
→ 只有验证后才加入 Scan Target
```

---

# 21. Capability Detection 和 Deployment Detection 分开

不要：

```powershell
Get-Command docker
```

就判定：

```text
CONTAINER = active
```

正确：

```text
docker_installed = true
```

只是能力。

真正需要的是：

```text
trae_container_usage = confirmed / probable / unknown
```

同理：

```text
wsl_available
```

不等于：

```text
TRAE_using_WSL
```

---

# 22. TRAE 进程状态不要默认 Force Kill

修订：

```text
TRAE running
    ↓
cleanup blocked
```

交互模式：

```text
提示关闭 TRAE
```

Headless：

```text
相关项进入 pending-review
```

默认不能：

```powershell
Stop-Process -Force
```

只有明确的授权策略才允许强制关闭。

特别要删除所有：

> “检测到已启动则终止 TRAE”

这种默认行为。

---

# 23. “备份后竞态”应该阻止 Cleanup，而不是杀用户进程

正确逻辑：

```text
Backup verified
    ↓
Re-check TRAE state
    ↓
TRAE running?
    ├─ Yes → ABORT CLEANUP / PENDING
    └─ No → continue
```

安全目标是：

> 不在运行中的 TRAE 上进行可能影响 runtime 数据的一致性操作。

---

# 24. SQLite 规则必须落实到 Task

Checklist 已经规定：

```text
mode=ro
```

因此 Tasks 必须真正执行。

推荐：

```text
sqlite3
    ↓
URI filename
    ↓
mode=ro
```

并明确：

```text
禁止 write
禁止 VACUUM
禁止 checkpoint
禁止修改数据库
```

仅仅：

```powershell
python -c "import sqlite3"
```

只能证明模块存在，不能算安全策略已经执行。

---

# 25. “找到 SQLite”不等于“发现对话记录”

新增：

```text
Database Candidate
    ↓
Schema Inspection
    ↓
Table Classification
    ↓
Conversation Evidence
```

最终分类：

```text
conversation_confirmed
conversation_probable
non_conversation
unknown
```

尤其针对：

```text
file_cache.db
CKG database
globalStorage
cache DB
```

必须检查表结构和实际内容。

---

# 26. Backup 改成 Manifest 驱动

不要简单比较：

```text
source file count
vs
backup file count
```

因为备份本身存在排除项。

应建立：

```text
BackupManifest
```

每个需要备份的文件记录：

```text
source path
backup path
size
mtime
hash
backup status
```

再验证：

```text
expected_backup_files
=
actual_backup_files
```

这样：

```text
*.log
work/
feifei-ii-test-mock/
trae-jwt-token
```

等排除项不会破坏验证逻辑。

---

# 27. Rollback 也改成 Manifest 驱动

必须保证：

> 本次真正删除了什么，就能知道从哪里恢复。

增加：

```text
cleanup_transaction
rollback_manifest
```

每个删除动作：

```text
path
size
rule
risk
backup_path
action
result
```

只有：

```text
BACKUP_VERIFIED
```

之后才能：

```text
DELETE
```

---

# 28. 同盘备份从“备注风险”提升为配置策略

当前 Spec 已经指出：

> 备份与源同 D 盘存在同损风险。

V3 不要求一定跨设备，但必须显式建模：

```text
BACKUP_LOCATION_RISK
```

例如：

```text
same_volume = warning
different_volume = preferred
different_physical_disk = ideal
```

如果仍然使用同盘：

```text
report warning
```

不得默默当作安全备份。

---

# 29. Progress File 改造成明确状态机

当前进度文件增加：

```text
status
```

允许值：

```text
created
running
interrupted
failed
completed
rolled_back
```

同时增加：

```text
last_heartbeat
lease_id
last_error
```

防止两个执行实例同时操作。

---

# 30. Progress File 必须原子写入

禁止直接覆盖：

```text
progress.json
```

推荐：

```text
progress.tmp
    ↓
flush
    ↓
rename
```

保证中断时不会留下半个 JSON。

---

# 31. 增加 Execution Lock

同一台电脑同一时间只允许一个 cleanup execution。

例如：

```text
$ReportDir\execution.lock
```

锁中记录：

```text
execution_id
started_at
host
pid
```

如果检测到已有运行实例：

```text
ABORT_NEW_EXECUTION
```

避免两个 Agent 同时清理。

---

# 32. Engram 只作为恢复辅助，不作为权威状态

恢复优先级：

```text
1. 当前 execution progress
2. transaction / intermediate files
3. baseline / manifest
4. Engram
5. full restart
```

Engram 只负责：

> 在文件状态缺失或损坏时提供恢复线索。

不得出现：

```text
Engram 最新内容覆盖文件系统中更可信的状态
```

---

# 33. 增量模式改为 Manifest + 分片，而不是巨型 JSON

当前 Spec 已经认识到：

> 大目录基线 JSON 可能几十 MB，ConvertFrom-Json 成本高。

因此 V3 应直接修正。

建议：

```text
baseline/
├── manifest.json
├── trae-extension-data.csv
├── trae-runtime-profile.csv
├── install.csv
├── workspace1.csv
├── workspace2-part-001.csv
├── workspace2-part-002.csv
└── ...
```

`manifest.json` 只保存：

```text
execution_id
schema_version
timestamp
target summaries
file counts
total sizes
baseline files
```

文件明细放 CSV。

---

# 34. 明确增量模式的文件身份语义

继续采用：

```text
modified =
size changed OR mtime changed
```

可以保留。

但写清楚：

> 当前增量模型为“路径级变化检测”，不是内容级文件身份检测。

因此：

```text
rename
```

可能表现为：

```text
removed + added
```

这不是 bug。

---

# 35. Cleanup Candidate 增加决策证据

建议 CSV 至少包含：

```text
path
classification
confidence
matched_rule
rule_priority
risk
evidence
age_days
size
active_reference
git_tracked
backup_available
recommended_action
```

这样以后 Agent 或人可以解释：

> 为什么这个文件被认为可以删。

---

# 36. 风险模型升级为双维度

建议不要只使用：

```text
low / medium / high
```

增加：

```text
deletion_risk
recovery_confidence
```

例如：

```text
product.json.backup
deletion_risk = low
recovery_confidence = high
```

而：

```text
WebView IndexedDB
deletion_risk = medium/high
recovery_confidence = medium
```

这比单一 risk 更准确。

---

# 37. Startup Check 改称“Startup Smoke Test”

当前：

```text
进程存在
+ 新日志
+ 无 fatal/crash
```

作为基本验证是合理的。

但不要写成：

```text
IDE fully healthy
```

应命名：

```text
STARTUP_SMOKE_PASS
```

因为这只证明：

> TRAE 在基本启动层面可运行。

不能证明所有功能均正常。

---

# 38. Headless 模式必须显式降低验证等级

Headless 模式：

```text
自动低风险清理
中高风险 → pending-review
启动验证不执行
```

那么最终报告不能写：

```text
cleanup verified
```

应该：

```text
cleanup completed
postcheck = not_run
verification_confidence = degraded
```

这样报告才能保持绝对真实。

---

# 39. Tasks 与 Checklist 必须从 Spec 的单一事实源派生

这是长期维护非常重要的一项。

当前：

```text
spec.md
tasks.md
checklist.md
```

存在大量重复数据：

```text
21 rules
10 CSV
5 roots
backup exclusions
thresholds
risk levels
```

V3 不要求立刻开发生成器，但必须建立原则：

> **Spec 是政策真相源，Tasks 是执行真相源，Checklist 是验收真相源；三者不得各自独立定义规则。**

修改规则时：

```text
Policy changed
    ↓
Tasks updated
    ↓
Checklist updated
```

三者必须同步。

---

# 40. Checklist 重构

Checklist 建议拆成四层：

## A. Static Validation

检查：

- Spec 是否自洽；
- 规则数量；
- 参数是否存在；
- Tasks 是否覆盖 Spec；
- Checklist 是否覆盖 Tasks。

## B. Runtime Execution

检查：

- 实际扫描；
- 实际结果；
- 实际状态；
- 实际产物。

## C. Safety Validation

检查：

- backup；
- locks；
- process state；
- SQLite read-only；
- transaction log；
- rollback。

## D. Result Validation

检查：

- inventory 完整性；
- classification 完整性；
- junk candidates；
- recovered space；
- pending-review；
- postcheck。

不要再让“规则本身是什么”和“这次执行是否做到了”混在一起。

---

# 41. 当前 21 条 Junk Rules 不要继续扩张

V3 不建议继续增加大量规则。

核心目标：

```text
少量可靠规则
>
大量启发式规则
```

尤其是：

```text
*.json
*.txt
*.ps1
*.py
test/
temp/
```

这些应该收紧，而不是继续增加。

---

# 42. 把本机“已知目录结构”降级为 Baseline

当前 Spec 中大量：

```text
builtin/
builtin_skills/
CC-HAHA/
Claude-Code/
Abu/
Roo-code/
...
```

属于：

**Observed Baseline**

而不是：

**Policy**

修订后：

```text
Spec
  = 如何判断

Profile
  = 当前机器在哪里

Baseline
  = 当前机器目前有什么
```

三者严格区分。

---

# 43. 建议添加 Profile Staleness 机制

Environment Profile 增加：

```text
profile_version
last_verified
verification_revision
status
```

例如：

```text
ACTIVE
STALE
INVALID
```

触发 stale 的条件包括：

```text
TRAE 安装目录发生变化
TRAE executable 变化
profile 目录变化
重大版本升级
关键目录消失
进程参数发生结构变化
```

遇到 STALE：

> 本次不得直接执行危险清理，应先重新发现环境。

---

# 44. 推荐最终执行流程

V3 最终流程建议：

```text
Phase -1
Recovery Check
    ↓
Phase -0.5
Environment Discovery / Reconciliation
    ↓
Phase 0
Preflight
    ↓
Phase 1
Inventory
    ↓
Phase 2
Classification
    ↓
Phase 2.5
Evidence / Risk Evaluation
    ↓
Phase 3
Analysis + Report
    ↓
Approval Gate
    ↓
Phase 4
Backup
    ↓
Backup Verification
    ↓
Quiescence Verification
    ↓
Cleanup
    ↓
Transaction Logging
    ↓
Post-cleanup Smoke Test
    ↓
Success
    │
    └── Failure → Rollback
```

---

# 45. 本次修订的实际优先级

## P0：必须修复

1. `Environment Reconciliation`
2. 当前 TRAE runtime profile 重新确认
3. 修复 `-csv-encoding`
4. 重写 `Invoke-EverythingQuery`
5. exit code / stderr / timeout / retry
6. 唯一临时输出文件
7. 修复 workspace2 分批扫描
8. 不允许默认强杀 TRAE
9. workspace 垃圾规则收紧
10. SQLite read-only 真正落地

## P1：应该修复

11. Environment Profile 独立化
12. Scan Targets 重构
13. Backup Manifest
14. Rollback Manifest
15. Progress 状态机
16. Atomic progress write
17. Execution lock
18. Environment capability / deployment 分离
19. Conversation evidence model
20. Incremental baseline 分片化

## P2：长期优化

21. classification confidence
22. cleanup evidence
23. deletion risk + recovery confidence
24. Profile staleness
25. Tasks / Checklist 与 Policy 的单一事实源治理

---

# 46. 本次修订明确禁止的方向

本地 Agent 不要为了“完善”而做以下事情：

### 禁止 1

不要把 Spec 改成跨电脑通用规范。

### 禁止 2

不要删除当前 PC 特殊路径。

### 禁止 3

不要因为目录很大就定义为垃圾。

### 禁止 4

不要因为 `*.json` / `*.txt` / `*.ps1` / `*.py` 很久没改就自动删除。

### 禁止 5

不要把历史 baseline 当成当前事实。

### 禁止 6

不要让 Agent 凭经验逐文件猜测几十万文件。

### 禁止 7

不要为了“自动化”而降低清理安全门槛。

---

# 47. 本次修订后的核心心智模型

整个系统最终应遵循：

```text
              ┌────────────────────┐
              │      Policy        │
              │  长期稳定的清理规则 │
              └─────────┬──────────┘
                        │
                        │
              ┌─────────▼──────────┐
              │ Environment Profile│
              │  当前 PC 的真实环境 │
              └─────────┬──────────┘
                        │
                        │ reconciliation
                        ▼
              ┌────────────────────┐
              │  Current Baseline  │
              │ 当前实际文件与状态  │
              └─────────┬──────────┘
                        │
                        ▼
              ┌────────────────────┐
              │ Classification      │
              │ Evidence / Risk     │
              └─────────┬──────────┘
                        │
                        ▼
              ┌────────────────────┐
              │ Cleanup Candidates  │
              └─────────┬──────────┘
                        │
              approval / policy gate
                        │
                        ▼
              ┌────────────────────┐
              │ Backup + Transaction│
              └─────────┬──────────┘
                        │
                        ▼
              ┌────────────────────┐
              │ Cleanup             │
              └─────────┬──────────┘
                        │
                        ▼
              ┌────────────────────┐
              │ Smoke Test / Verify │
              └─────────┬──────────┘
                        │
                 failure? ────────→ Rollback
```

---

# 48. 最终验收标准

本次 V3 修订完成后，不要只检查“文档写得更完整”。

应检查以下几个问题：

### Q1

如果 TRAE 明天升级，导致真实 profile 从：

```text
E:\Users\WIN_11\AppData\Roaming\Trae CN
```

变到其他位置，系统能否发现变化？

### Q2

如果历史 Spec 错把某目录当成 runtime profile，当前执行能否纠正它？

### Q3

如果 workspace 中有一个 3 个月没改的 `config.json`，系统能否避免因为“JSON + 90 天”就删除它？

### Q4

如果 Everything CLI 返回 exit code 非 0，系统能否区分：

```text
query failed
```

和：

```text
valid empty result
```

### Q5

如果 Agent 执行到一半崩溃，能否恢复？

### Q6

如果备份完成后 TRAE 又启动了，系统是否会停止 cleanup，而不是强制杀 TRAE？

### Q7

如果清理后 TRAE 启动失败，能否准确知道：

```text
删了什么
备份在哪里
恢复什么
恢复后验证是否成功
```

### Q8

如果只看到一个 2.6 GB 的 TRAE 目录，但里面都是健康 runtime 数据，系统是否会：

```text
识别为 hotspot
```

而不是：

```text
识别为 junk
```

### Q9

如果下次执行发现本机环境和历史 Profile 不一致，是否会先 reconciliation，再 cleanup？

### Q10

如果只更改了一条垃圾规则，是否能够让 Spec / Tasks / Checklist 保持一致？

---

# 49. 本次修订的核心成功定义

V3 不以：

> “能清理更多文件”

作为成功标准。

而以：

> **“能够在多年运行周期里，始终知道当前 TRAE 在哪里、哪些东西属于真正垃圾、为什么可以删、删之前有没有可恢复副本、删完之后是否能够证明系统仍然正常。”**

作为成功标准。

最终应形成：

```text
固定个人维护政策
+
当前 PC 环境 Profile
+
持续更新 Baseline
+
安全 Cleanup Engine
+
可审计 Transaction Log
+
可恢复 Backup / Rollback
+
可验证 Smoke Test
```

这才是这份 Spec 最终应该达到的状态。