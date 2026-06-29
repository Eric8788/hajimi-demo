# Hajimi币系统交接文档

Last updated: 2026-06-05 Asia/Shanghai

这份文档用于新窗口继续讨论和构建 Hajimi币系统。它记录目前已经讨论出来的产品方向、预算口径、现有代码状态，以及建议的下一步实现顺序。

## 1. 新窗口先读这些文件

请按顺序阅读：

1. `docs/AI_CLUB_ECOSYSTEM.md`
2. `docs/SESSION_HANDOFF.md`
3. `HAJIMI_ARCHITECTURE.md`
4. `docs/HAJIMI_COIN_BUDGET_SYSTEM.md`
5. 本文件 `docs/HAJIMI_COIN_HANDOFF.md`

根目录规则仍然适用：

- 使用中文和 Eric 沟通。
- Hajimi 使用 Next.js、React、TypeScript、Vercel Postgres、raw SQL。
- 不引入 ORM。
- 不做 Tailwind-heavy rewrite。
- 数据库结构变化必须更新 `HAJIMI_ARCHITECTURE.md`。

## 2. 已确定的产品方向

Hajimi 后续应保留两套积分/货币体系：

| 体系 | 定位 | 是否消费 | 用途 |
|---|---|---:|---|
| XP | 经验值 | 否 | 等级、贡献、活跃度、排行榜 |
| Hajimi币 | 消费和激励货币 | 是 | 打赏、创作者奖励、老师项目悬赏、token 兑换 |

核心原因：

XP 代表历史贡献和等级，不能因为用户打赏或消费而下降。Hajimi币才承担预算和消费属性。这样可以同时保留成长感和真实激励。

Hajimi币按人民币预算记账：

```text
1 H币 = 1 元人民币等值 AI token 预算
```

但 H币不等于现金，不做自动提现。第一版优先兑换 token，由管理员人工审核。中转站涨价时，H币仍按人民币 1:1 记账，实际兑换到的 token 数量根据当月供应商价格调整。

## 3. 年度预算方向

预算思考稿已写入：

`docs/HAJIMI_COIN_BUDGET_SYSTEM.md`

当前版本按学院可能支持的最大容纳方案写：

- 年度封顶：50,000 元。
- 不按每月固定 5,000 元花。
- 预算节奏只分两类月份：
  - 在校月：2026.8-2026.12，2027.1，2027.3-2027.6，每月 4,000 元以内。
  - 寒暑假月：2027.2，2027.7，每月 1,500 元以内。
- 基础执行预算：`10 * 4,000 + 2 * 1,500 = 43,000`。
- 年度弹性预算：7,000。
- 年度总上限：50,000。

预算结构：

| 类别 | 年预算 |
|---|---:|
| 直接 token 使用预算 | 29,500 |
| Hajimi币激励预算 | 13,500 |
| 年度弹性预算 | 7,000 |
| 合计 | 50,000 |

教师 workshop 和教师 token 使用已纳入预算，按约 10 名老师加入 AI Club 的最大容纳情况考虑。

## 4. token 使用额度设想

不使用无限共享 key。每个学生/老师应使用独立 key、子账户或独立额度。

学生：

- 每个 AI Club 成员默认 25 元/月基础 token 额度。
- 每个开发中项目追加 25 元/月。
- 每人最多按 3 个开发中项目计算。
- 单人最高为 `25 + 75 = 100 元/月`。
- 开发中项目只通过每周产品迭代会议证明，不额外要求复杂材料。

教师：

- 教师 workshop 单次试用：20-30 元/人。
- 加入 AI Club 的活跃老师：50 元/月。
- 准备课堂 demo 或项目课的老师：50-100 元/月。
- 教师额度独立于学生额度。

这些 token 额度管理目前只是产品设想，尚未在 Hajimi 代码中实现。

## 5. Hajimi币发放规则设想

创作者是 H币的主要激励对象，来源简化为 5 类：

| 来源 | 奖励 |
|---|---:|
| 项目发布 | 50 H币 |
| 新版本发布 | 20 H币 |
| 用户打赏 | 实际收到 |
| 月榜奖励 | 150 / 125 / 100 / 75 / 50 H币 |
| 老师项目悬赏 | 100 H币 / 立项项目 |

普通用户不是主要发币对象，但可以通过少量贡献获得 H币：

| 来源 | 奖励 |
|---|---:|
| 认证空投 | 3 H币，一次性 |
| 有效项目评价 | 1 H币，每月最多 3 次 |
| 精品帖 / 精品文章 | 10 H币 |
| 月度精选内容 | 30 H币 |
| 活动贡献 | 按活动规则发放 |

实现口径：认证空投 v1 由管理员在 `/admin/coins` 筛选已认证且未停用用户，批量勾选后一次性发放统一数量和备注。每个用户都会写入 `coin_transactions` 账本；不新增自动防重复表，是否已空投过先由管理员通过备注和账本管理。

月度项目奖励：

- 在校月奖励前五项目。
- 奖励为 150 / 125 / 100 / 75 / 50 H币。
- 合计 500 H币/月。
- 获奖项目需要 10+ verified 月活。
- 寒暑假月可以暂停或顺延月榜。

老师项目立项：

- 未来 Hajimi 的模块化 Forum 中会有类似“活动与招聘”的板块。
- 老师可发布项目立项招聘帖、学科项目招募、活动协作帖。
- 每个老师立项项目默认悬赏 100 H币。
- Eric/admin 审核后发布。
- 学生被选中并正式立项后发放。
- 不做复杂里程碑拆分。
- 项目上线后，后续收入来自月榜和用户打赏。

