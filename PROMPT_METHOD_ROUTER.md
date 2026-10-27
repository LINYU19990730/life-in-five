# 提问增强与思考路由 · Prompt Method Router

根据问题场景选择十二条完整 Prompt 模板，填入用户问题，展示完整改写，然后遵循模板执行。需要追问时一次一问，需要确认时等待确认。

## 安装：复制这段给支持技能的 AI

```text
请帮我安装“提问增强与思考路由”技能：
https://github.com/LINYU19990730/life-in-five/tree/share-prompt-method-router/skills/prompt-method-router

GitHub 仓库：LINYU19990730/life-in-five
分支：share-prompt-method-router
技能路径：skills/prompt-method-router
技能名称：prompt-method-router

先检查内容，再按当前平台支持的方式完整安装 SKILL.md、agents/、references/、assets/，保留十二条原文模板及多轮等待规则；支持时启用自动调用。
注意使用上述分支，不要误装仓库默认 main 分支。安装完成后确认技能可加载、十二个模板齐全；若当前客户端不支持安装或缺少权限，请如实说明，不要把阅读成功当作安装成功。
```

这段提示词是安装请求，不是跨平台通用安装程序。AI 需要具备联网读取和目标平台的技能安装能力；公开仓库并不意味着任意聊天窗口都能安装技能，也不表示已经进入官方公共插件目录。

本技能发布在独立分支 `share-prompt-method-router`；仓库默认 `main` 分支是其他项目，不包含本技能。

## 安装范围

- 技能实际目录：[skills/prompt-method-router](skills/prompt-method-router)。完整复制整个目录。
- Codex：可请求其 skill-installer 从本仓库的 `share-prompt-method-router` 分支及上述路径安装。默认本机安装不等于保存到 ChatGPT 账号。
- ChatGPT：在提供技能创建/导入能力的界面中，请求 skill-creator 从本仓库完整导入并安装；账号功能和工作区权限可能不同。应确认出现在“已安装”中，不能只阅读仓库后声称已安装。
- 其他兼容 Agent Skills 的工具：遵循各自官方安装方式，保留相对目录结构。
- 不支持技能的普通聊天工具可以参考这些模板进行本次对话，但这不等于持久安装或后台自动调用。

## 十二种模板

| 方法 | 完整原文 |
| --- | --- |
| 苏格拉底式提问 | [查看](skills/prompt-method-router/references/01-socratic.md) |
| 双层解释法 | [查看](skills/prompt-method-router/references/02-two-layer.md) |
| 反向拆解 | [查看](skills/prompt-method-router/references/03-reverse-engineer.md) |
| 横纵分析法 | [查看](skills/prompt-method-router/references/04-horizontal-vertical.md) |
| 事实核查 | [查看](skills/prompt-method-router/references/05-fact-check.md) |
| 专家会诊 | [查看](skills/prompt-method-router/references/06-expert-panel.md) |
| 第一性原理 | [查看](skills/prompt-method-router/references/07-first-principles.md) |
| 跨领域借解 | [查看](skills/prompt-method-router/references/08-cross-domain.md) |
| 双向钢人论证 | [查看](skills/prompt-method-router/references/09-steelman.md) |
| 用最小实验替代空想 | [查看](skills/prompt-method-router/references/10-minimum-experiment.md) |
| 挖掘隐藏天赋 | [查看](skills/prompt-method-router/references/11-hidden-talents.md) |
| 人生设计术 | [查看](skills/prompt-method-router/references/12-life-design.md) |

## 如何使用

安装后直接提问，例如“我想学习函数这个概念”。技能会选择双层解释法，展示完整改写后的 Prompt，再给出解释、术语对照、误区和三个自检问题。

也可以明确请求：“使用 prompt-method-router，按完整原文模板帮我改写并执行这个问题：……”

苏格拉底问诊最多六个主问题，结束后须确认新问题再给建议；双向钢人论证先问关键问题、等用户回答后再判断；长篇研究与自我探索保留原文流程及篇幅要求。用户当前明确要求简短、停止或改变目标时优先遵从。

## 文件结构与验证

- `SKILL.md`：自动选择模板、改写和执行规则。
- `references/`：十二条完整原文 Prompt，只在选定方法后读取对应文件。
- `agents/openai.yaml`：显示信息、默认提示及自动调用设置。
- `assets/icon.svg`：技能图标。

安装验收：主文件可读取；十二个模板文件齐全且相对链接有效；客户端能加载该技能；遇到问诊场景会等待用户回答。不能以“下载完成”替代“已安装可调用”。

## 来源与署名

本说明及 `skills/prompt-method-router/` 中的第三方 Prompt 不因托管于该仓库而获得仓库其他项目的开源许可。

原文作者：卡兹克。文章：《都Agent时代了，我还是想分享给你这12个我最常用的Prompt。》。十二条原文 Prompt 从用户提供的文章正文提取，仅统一换行，不包含评论区。

本项目整理了模板调用、问题改写和按步骤执行的技能规则。原文作者并非本项目发布者；本项目不代表作者官方出品。仓库未为第三方原文另行授予开源许可。
