# Checklist

## 中断恢复检查（新增）

- [ ] 重入时已检查 `$ReportDir\progress-*.json` 进度文件是否存在
- [ ] 若进度文件存在，已加载并显示上次执行进度（Phase/Task/SubTask）
- [ ] 若进度文件不存在，已通过 Engram `mem_search("trae-cleanup-progress")` 查询
- [ ] 续接时已验证已完成任务的输出文件存在性（CSV 文件未损坏）
- [ ] 续接时已完成任务输出缺失的已标记为需重跑
- [ ] 中间数据目录 `$InventoryDir\intermediate\` 已创建
- [ ] 执行 ID `$ExecutionId` 已生成
- [ ] 进度文件 `$ProgressFile` 已初始化（续接或全新）
- [ ] 若续接，`interruption_count` 已递增
- [ ] 每个子任务完成后已立即写入进度文件（`completed_subtasks` 更新）

## Environment Reconciliation（V3 §2 新增）

- [ ] 历史 Environment Profile 已读取（若存在）
- [ ] TRAE 当前运行实例已发现（进程命令行 + ExecutablePath）
- [ ] install_dir 路径已验证（`D:\Trae CN` 存在且含 `Trae CN.exe`）
- [ ] extension_data_dir 路径已验证（`C:\Users\JasonPC\.trae-cn` 存在且含 `extensions/`）
- [ ] runtime_profile 路径已验证（`E:\Users\WIN_11\AppData\Roaming\Trae CN` 最近文件活动已检查）
- [ ] 与历史 Profile 比较结果已记录（ACTIVE / STALE / INVALID）
- [ ] 若 STALE：已更新 Profile，旧 baseline 已标记 stale
- [ ] Environment Profile 已生成/更新到 `$ReportDir\environment\profile.yaml`
- [ ] Capability Detection 已完成（Docker / WSL 仅记录能力，不自动扩展扫描）
- [ ] 环境检测为 advisory + profile update，未自动改变清理范围（V3 §20）

## 执行前预检

- [ ] Everything CLI 健康预检通过（`es.exe -version` 返回版本号 + 测试查询返回结果）
- [ ] 磁盘空间预检通过（剩余空间 > 预估备份体积 × 1.5）
- [ ] 目标目录存在性验证通过（5 个根目录均 `Test-Path` 通过，E 盘已挂载）（N7）
- [ ] TRAE 进程状态已检查（`Get-Process | Where-Object { $_.ProcessName -match '^Trae' -or $_.Path -like 'D:\Trae CN\*' }`，精确匹配不误报 VS Code）（N20）

## 环境类型检测（新增）

- [ ] SSH Remote 配置已检测（`Test-Path "C:\Users\JasonPC\.trae-cn\remoteHosts"`）
- [ ] WSL 环境已检测（`Get-Command wsl`）
- [ ] Dev Container 环境已检测（`Get-Command docker` + `.devcontainer/` 存在性）
- [ ] 多实例已检测（主窗口计数 `$traeMainProcs.Count`，若 > 1 则标记 MULTI。V2-02 修正：非进程计数）
- [ ] 环境检测结果已写入进度文件 `$ProgressFile` 的 `env_types` 字段
- [ ] 若检测到 SSH/WSL/CONTAINER/MULTI，已在报告中标注（V2-06 修正：环境类型为提示型检测，不自动扩展盘点范围）

## 盘点完整性

- [ ] 用户配置区 `C:\Users\JasonPC\.trae-cn\` 所有子目录均已递归盘点，无遗漏
- [ ] 安装区 `D:\Trae CN\` 所有子目录均已递归盘点，无遗漏
- [ ] 复合工作区 1 `D:\AI\Workspace` 所有子目录均已递归盘点，无遗漏
- [ ] 复合工作区 2 `D:\workspace` 所有子目录均已递归盘点，无遗漏（采用分批策略，每批超时 120 秒，失败批次不影响其他批次）（N21）
- [ ] E 盘 TRAE AppData `E:\Users\WIN_11\AppData\Roaming\Trae CN\` 已盘点（Task 5a）
- [ ] E 盘临时文件 `E:\Users\临时文件\` 和 `E:\tmp\` 已盘点（Task 5b）
- [ ] E 盘 AppData Local（aha_doctor、uv cache、claude-cli cache）已盘点（Task 5b）
- [ ] MCP 缓存区 `C:\Users\JasonPC\.trae-cn\mcps\` 已盘点
- [ ] 对话记录存储位置已定位（含五个根目录中的 SQLite 数据库和 JSON 文件）
- [ ] 五个根目录的盘点结果均已导出 CSV 文件（UTF-8 编码）（N26 澄清：五个根目录 = 6 个 Task 的扫描目标）
- [ ] F 盘已排除（外置硬盘，不盘点）
- [ ] Task 5b 扫描边界明确：E 盘为指定子路径清单（非全量递归 `E:\Users\WIN_11\`）
- [ ] 增量模式检测：若 `$ReportDir\baseline-*.json` 存在则切换为增量模式（N15）
- [ ] CSV 空导出处理：路径存在但 Everything 返回 0 结果时已标记"索引可能不完整"（N28）

## 工具使用正确性

- [ ] 系统级查询全部使用 Everything CLI，未使用 Glob/Grep 做系统级搜索
- [ ] 工作区文件名搜索（Glob）结果已用 Everything CLI 校验结果数量
- [ ] 工作区内容搜索（Grep）已先用 Everything 校验文件列表完整
- [ ] 关键决策搜索直接使用 Everything CLI
- [ ] 未使用 SearchCodebase
- [ ] 未使用 Glob/Grep 做"系统是否安装 X"类判断（4 字符工具，历史曾误报 Chrome 未安装）
- [ ] Everything CLI 命令参数正确（-path、-size、-date-modified、-export-csv 等）
- [ ] Everything CLI 命令已通过 `Invoke-EverythingQuery` 包装器执行（超时 120 秒，重试 3 次）（N6，V2-04 修正：tasks 全部 es.exe 调用均走包装器，代码块为参数参考）
- [ ] `ext:` 语法仅用于文件扩展名（log/tmp/bak/db），未混入非扩展名模式如 "cache"（N5-3 修正）
- [ ] SQLite 搜索使用 `ext:db;sqlite;sqlite3;db3`（含 .sqlite3 和 .db3 扩展名）（N23）
- [ ] 按文件名/目录名搜索时使用关键词模式（非 ext:），如 `es.exe "cache" -path ...`
- [ ] 未同时使用 `-csv` 和 `-export-csv`（后者已隐含 CSV 格式，P5-5 精简）
- [ ] CSV 导出不使用 `-csv-encoding`（V3 §15 修正：该开关随版本变化，不作为规则）
- [ ] 导出的 CSV 文件可正常打开，包含完整路径、大小、修改时间
- [ ] 校验不一致时以 Everything CLI 为准，差异已记录到执行报告（P5-2）
- [ ] 空结果处理：查询前已 `Test-Path` 验证路径存在，空结果已标记告警（N12）
- [ ] 符号链接处理：盘点时不跟随 reparse point，备份时保留链接本身（robocopy /XJ /SL），统计时排除 reparse point 重复计数（N13，V2-23 修正：inode 去重→reparse point 排除）
- [ ] 变量名拼写正确：`$TraeConfigDir`（非 `$TraeConfigDdir`）（N24）

## 串行执行验证

- [ ] 盘点过程中任一时刻最多 1 个子 agent 运行
- [ ] 每个子 agent 完成后主 agent 确认结果才派下一个
- [ ] 未出现并行子 agent 派遣

## 分类准确性

- [ ] 每个文件均已标注 6 级分类之一（A-核心/B-配置/C-用户数据/D-临时/E-冗余/F-扩展残留）
- [ ] 每个文件**有且仅有一个**分类标签（P3-3 混合目录分解规则已执行）
- [ ] 分类结果已导出为 `classification-$ExecutionId.csv`（V2-03 新增：分类结果必须落盘）
- [ ] 混合目录（[C/D-混合]）下的文件已按分解规则逐一判定，无遗留未分类文件
- [ ] 混合目录内无法明确判定的文件已默认归入 C-用户数据（保守策略）
- [ ] A-核心类文件未被误标为可清理
- [ ] B-配置类仅限 TRAE 配置区根目录下的 JSON 白名单（`hooks.json`、`permission/global.json`、`argv.json` 等），工作区 JSON 未误标为 B（P3-4 修正，P1-8 白名单已补，V2-10 同步）
- [ ] B-配置类文件的备份版本已正确标为 E-冗余
- [ ] `.obsolete` 统一归入 F-扩展残留，未出现在 E-冗余中（P3-8 修正）
- [ ] `cc-haha/db/` 下的 SQLite 数据库标为 C-用户数据（非 D-临时），按分解规则 `*.db → C`（N2 修正）
- [ ] extensions.json 中的活跃扩展未被误标为 F-扩展残留
- [ ] 工作区中的用户数据（sessions/agents/memory/.learnings/.workbuddy）未被误标为 D-临时（P3-5 扩展）
- [ ] E 盘 CKG 数据库未被误标为 D-临时（属 C-用户数据，可能含对话记录）

## 垃圾识别

- [ ] 所有 `*.backup.*`、`*.备份.*` 和 `*.bak` 文件已识别并列入清理候选（N3 扩展）
- [ ] 所有 `*.log` 文件已识别，且仅清理超过年龄阈值（默认 7 天）的日志（P3-6 年龄阈值）
- [ ] `.obsolete` 标记的扩展残留目录已识别并列入清理候选
- [ ] `work/` 下的临时文件已逐项确认是否可清理
- [ ] `feifei-ii-test-mock/` 目录已列入清理候选
- [ ] 安装区 `product.json.backup.*` 已列入清理候选
- [ ] 工作区中的 `.runtime/venv/` 目录已识别并列出大小，优先清理 > 100MB 的（P3-7 大小阈值）
- [ ] 工作区中的构建日志（build*.log）已识别，受年龄阈值约束
- [ ] 工作区中的 `.claude.json.backup.*` 已识别并列入清理候选
- [ ] 工作区中的临时扫描脚本和输出文件已识别（受年龄阈值默认 14 天约束）
- [ ] `*.cleanup` 后缀文件和 `.cleanup/` 目录下所有文件已识别（RULE_JUNK_TEMP 定义已明确，N27 修正）
- [ ] 工作区 `Cache/` 目录下的 JSONL 缓存文件已识别（RULE_JUNK_WORKSPACE_CACHE，N4 新增）
- [ ] 工作区 `temp/`、`test/`、`.todo/` 目录已识别（RULE_JUNK_WORKSPACE_DIR，N5 新增）
- [ ] 全部盘点目录下的 `*.tmp` 文件已识别（RULE_JUNK_TMP，N11 新增）
- [ ] E 盘 `settings.json`（旧模式残留）已识别（RULE_JUNK_LEGACY_SETTINGS，N10 新增）
- [ ] E 盘临时文件（`E:\Users\临时文件\*.tmp/*.dll`）已识别，受年龄阈值（默认 3 天）约束
- [ ] E 盘 TRAE AppData logs/ 已识别，受年龄阈值约束
- [ ] E 盘 VMCache 已识别，优先清理 > 50MB 的
- [ ] E 盘 UV cache 已识别，风险等级为中，需用户确认（N1 修正：低→中）
- [ ] E 盘 WebView 缓存（IndexedDB/leveldb）已识别并标注中风险
- [ ] Claude CLI cache 已识别但标注为"不自动清理"（其他 AI 工具缓存）
- [ ] MCP 缓存"非当前 session"判定方法已执行（进程命令行/global.json/修改时间三选一）（N8 修正）
- [ ] 规则匹配优先级已执行（specific > general），重叠规则已仲裁（P3-2）
- [ ] 规则总数为 21 条（含 4 条新增：WORKSPACE_CACHE/WORKSPACE_DIR/TMP/LEGACY_SETTINGS，P3-1+N4+N5+N11+N10）
- [ ] 每个清理候选项已标注风险等级（低/中/高）

## 对话记录索引

- [ ] 对话记录存储位置已确认（含五个根目录中的 SQLite 数据库和 JSON 文件）
- [ ] E 盘 CKG file_cache.db 已检查是否含对话记录
- [ ] sqlite3 工具可用性已检查，且连接使用 `mode=ro` URI（V3 §24: 仅证明模块存在不等于安全策略已执行）
- [ ] 每条对话记录已提取创建时间
- [ ] 对话记录已按类型分类（如 AI 对话、调试对话等）
- [ ] 对话记录已关联到功能模块

## 报告质量

- [ ] 文件系统结构可视化图表已生成（树形图，覆盖五个根目录）
- [ ] 垃圾文件清理建议表包含：文件路径、匹配规则（含优先级仲裁）、风险等级、建议操作、预计回收空间
- [ ] 对话记录索引表已生成
- [ ] IDE 臃肿根源分析已完成（含具体数据支撑）
- [ ] 改进建议包含预防性措施和量化触发条件（P6-6）
- [ ] 可复用模板已按 spec 定义的扩展 schema 生成（含 per_directory/risk_distribution/failed_operations/thresholds_used）（N17）
- [ ] 盘点基线快照 `baseline-$ExecutionId.json` 已生成（按 N22 schema 格式）
- [ ] 执行报告按 N25 定义的 Markdown 格式生成（8 个章节）

## 安全保障

- [ ] 盘点阶段仅执行读取操作，未修改任何文件
- [ ] 备份范围完整：用户配置区 + 安装区 product.json + E 盘 AppData 关键配置 + 工作区 C 类数据（P4-1）
- [ ] 备份排除清单明确：`work/`、`feifei-ii-test-mock/`、`*.log`、`trae-jwt-token` 已排除，其余 D-临时一并备份（N19，V2-08 修正：补 trae-jwt-token）
- [ ] 备份完整性验证：文件数量一致 + 总大小偏差 < 1% + B/A 类文件全量 SHA256 比对 + 其他 10% 随机抽样（N18）
- [ ] 磁盘空间预检已执行（P4-3）
- [ ] 备份后竞态条件防护：清理前重新检查 TRAE 进程，若已启动则终止（N9）
- [ ] 中风险项在 headless 模式下已跳过并记录到 pending-review 文件（P4-6）
- [ ] 文件锁失败项已执行 3 次重试（间隔 5 秒），仍失败则记入 pending-review（N14）
- [ ] venv 目录清理前已确认无活跃 Python 进程引用
- [ ] WebView 缓存清理前已确认非活跃会话期
- [ ] 每项清理操作已写入事务日志（P4-7）
- [ ] 清理后已验证 TRAE IDE 关键配置文件完整
- [ ] 若验证失败，回滚流程已执行并记录（P4-4）
- [ ] 备份轮转已执行（保留最近 2 份，旧备份验证通过后已删除）（V2-21 新增）
- [ ] SQLite 连接使用只读模式（`mode=ro` URI），未触发 WAL checkpoint（V2-18 新增）
- [ ] 备份使用 robocopy /E /XJ /SL（排除联接点、保留符号链接）（V2-23 修正）
- [ ] 清理执行前已获用户批准（交互模式）或按 headless 策略执行（V2-15 新增）
- [ ] 启动验证使用定义的启动命令，验证后 TRAE 已关闭（V2-16 新增）
- [ ] 清理执行报告已生成（含清理前后磁盘占用对比 + 待确认清单）

## CodeBuddy 补充检查（新增）

- [ ] 产物一致性：CSV 产物 ≥ 10 个（5 根目录 + 5 E 盘子路径，含 Task 5b 新增），每个行数 > 0 或已按 N12 标注"索引可能不完整"（V2-13 修正：6→10）
- [ ] 增量正确性（增量模式）：delta 三清单（added/modified/removed）已生成，removed 项已从新基线剔除
- [ ] 高危授权复核：`.dll` 未出现在自动清理列表（P0-3）；`E:\tmp` 仅输出候选清单未直接清理
- [ ] 回滚可恢复性抽查：从备份随机取 1 个文件恢复到临时路径确认可读（演练恢复链路）
- [ ] 复发对比：本次 junk 统计与上次基线对比，新增垃圾项已定位来源（供臃肿根源分析）
- [ ] 进度文件唯一性：progress 文件名含 execution_id（时分秒），无同名冲突（P1-4）
