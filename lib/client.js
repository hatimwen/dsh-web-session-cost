window.__ModuleLoader__.load({
	id: "dsh-web-session-cost",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		const SLOT = "conversation.input.dock";
		const ID = "web-session-cost";

		/** CNY list prices per 1M tokens; peak windows double them. */
		const PRICES = {
			flash: { input: 1, cacheRead: 0.02, output: 4 },
			pro: { input: 4.5, cacheRead: 0.15, output: 13.5 },
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

		function costOf(totals, model, peak) {
			const price = priceOf(model);
			const factor = peak ? 2 : 1;
			const tokens = (totals.uncachedInputTokens || 0) * price.input
				+ (totals.cacheReadTokens || 0) * price.cacheRead
				+ (totals.cacheWriteTokens || 0) * price.input
				+ (totals.outputTokens || 0) * price.output;
			return (tokens / 1e6) * factor;
		}

		function money(value) {
			if (!Number.isFinite(value) || value <= 0) return "≈¥0";
			if (value < 0.0001) return "≈¥<0.0001";
			if (value < 0.01) return "≈¥" + value.toFixed(4);
			if (value < 1) return "≈¥" + value.toFixed(3);
			return "≈¥" + value.toFixed(2);
		}

		function walletText(wallets) {
			if (!Array.isArray(wallets) || wallets.length === 0) return null;
			const pick = wallets.find((wallet) => wallet && wallet.currency === "CNY") || wallets[0];
			const amount = Number(pick && pick.balance);
			if (!Number.isFinite(amount)) return null;
			return (pick.currency === "CNY" ? "¥" : "$") + amount.toFixed(2);
		}

		function Dock(props) {
			const { useProjection, session, fetchBalance } = props;
			const usage = useProjection("tokenUsage");
			const [balance, setBalance] = React.useState(null);
			const [peak, setPeak] = React.useState(() => isPeak(new Date()));

			React.useEffect(() => {
				let alive = true;
				const load = () => {
					Promise.resolve()
						.then(fetchBalance)
						.then((text) => { if (alive) setBalance(text); })
						.catch(() => {});
				};
				load();
				const timer = setInterval(() => { load(); setPeak(isPeak(new Date())); }, 60000);
				return () => { alive = false; clearInterval(timer); };
			}, [fetchBalance]);

			const totals = usage && usage.totals;
			const model = session && (session.model || session.modelId || session.modelSlug);
			const cost = totals ? costOf(totals, model, peak) : null;
			const totalTokens = totals
				? (totals.uncachedInputTokens || 0) + (totals.outputTokens || 0)
					+ (totals.cacheReadTokens || 0) + (totals.cacheWriteTokens || 0)
				: 0;
			const label = totalTokens > 0 ? money(cost) : null;
			if (label === null && balance === null) return null;

			const zh = typeof navigator !== "undefined" && /^zh/i.test(navigator.language || "");
			const parts = [];
			if (label !== null) parts.push(label + (peak ? (zh ? " 峰" : " peak") : (zh ? " 谷" : " idle")));
			if (balance !== null) parts.push((zh ? "余额 " : "Bal ") + balance);

			return React.createElement(
				"div",
				{
					"data-dsh-session-cost": "",
					style: {
						display: "flex",
						justifyContent: "flex-end",
						gap: "12px",
						padding: "2px 6px 4px",
						fontSize: "12px",
						lineHeight: "16px",
						opacity: 0.72,
						userSelect: "none",
						whiteSpace: "nowrap",
					},
				},
				parts.map((text, index) => React.createElement("span", { key: index }, text)),
			);
		}

		/** Browser entry: one footer row above the composer. */
		function apply(ctx) {
			const fetchBalance = async () => {
				const remote = ctx.get ? ctx.get("remote", false) : ctx.remote;
				const account = remote && remote.account;
				if (!account || typeof account.getBalance !== "function") return null;
				const locale = ctx.get ? ctx.get("locale", false) : undefined;
				const active = locale && locale.getSnapshot ? locale.getSnapshot().active : "zh";
				const boot = typeof window !== "undefined" ? window.__DSH_BOOT__ : undefined;
				const meta = {
					version: (boot && (boot.version || boot.dshVersion)) || "0.2.1-rc.3",
					locale: typeof active === "string" && active !== "" ? active : "zh",
					timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
				};
				try {
					const result = await account.getBalance(meta);
					if (!result || result.ok !== true || !result.value || result.value.status !== "ready") return null;
					return walletText(result.value.value) || walletText(result.value.bonusWallets);
				} catch {
					return null;
				}
			};

			ctx.slots.inject(SLOT, () => {
				try {
					return ctx.slots.register({
						name: SLOT,
						id: ID,
						order: 30,
						inject: () => ({ fetchBalance }),
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
