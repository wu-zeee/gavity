# 在席 Gavity

在席 Gavity 是一个由可执行议事规则约束的人类—Agent 协作会议系统。

真人无法参会时，可以授权数字代表参与讨论和有限决策；一旦行动超出授权边界，系统必须把决定权交还真人。

MVP 以 Photon iMessage 作为真人升级主链路：数字代表越权时，系统直接向真人发出决策请求，并在获得有范围的一次性授权后继续会议。

## 当前状态

阶段三已经完成本地实现：

- Better Auth 邮箱密码会话；
- Cloudflare Workers 兼容的 PBKDF2 密码哈希；
- 组织、成员、会议、议程和授权 API；
- D1 业务 Schema 与 Drizzle migration；
- 服务端命令校验、事件日志、幂等和当前状态投影；
- 页面刷新和服务重启后的会议恢复；
- 独立的阶段三持久化验收控制台。

原有比赛 Demo 仍保留在默认首页。下一阶段将实现创建会议向导、多人实时同步、完整授权编辑器和会前大厅。

## 文档

- [产品定义](./docs/product.md)
- [MVP 范围](./docs/mvp.md)
- [技术架构](./docs/architecture.md)
- [领域与规则](./docs/domain-rules.md)
- [演示剧本](./docs/demo-script.md)
- [开发计划](./docs/development-plan.md)

## 本地开发

```bash
bun install
bun dev
```

通过 `https://gavity.localhost` 访问开发环境。

### 阶段三服务端模式

复制 `.env.example` 为不会提交的 `.dev.vars`，至少设置一个长度不小于 32 字符的 `BETTER_AUTH_SECRET`。然后执行：

```bash
bun run db:migrate:local
bun run dev:server
```

通过 `http://127.0.0.1:3001/?mode=server` 打开持久化控制台。该模式使用本地 D1；刷新页面或重启服务后，会议投影和事件历史仍会恢复。

## 质量检查

```bash
bun run lint
bun test
bun run db:check
bun run build
```

领域测试与服务端集成测试覆盖合法/非法状态转换、身份伪造、幂等提交、事件回放和密码哈希。
