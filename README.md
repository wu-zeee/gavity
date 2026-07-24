# 在席 Gavity

在席 Gavity 是一个由可执行议事规则约束的人类—Agent 协作会议系统。

真人无法参会时，可以授权数字代表参与讨论和有限决策；一旦行动超出授权边界，系统必须把决定权交还真人。

MVP 以 Photon iMessage 作为真人升级主链路：数字代表越权时，系统直接向真人发出决策请求，并在获得有范围的一次性授权后继续会议。

## 当前状态

项目目前是可运行的会议控制台 Demo，已经包含议程、发言权、动议、附议、主持裁决和表决流程。产品化工作将按增量方式加入服务端权威状态、持久化、多人实时、代理授权、真人确认和决策审计。

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

## 质量检查

```bash
bun run lint
bun test
bun run build
```

领域核心使用 Bun 单元测试覆盖合法与非法状态转换；后续阶段将继续加入服务端集成测试和端到端测试。
