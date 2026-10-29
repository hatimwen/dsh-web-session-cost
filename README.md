# dsh-web-session-cost

> **已弃用 / Deprecated**
>
> 本仓库不再维护。适配代码已经合并回唯一的插件仓库：**[hatimwen/dsh-session-cost](https://github.com/hatimwen/dsh-session-cost)**。
> 请不要安装 `dsh-web-session-cost`；请使用 `dsh-session-cost`，同一个插件同时支持 dsh web 和 Desktop。

在 dsh web 输入框下方的状态栏里显示**本次会话成本估算**和 **DeepSeek 账户余额**，位置在「缓存命中」和「上下文已用」之间。

TUI 版的 [`dsh-tui-session-cost`](https://github.com/hatimwen/dsh-tui-session-cost) 在 web 端没有对等物（web 客户端没有 `tuiStatus` 服务），这个插件注册到 web 的 `conversation.composer.dock` 槽位（order 2），补上同样的信息。

## 显示内容

```
                                              ≈¥0.0034 谷   余额 ¥20.29
```

- **会话成本**：来自会话级 `tokenUsage` 投影（输入 / 缓存读 / 缓存写 / 输出），按 DeepSeek 公布的人民币价目表估算，高峰时段（北京时间工作日 09:00–12:00、14:00–18:00）翻倍，标记 `峰` / `谷`
- **余额**：宿主路由 `/api/dsh-web-session-cost/balance` 读当前登录账户的钱包余额（优先 CNY；没有钱包额度时回退到赠送额度）
- 模型档位从会话的模型目录（`modelDirectories`）读取，pro / flash 自动切换价目表
- 没有用量也没有余额时整行不渲染；余额每 60 秒刷新一次
- 点击这一行会打开明细面板：分项 token 与金额、模型、峰谷时段、钱包构成，以及手动刷新

## 计价口径

| 模型档 | 输入 | 缓存读 | 输出 |
|---|---|---|---|
| flash（默认） | ¥1 / 1M | ¥0.02 / 1M | ¥4 / 1M |
| pro | ¥4.5 / 1M | ¥0.15 / 1M | ¥13.5 / 1M |

仅覆盖 DeepSeek 官方路由；平台账单才是权威值。

高峰判定按北京时间工作日 09:00–12:00、14:00–18:00；**中国法定节假日全天按谷时计**，周末同样是谷时。节假日表覆盖 2025–2026（取自 `@linxin666/dsh-usage` 内置的国务院放假安排，MIT），更晚的年份按工作日高峰处理，误差方向偏高而非偏低。

## 安装

```sh
dsh plugin --profile web add link:$(pwd)
# 或从 npm（若已发布）
dsh plugin --profile web add dsh-web-session-cost
```

安装后**重启一次 `dsh web`**：宿主半边（余额路由）只在启动时注册；客户端 bundle 之后改代码刷新即可，不必再重启。

## 桌面版（DeepSeek Harness Desktop）

桌面客户端加载的是同一套 web client bundle，插件本身兼容，但它有独立的 `desktop` profile，不会共享 `web` profile 里装的插件：

```sh
# 1. 先完整打开一次桌面版，让它在 ~/.dsh/profiles/desktop 完成初始化
# 2. 完全退出桌面版（含托盘进程）
dsh plugin --profile desktop add link:/path/to/dsh-web-session-cost
# 3. 重新打开桌面版
```

注意：桌面端如果从自定义协议或 `file://` 加载页面，`fetch("/api/…")` 可能跨源而被拒绝，此时成本仍显示、余额会报错。这一点尚未在真实桌面端验证过。

## 要求

- DSH `>= 0.2.1-rc.3`
- 账户已登录（未登录时只显示成本，不显示余额）
- 余额路由只接受回环地址；通过 remote-web-ui / 局域网从别的机器访问时余额会 403（成本不受影响）

## 实现

- `lib/index.js`：宿主半边，注册 `GET /api/dsh-web-session-cost/balance`（仅回环），从 `deepseekAccount` 服务读余额
- `lib/client.js`：浏览器 bundle，注册 `conversation.composer.dock` 行；成本来自 `useProjection("tokenUsage")`（扁平投影），余额来自宿主路由 `/api/dsh-web-session-cost/balance`

## License

MIT
