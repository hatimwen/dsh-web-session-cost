window.__ModuleLoader__.load({
	id: "dsh-web-session-cost",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		let ReactDOM;
		try { ReactDOM = require("react-dom"); } catch { ReactDOM = undefined; }

		const SLOT = "conversation.composer.dock";
		const ID = "web-session-cost";

		/** CNY list prices per 1M tokens; peak windows double them. */
		const PRICES = {
			flash: { input: 1, cacheRead: 0.02, output: 4 },
			pro: { input: 4.5, cacheRead: 0.15, output: 13.5 },
		};

		/** Match the neighbouring stat pills (see StatsPills.module.css). */
		const pillStyle = {
			boxSizing: "border-box",
			display: "inline-flex",
			alignItems: "center",
			gap: "6px",
			padding: "1px 8px",
			border: "none",
			background: "none",
			borderRadius: "var(--dsw-radius-sm, 4px)",
			color: "var(--dsw-alias-label-tertiary)",
			fontFamily: "inherit",
			fontSize: "var(--dsh-content-font-size-secondary, 13px)",
			lineHeight: "calc(20px + var(--dsh-content-font-delta-secondary, 0px))",
			fontVariantNumeric: "tabular-nums",
			whiteSpace: "nowrap",
			cursor: "pointer",
			userSelect: "none",
		};

		/** Beijing peak windows: weekdays 09:00-12:00 and 14:00-18:00. */
		function isPeak(date) {
			const beijing = new Date(date.getTime() + 8 * 3600 * 1000);
			const day = beijing.getUTCDay();
			const hour = beijing.getUTCHours();
			if (day === 0 || day === 6) return false;
			return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
		}

		function priceOf(model) {
			return typeof model === "string" && /pro/i.test(model) ? PRICES.pro : PRICES.flash;
		}

		function bucketsOf(totals) {
			return {
				input: totals.uncachedInputTokens || 0,
				cacheRead: totals.cacheReadTokens || 0,
				cacheWrite: totals.cacheWriteTokens || 0,
				output: totals.outputTokens || 0,
			};
		}

		function costParts(buckets, model, peak) {
			const price = priceOf(model);
			const factor = peak ? 2 : 1;
			return {
				input: buckets.input * price.input / 1e6 * factor,
				cacheRead: buckets.cacheRead * price.cacheRead / 1e6 * factor,
				output: buckets.output * price.output / 1e6 * factor,
			};
		}

		function costOf(buckets, model, peak) {
			const parts = costParts(buckets, model, peak);
			return parts.input + parts.cacheRead + parts.output;
		}

		function money(value) {
			if (!Number.isFinite(value) || value <= 0) return "≈¥0";
			if (value < 0.0001) return "≈¥<0.0001";
			if (value < 0.01) return "≈¥" + value.toFixed(4);
			if (value < 1) return "≈¥" + value.toFixed(3);
			return "≈¥" + value.toFixed(2);
		}

		function exactMoney(value) {
			if (!Number.isFinite(value) || value <= 0) return "¥0";
			return "¥" + value.toFixed(4);
		}

		function count(value) {
			return Number(value || 0).toLocaleString("en-US");
		}

		function walletList(wallets) {
			if (!Array.isArray(wallets)) return [];
			return wallets.filter((wallet) => wallet && Number.isFinite(Number(wallet.balance)));
		}

		function symbolOf(currency) {
			return currency === "CNY" ? "¥" : currency === "USD" ? "$" : currency + " ";
		}

		function walletText(wallets) {
			const list = walletList(wallets);
			if (list.length === 0) return null;
			const pick = list.find((wallet) => wallet.currency === "CNY") || list[0];
			return symbolOf(pick.currency) + Number(pick.balance).toFixed(2);
		}

		function Dock(props) {
			const { useProjection, session, fetchBalance, isZh } = props;
			const usage = useProjection("tokenUsage");
			const [balance, setBalance] = React.useState({ status: "loading" });
			const [peak, setPeak] = React.useState(() => isPeak(new Date()));
			const [open, setOpen] = React.useState(false);
			const [anchor, setAnchor] = React.useState(null);
			const buttonRef = React.useRef(null);
			const zh = isZh();

			const refresh = React.useCallback(() => {
				let alive = true;
				fetchBalance().then((next) => { if (alive) setBalance(next); });
				return () => { alive = false; };
			}, [fetchBalance]);

			React.useEffect(() => {
				let alive = true;
				const load = () => fetchBalance().then((next) => { if (alive) setBalance(next); });
				load();
				const timer = setInterval(() => { load(); setPeak(isPeak(new Date())); }, 60000);
				return () => { alive = false; clearInterval(timer); };
			}, [fetchBalance]);

			React.useEffect(() => {
				if (!open) return undefined;
				const close = (event) => {
					if (buttonRef.current && buttonRef.current.contains(event.target)) return;
					if (event.target instanceof Element && event.target.closest("[data-dsh-session-cost-panel]")) return;
					setOpen(false);
				};
				const escape = (event) => { if (event.key === "Escape") setOpen(false); };
				document.addEventListener("pointerdown", close);
				document.addEventListener("keydown", escape);
				return () => {
					document.removeEventListener("pointerdown", close);
					document.removeEventListener("keydown", escape);
				};
			}, [open]);

			const totals = usage ? (usage.totals || usage) : undefined;
			const buckets = bucketsOf(totals || {});
			const totalTokens = buckets.input + buckets.cacheRead + buckets.cacheWrite + buckets.output;
			const model = session && (session.model || session.modelId || session.modelSlug);
			const total = costOf(buckets, model, peak);
			const parts = costParts(buckets, model, peak);
			const label = totalTokens > 0 ? money(total) : null;
			const balanceLabel = balance.status === "ready" ? walletText(balance.wallets) : null;
			if (label === null && balanceLabel === null && balance.status !== "loading") return null;

			const peakLabel = peak ? (zh ? "峰" : "peak") : (zh ? "谷" : "idle");
			const line = [];
			if (label !== null) line.push(label + " " + peakLabel);
			if (balanceLabel !== null) line.push((zh ? "余额 " : "Bal ") + balanceLabel);

			const toggle = () => {
				if (open) { setOpen(false); return; }
				const rect = buttonRef.current && buttonRef.current.getBoundingClientRect();
				if (rect) setAnchor({ left: rect.left, top: rect.top, width: rect.width });
				setOpen(true);
			};

			const button = React.createElement(
				"button",
				{
					ref: buttonRef,
					type: "button",
					"data-dsh-session-cost": "",
					"aria-expanded": open,
					title: zh ? "查看本次会话成本与账户余额" : "Session cost and account balance",
					onClick: toggle,
					style: pillStyle,
				},
				line.map((text, index) => React.createElement("span", { key: index }, text)),
			);

			if (!open) return button;

			const width = 272;
			const left = anchor
				? Math.min(Math.max(8, anchor.left + anchor.width / 2 - width / 2), Math.max(8, window.innerWidth - width - 8))
				: 8;
			const bottom = anchor ? Math.max(8, window.innerHeight - anchor.top + 8) : 8;

			const row = (name, value, extra) => React.createElement(
				"div",
				{ style: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "2px 0" } },
				React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, name),
				React.createElement("span", { style: { fontVariantNumeric: "tabular-nums" } }, value, extra ? "  " + extra : ""),
			);

			const panel = React.createElement(
				"div",
				{
					"data-dsh-session-cost-panel": "",
					role: "dialog",
					style: {
						position: "fixed",
						left: left + "px",
						bottom: bottom + "px",
						width: width + "px",
						zIndex: 2147483000,
						boxSizing: "border-box",
						padding: "10px 12px",
						borderRadius: "10px",
						border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))",
						background: "var(--dsw-alias-bg-l1, #fff)",
						boxShadow: "0 8px 24px rgba(0,0,0,.16)",
						fontSize: "12px",
						lineHeight: "18px",
						color: "var(--dsw-alias-label-primary, inherit)",
					},
				},
				React.createElement("div", { style: { fontWeight: 600, marginBottom: "4px" } }, zh ? "本次会话" : "This session"),
				totalTokens > 0
					? React.createElement(React.Fragment, null,
						row(zh ? "输入" : "Input", count(buckets.input) + " tok", exactMoney(parts.input)),
						row(zh ? "缓存读" : "Cache read", count(buckets.cacheRead) + " tok", exactMoney(parts.cacheRead)),
						buckets.cacheWrite > 0 ? row(zh ? "缓存写" : "Cache write", count(buckets.cacheWrite) + " tok", "—") : null,
						row(zh ? "输出" : "Output", count(buckets.output) + " tok", exactMoney(parts.output)),
						row(zh ? "时段" : "Window", peak ? (zh ? "高峰（双倍）" : "peak (2×)") : (zh ? "谷时" : "idle")),
						row(zh ? "合计" : "Total", money(total)),
					)
					: React.createElement("div", { style: { color: "var(--dsw-alias-label-tertiary)" } }, zh ? "本次会话还没有用量" : "No usage yet"),
				React.createElement("div", { style: { height: "1px", background: "var(--dsw-alias-border-l2, rgba(0,0,0,.08))", margin: "8px 0" } }),
				React.createElement("div", { style: { fontWeight: 600, marginBottom: "4px" } }, zh ? "账户余额" : "Balance"),
				balance.status === "ready"
					? [
						...(walletList(balance.wallets).map((wallet) => row(
							wallet.currency === "CNY" ? (zh ? "充值" : "Top-up") : wallet.currency,
							symbolOf(wallet.currency) + Number(wallet.balance).toFixed(2),
						))),
						...(walletList(balance.bonusWallets).map((wallet) => row(
							wallet.currency === "CNY" ? (zh ? "赠送" : "Bonus") : wallet.currency + " bonus",
							symbolOf(wallet.currency) + Number(wallet.balance).toFixed(2),
						))),
					]
					: balance.status === "loading"
						? React.createElement("div", { style: { color: "var(--dsw-alias-label-tertiary)" } }, zh ? "读取中…" : "Loading…")
						: React.createElement("div", { style: { color: "var(--dsw-alias-label-tertiary)", wordBreak: "break-word" } },
							(zh ? "读取失败：" : "Failed: ") + (balance.detail || "unknown")),
				React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: "8px" } },
					React.createElement("button", {
						type: "button",
						onClick: refresh,
						style: {
							cursor: "pointer",
							border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))",
							background: "none",
							borderRadius: "6px",
							padding: "2px 10px",
							fontSize: "12px",
							color: "inherit",
						},
					}, zh ? "刷新余额" : "Refresh"),
				),
			);

			if (ReactDOM && typeof ReactDOM.createPortal === "function" && typeof document !== "undefined") {
				return React.createElement(React.Fragment, null, button, ReactDOM.createPortal(panel, document.body));
			}
			return React.createElement(React.Fragment, null, button, panel);
		}

		/** Browser entry: one stat in the composer status row, between cache hit and context. */
		function apply(ctx) {
			const localeOf = () => {
				const locale = ctx.get ? ctx.get("locale", false) : undefined;
				const active = locale && locale.getSnapshot ? locale.getSnapshot().active : "zh";
				return typeof active === "string" && active !== "" ? active : "zh";
			};

			const fetchBalance = async () => {
				const remote = ctx.get ? ctx.get("remote", false) : ctx.remote;
				const account = remote && remote.account;
				if (!account || typeof account.getBalance !== "function") {
					return { status: "failed", detail: "account Remote unavailable" };
				}
				const boot = typeof window !== "undefined" ? window.__DSH_BOOT__ : undefined;
				const meta = {
					version: (boot && (boot.version || boot.dshVersion)) || "0.2.1-rc.3",
					locale: localeOf(),
					timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
				};
				try {
					const result = await account.getBalance(meta);
					if (!result) return { status: "failed", detail: "empty result" };
					if (result.ok !== true) return { status: "failed", detail: String((result.error && (result.error.code || result.error.message)) || "remote error") };
					if (!result.value) return { status: "failed", detail: "no account grant" };
					if (result.value.status !== "ready") return { status: "failed", detail: "balance query failed" };
					return {
						status: "ready",
						wallets: result.value.value || [],
						bonusWallets: result.value.bonusWallets || [],
					};
				} catch (error) {
					return { status: "failed", detail: error instanceof Error ? error.message : String(error) };
				}
			};

			ctx.slots.inject(SLOT, () => {
				try {
					return ctx.slots.register({
						name: SLOT,
						id: ID,
						order: 2,
						inject: () => ({
							fetchBalance,
							isZh: () => /^zh/i.test(localeOf()),
						}),
					}, Dock);
				} catch {
					return () => {};
				}
			});
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	}
});
