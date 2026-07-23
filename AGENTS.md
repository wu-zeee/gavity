Gavity 是一个会议工具，基于罗伯特议事规则，维护会议秩序和公平。

技术注意事项：
- 尊重现有架构，不大规模重写，不重复造轮子
- 使用 Bun, Nuxt v4, Drizzle ORM
- 虽然一些 skills 建议写大 composables，但别信，应用 utils 而不是 composables
- 用工具而不是终端读写文件
- 用 `bun dev` 运行开发服务器，访问 `https://gavity.localhost` 查看效果
- 如遇到 ESLint 错误，首先 `--fix`，无法自动修复再编辑文件来修复
