/**
 * Host half: expose the signed-in account's wallet balance to the browser half.
 *
 * The browser cannot read the Host `deepseekAccount` service directly, and the
 * generic account Remote can sit pending on some builds. A tiny loopback route
 * keeps the read on the Host, where the credential lives, and returns plain
 * JSON to the pill.
 */

/** Required Host service: the web server that mounts `/api/**` routes. */
export const inject = ['webServer']

/** Only the local browser may read personal balances. */
function isLoopback(request) {
  const address = request.socket && request.socket.remoteAddress
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function writeJson(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  response.end(text)
}

/** Identity the Platform request headers are derived from. */
function clientMetadata() {
  const locale = String(Intl.DateTimeFormat().resolvedOptions().locale || 'en').split('-')[0]
  return {
    version: '0.2.1-rc.3',
    locale: locale === 'zh' ? 'zh' : 'en',
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @returns {() => void} route disposer
 */
export function apply(ctx) {
  return ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-web-session-cost/balance',
    handler: async (request, response) => {
      if (!isLoopback(request)) {
        writeJson(response, 403, { ok: false, detail: 'loopback only' })
        return
      }
      const account = ctx.get('deepseekAccount', false)
      if (account === undefined || typeof account.getBalance !== 'function') {
        writeJson(response, 200, { ok: false, detail: 'account service unavailable' })
        return
      }
      try {
        const result = await account.getBalance(clientMetadata())
        if (result === null || result === undefined || result.status !== 'ready') {
          writeJson(response, 200, { ok: false, detail: 'balance query failed' })
          return
        }
        writeJson(response, 200, {
          ok: true,
          wallets: Array.isArray(result.value) ? result.value : [],
          bonusWallets: Array.isArray(result.bonusWallets) ? result.bonusWallets : [],
        })
      } catch (error) {
        writeJson(response, 200, {
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        })
      }
    },
  })
}
