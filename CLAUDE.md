# CLAUDE.md — learn-langchain

本仓库是中文 LangChain.js / LangGraph 教学项目。项目的课程组织方式参考 Matt Pocock 的 [teach skill](https://github.com/mattpocock/skills/blob/main/skills/productivity/teach/SKILL.md)；贡献者无需安装该技能或任何特定编辑器。

## 项目约定

- Node.js 22+，TypeScript ES modules，通过 `tsx` 运行；本地导入使用 `.js` 扩展名以兼容 NodeNext。
- 每个编号 `.ts` 是独立演示；共享基础功能在 `src/`。课程编号与 npm scripts、HTML 讲义保持一致。
- 中文讲解，保留官方 API 名称与英文代码标识。
- API Key 和模型 ID 通过本地 `.env` 配置，在 `src/model.ts` 集中校验。
- 不执行模型生成的代码，不提交密钥、真实个人数据或内部资料。
- 第 12 课使用 Mem0 风格模拟器；不要把它描述为真实 SDK 集成。
- 内存 Store/checkpointer 不提供进程重启后的持久化。

## 验证

```bash
npm ci
npm run check
npm run demo:13   # 离线，无需 API Key
```

其他课程通过 `npm run demo:01` 至 `npm run demo:12` 执行，需要真实配置且会产生费用。未经实际运行，不要声称在线验证通过。贡献说明见 [CONTRIBUTING.md](CONTRIBUTING.md)，来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
