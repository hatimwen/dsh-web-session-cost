# dsh-web-session-cost

在 dsh web 输入框下方的状态栏里显示**本次会话成本估算**和 **DeepSeek 账户余额**，位置在「缓存命中」和「上下文已用」之间。

TUI 版的 [`dsh-tui-session-cost`](https://github.com/hatimwen/dsh-tui-session-cost) 在 web 端没有对等物（web 客户端没有 `tuiStatus` 服务），这个插件注册到 web 的 `conversation.composer.dock` 槽位（order 2），补上同样的信息。

## 显示内容

```
                                              ≈¥0.0034 谷   余额 ¥20.29
```

- **会话成本**：来自会话级 `tokenUsage` 投影（输入 / 缓存读 / 缓存写 / 输出），按 DeepSeek 公布的人民币价目表估算，高峰时段（北京时间工作日 09:00–12:00、14:00–18:00）翻倍，标记 `峰` / `谷`
- **余额**：走 `account/getBalance` Remote 接口，读当前登录账户的钱包余额（优先 CNY；没有钱包额度时回退到赠送额度）
- 没有用量也没有余额时整行不渲染；余额每 60 秒刷新一次

## 计价口径

| 模型档 | 输入 | 缓存读 | 输出 |
|---|---|---|---|
| flash（默认） | ¥1 / 1M | ¥0.02 / 1M | ¥4 / 1M |
| pro | ¥4.5 / 1M | ¥0.15 / 1M | ¥13.5 / 1M |

仅覆盖 DeepSeek 官方路由；平台账单才是权威值。节假日没有单独处理（web 端的 `dsh-usage` 插件有完整节假日表），所以法定节假日会按高峰价高估，误差方向偏高。

## 安装

```sh
dsh plugin --profile web add link:$(pwd)
# 或从 npm（若已发布）
dsh plugin --profile web add dsh-web-session-cost
```

安装后**重启一次 `dsh web`** 才会加载新的客户端 bundle；重启后刷新页面即可看到输入框上方的成本/余额行。

## 要求

- DSH `>= 0.2.1-rc.3`
- 账户已登录（未登录时只显示成本，不显示余额）

## 实现

- `lib/index.js`：宿主半边，故意为空
- `lib/client.js`：浏览器 bundle，注册 `conversation.composer.dock` 行；成本来自 `useProjection("tokenUsage")`（扁平投影），余额来自 `remote.account.getBalance`

## License

MIT
