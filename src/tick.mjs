import { Rcon, stripColors } from './rcon.mjs'

/**
 * How well a running server is keeping up, and who is on it, as the server itself says.
 *
 * <p>Both numbers only exist inside the JVM, so they are asked for over RCON. Two readers want
 * them: the assistant's performance tool, once, when it is asked; and the daemon, every ten
 * seconds, so the panel can show them without asking anything itself. The asking and the reading
 * of the answers live here so the two cannot disagree about what a reply means.
 */

/** Paper answers `tps` and `mspt`; vanilla and Fabric answer `tick query`. */
export const TICK_COMMANDS = ['tps', 'mspt', 'tick query']

/** A reply that means the server has no such command, rather than an answer. */
const REFUSED = /unknown|incorrect argument|<--\[HERE\]/i

/**
 * Ask a server how it is ticking, through whatever `send` is: a one-shot connection per command
 * for the assistant, the daemon's standing one for the sampler.
 *
 * <p>Stops at the first command family that answers: a Paper server that knows `tps` is not also
 * asked `tick query`, which it would answer too, in a second format saying the same thing. A
 * command that throws is skipped rather than failing the rest; the replies that came back stand.
 *
 * @returns {Promise<{ replies: Record<string, string>, tps: number | null }>}
 */
export async function readTick(send) {
  const replies = {}
  for (const cmd of TICK_COMMANDS) {
    try {
      const text = stripColors((await send(cmd)) ?? '').trim()
      if (text && !REFUSED.test(text)) replies[cmd] = text
    } catch { /* RCON unavailable for this one: whatever else answered still stands */ }
    if (cmd === 'mspt' && replies.tps) break
  }
  return { replies, tps: parseTps(replies) }
}

/**
 * Ticks per second, from whichever reply carries it.
 *
 * <p>Paper: "TPS from last 1m, 5m, 15m: 20.0, 19.98, 20.0", with a leading * on a value it has
 * capped at 20. The first figure is the one-minute average, which is the recent past a glance at
 * the panel is asking about.
 *
 * <p>Vanilla's `tick query` has no TPS line. It gives the target rate and the average time a tick
 * takes; a server whose ticks fit inside the target runs at the target, and one whose ticks do not
 * runs at 1000 / that many milliseconds. A frozen game ticks at nothing.
 */
export function parseTps(replies) {
  const paper = /TPS from last[^:]*:\s*\*?(\d+(?:\.\d+)?)/i.exec(replies.tps ?? '')
  if (paper) return round(Number(paper[1]))
  const query = replies['tick query'] ?? ''
  if (!query) return null
  if (/frozen/i.test(query)) return 0
  const rate = /Target tick rate:\s*(\d+(?:\.\d+)?)/i.exec(query)
  const avg = /Average time per tick:\s*(\d+(?:\.\d+)?)\s*ms/i.exec(query)
  if (!rate || !avg) return null
  const target = Number(rate[1])
  const ms = Number(avg[1])
  if (!(target > 0)) return null
  return round(ms > 0 ? Math.min(target, 1000 / ms) : target)
}

/**
 * Who is on, from the reply to `list`.
 *
 * <p>Vanilla, and Paper after it, say "There are 2 of a max of 20 players online: A, B". Essentials
 * replaces the command and says "out of maximum" instead. Anything else is not guessed at.
 *
 * @returns {{ online: number, max: number } | null}
 */
export function parseList(text) {
  const m = /There (?:are|is) (\d+)\s*(?:\/\s*|of a max(?:imum)? of |out of (?:a )?maximum(?: of)? )(\d+)/i
    .exec(stripColors(text ?? ''))
  return m ? { online: Number(m[1]), max: Number(m[2]) } : null
}

const round = (n) => Math.round(n * 100) / 100

/**
 * Keep asking a running server how it is ticking and who is on, over one connection.
 *
 * <p>One connection for the whole run, not one per reading. Every RCON connection a Minecraft
 * server accepts writes two lines to its console - "Thread RCON Client started", then "shutting
 * down" - and a reading every ten seconds would bury the console under seventeen thousand of them
 * a day. A standing connection writes the pair once. It is opened when the server first answers
 * and opened again only if it drops.
 *
 * <p>`latest()` is what the metrics sampler writes beside each CPU and memory reading. A reading
 * older than three intervals is not handed out: a server that has stopped answering is not still
 * at twenty TPS with five players.
 *
 * <p>Nothing here can hurt the server it watches. A failure to connect, a refused password or a
 * server that never enabled RCON costs these two numbers and nothing else.
 */
export function startTickSampler(inst, { intervalMs = 10000, timeoutMs = 8000, onError = () => {} } = {}) {
  const port = inst?.rcon?.port
  const password = inst?.rcon?.password
  if (!port || !password) return { latest: () => null, stop: () => {} }

  let rcon = null
  let busy = false
  let stopped = false
  let reading = null
  let failures = 0

  const drop = () => {
    try { rcon?.close() } catch { /* already gone */ }
    rcon = null
  }

  const sample = async () => {
    if (busy || stopped) return
    busy = true
    try {
      if (!rcon || rcon.socket?.destroyed) {
        drop()
        const next = new Rcon({ port, password, timeout: timeoutMs })
        await next.connect()
        if (stopped) { next.close(); return }
        // The client's socket timeout is an idle timeout, and it tears the connection down when it
        // fires - right for a one-shot command, wrong for a connection that sits quiet between
        // readings by design. Off, once connected; each reply still has its own time limit.
        next.socket.setTimeout(0)
        rcon = next
      }
      const send = (cmd) => rcon.send(cmd)
      const { tps } = await readTick(send)
      const players = parseList(await send('list'))
      reading = { at: Date.now(), tps, online: players?.online ?? null, max: players?.max ?? null }
      failures = 0
    } catch (err) {
      drop()
      // Refused connections are the normal state of a server still starting, so only a run of
      // failures once it has answered before is worth a line in the daemon log.
      if (reading && ++failures === 3) onError(err)
    } finally {
      busy = false
    }
  }

  const timer = setInterval(sample, intervalMs)
  timer.unref?.()
  sample()

  return {
    latest() {
      if (!reading || Date.now() - reading.at > intervalMs * 3) return null
      return reading
    },
    stop() {
      stopped = true
      clearInterval(timer)
      drop()
    },
  }
}