项目解锁功能暂不开发。等 Function Hall 项目数、精品内容、月活和打赏流水达到规模后再考虑。

## 6. 现有代码状态

Hajimi 现在已经有 XP 和项目打赏的基础，但打赏仍然使用 `users.points`，不是独立 Hajimi币。

重要现状：

- `users.points` 当前代表 XP/积分。
- `users.level` 基于 points 计算。
- 已有 `point_awards` 表，用于一次性奖励。
- 已有 `project_tips` 表，但当前是 XP 转账：
  - sender 扣 `users.points`
  - recipient 加 `users.points`
  - 表记录 project_id、sender_id、recipient_id、amount。
- `/api/projects/tip` 当前调用 `tipProject()`。
- Function Hall UI 里已有 XP Feedback / 项目打赏交互。
- 项目评分、项目评论、发帖、评论、签到等行为已经会给 XP。
- 现有项目榜单已经有 verified unique users、effective opens、rating 等统计基础。

相关文件：

- `src/lib/db.ts`
- `src/app/api/projects/tip/route.ts`
- `src/components/ProjectGrid.tsx`
- `src/app/api/projects/like/route.ts`
- `src/app/api/projects/comments/route.ts`
- `src/app/api/checkin/route.ts`
- `src/app/api/leaderboard/route.ts`
- `HAJIMI_ARCHITECTURE.md`

注意：不要直接把 `users.points` 改名成 Hajimi币。现在已经决定 XP 和 Hajimi币独立。

## 7. 建议的最小实现顺序

建议不要一次做完整经济系统。先做最小闭环：

### Phase 1: 钱包和 H币打赏

目标：把项目打赏从 XP 转账改成 Hajimi币转账。

需要新增：

- `coin_wallets`
  - `user_id`
  - `balance`
  - `earned_total`
  - `spent_total`
  - timestamps
- `coin_transactions`
  - `user_id`
  - `amount`
  - `type`
  - `source_type`
  - `source_id`
  - `counterparty_user_id`
  - `note`
  - `created_at`

建议交易类型：

- `grant`
- `tip_sent`
- `tip_received`
- `project_reward`
- `version_reward`
- `monthly_award`
- `teacher_bounty`
- `content_award`
- `redemption_hold`
- `redemption_complete`
- `redemption_refund`
- `admin_adjustment`

实现后：

- ProjectGrid 的打赏余额显示 H币。
- 打赏扣 sender 的 H币余额。
- 打赏加 recipient 的 H币余额。
- XP 不再因为打赏减少或增加。
- `project_tips` 可以保留，但需要明确它记录 H币打赏，或新增 `coin_tips` 避免混淆。

### Phase 2: 管理员发币

目标：先支持人工发 H币，不急着自动化所有奖励。

需要：

- admin 后台给用户发 H币。
- 发币必须写入 `coin_transactions`。
- 支持备注和来源类型。

优先覆盖：

- 认证空投。
- 项目发布奖励。
- 新版本奖励。
- 老师项目悬赏。
- 精品内容奖励。

### Phase 3: 兑换申请

目标：创作者可申请用 H币兑换 token。

需要新增：

- `coin_redemption_requests`
  - user_id
  - amount
  - status: pending / approved / rejected / completed
  - requested_note
  - review_note
  - reviewed_by
  - reviewed_at
  - created_at

第一版只做 token 兑换，不做自动现金提现。

建议规则：

- 最低兑换 50 H币。
- 管理员人工审核。
- 审核通过后扣减或冻结 H币。
- 实际发放 token 后标记 completed。

### Phase 4: 月榜和老师项目自动/半自动奖励

目标：在基础钱包稳定后，再把月榜、老师悬赏、内容奖励做成更顺手的管理流程。

不要一开始就做复杂的全自动结算。可以先让 admin 根据榜单和会议记录手动发放。

## 8. 仍需讨论的问题

新窗口可以继续讨论这些问题：

1. H币钱包表名和交易表名最终采用什么命名。
2. 现有 `project_tips` 是迁移成 H币记录，还是新增 `coin_tips`。
3. 历史 XP 是否给一次性 H币补偿。目前倾向不要大量补偿，最多做 verified 空投 3 H币。
4. 项目发布 / 新版本发布奖励是否先人工发，还是接入项目审核通过流程自动发。
5. 月榜奖励是否先人工发，还是基于现有 Function Hall 榜单自动生成候选。
6. 教师 token 额度是否由 Hajimi 管理，还是先只写在预算制度里，不进入产品系统。
7. 老师“活动与招聘”板块是单独开发，还是先复用 Forum tag/板块体系。

## 9. 推荐新窗口启动提示

可以在新窗口粘贴：

```text
我们继续 Hajimi币系统设计和实现，项目在：
/Users/eric/Desktop/AI/AI-CLUB/2_学生项目_Student_Projects/Hajimi-Dan

请先阅读：
1. docs/AI_CLUB_ECOSYSTEM.md
2. docs/SESSION_HANDOFF.md
3. HAJIMI_ARCHITECTURE.md
4. docs/HAJIMI_COIN_BUDGET_SYSTEM.md
5. docs/HAJIMI_COIN_HANDOFF.md

当前结论：
- XP 和 Hajimi币独立。
- XP 是经验值，不可消费。
- Hajimi币是消费和激励货币，1 H币 = 1 元人民币等值 token 预算。
- 第一版优先做 H币钱包、H币项目打赏、管理员发币、兑换申请。
- 不要把现有 users.points 直接改成 H币。
- 现有 project_tips 仍是 XP 转账，需要设计迁移或替代。

请先分析现有代码，并提出最小实现计划。
```
