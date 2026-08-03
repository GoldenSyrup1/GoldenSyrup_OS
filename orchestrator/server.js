// GoldenSyrup OS — local orchestrator.
//
// The backend half of the runner seam. Setting VITE_OS_ORCHESTRATOR_BASE flips
// BOTH prompt surfaces off their stubs at once, so this serves both endpoints:
//   POST /architect  {prompt}            -> {blocks, links, note}   (Architectures)
//   POST /run        {prompt, path}      -> NDJSON progress stream  (Command Console)
//   GET  /architectures                  -> {architectures: [...]}  (durable canvas)
//   PUT  /architectures {architectures}  -> {architectures: [...]}
//
// The architectures endpoints exist because the canvas used to live only in
// browser localStorage, where the diagrams were invisible to every agent and
// died with the cache. This process has a filesystem; it keeps the durable copy.
//
// Local-only and single-user by design: it holds ANTHROPIC_API_KEY and can spawn
// Claude Code in a working directory, so it must never be exposed to a network.
// It binds loopback and allows only the dev/preview origins.

import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import cors from 'cors'
import express from 'express'
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  parseCookies,
  resolveSessionSecret,
  safeEqual,
  serializeCookie,
  signToken,
  verifyToken,
} from './lib/auth.js'
import { ARCHITECTURE_SCHEMA, MAX_BLOCKS, toPatch } from './lib/patch.js'
import { architectureContext, sanitizeArchitecture, sanitizeArchitectures } from './lib/store.js'
import { fileStorage, postgresStorage } from './lib/storage.js'

// Sonnet 5 rather than Opus: drawing a handful of blocks from one sentence does
// not need the top tier, and this is a prompt box that gets hammered while
// iterating on a diagram. Override per-deployment without touching code.
const ARCHITECT_MODEL = process.env.ARCHITECT_MODEL ?? 'claude-sonnet-5'
const ARCHITECT_EFFORT = process.env.ARCHITECT_EFFORT ?? 'medium'

// Architectures live in the repo, committed and versioned, rather than in a
// gitignored data dir: the whole point is that an agent working in this
// checkout can read the diagrams, and `git diff` on a drawing you changed is
// worth having. Resolved from this file, not cwd, so it lands in the same place
// however the server was launched.
const ARCHITECTURES_DIR = process.env.ARCHITECTURES_DIR
  ? path.resolve(process.env.ARCHITECTURES_DIR)
  : fileURLToPath(new URL('../architectures/', import.meta.url))

// Railway supplies PORT and needs a public bind; locally we stay on loopback
// because this process can spawn Claude Code on the filesystem.
const HOSTED = Boolean(process.env.PORT || process.env.DATABASE_URL)
const PORT = Number(process.env.PORT || process.env.ORCHESTRATOR_PORT) || 8787
const HOST = HOSTED ? '0.0.0.0' : '127.0.0.1'

const PASSWORD = process.env.OS_PASSWORD ?? ''
const AUTH_ON = PASSWORD.length > 0
const SESSION_SECRET = resolveSessionSecret(process.env.OS_SESSION_SECRET)

// The interlock. Reachable from a network + an API key + no password = an open
// proxy spending Sriram's credit, so refuse to boot rather than serve it.
if (HOSTED && !AUTH_ON) {
  console.error('Refusing to start: this instance is network-reachable but OS_PASSWORD is not set.')
  console.error('Set OS_PASSWORD (and OS_SESSION_SECRET) so /architect is not an open proxy.')
  process.exit(1)
}

/**
 * `/run` spawns Claude Code on the local filesystem. On a hosted box there are
 * no repos to work in and it would be remote code execution, so it exists only
 * when running locally.
 */
const RUN_ENABLED = !HOSTED
const ALLOWED_ORIGINS = (process.env.ORCHESTRATOR_ALLOWED_ORIGINS ?? 'http://localhost:5180,http://localhost:4173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

// Don't hard-fail on a missing ANTHROPIC_API_KEY: the SDK also accepts
// ANTHROPIC_AUTH_TOKEN and an `ant auth login` profile on disk, and exiting here
// would lock out a perfectly good profile. Warn, and let a real 401 surface per
// request if there turns out to be no credential at all.
if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn('No ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN set — falling back to an `ant auth login` profile.')
  console.warn('If /architect returns 401, copy orchestrator/.env.example to orchestrator/.env and add a key.')
} else if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length < 40) {
  // A left-over "sk-ant-..." placeholder authenticates as a 401 that reads like
  // a bug in the endpoint. Say so at boot instead of at 3am.
  console.warn('ANTHROPIC_API_KEY looks like a placeholder, not a real key — /architect will 401.')
  console.warn('Paste the full key from https://console.anthropic.com/settings/keys into orchestrator/.env.')
}

// Postgres on Railway (a container's disk is ephemeral — a redeploy would take
// the diagrams with it), the repo directory locally.
let storage = fileStorage(ARCHITECTURES_DIR)
if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  })
  storage = postgresStorage(pool)
}

const client = new Anthropic()
const app = express()
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
// 64kb was plenty for a prompt, but a PUT /architectures carries every diagram
// at once and a canvas of a few hundred blocks clears it easily.
app.use(express.json({ limit: '2mb' }))

// ---- auth ------------------------------------------------------------------

const isSecure = (req) => req.secure || req.get('x-forwarded-proto') === 'https'

/** Whether this request carries a valid session. Always true when auth is off. */
function authed(req) {
  if (!AUTH_ON) return true
  return verifyToken(SESSION_SECRET, parseCookies(req.get('cookie'))[SESSION_COOKIE], Date.now())
}

app.get('/auth/status', (req, res) => res.json({ required: AUTH_ON, authed: authed(req) }))

app.post('/auth/login', (req, res) => {
  if (!AUTH_ON) return res.json({ authed: true })
  const supplied = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!supplied || !safeEqual(supplied, PASSWORD)) {
    return res.status(401).json({ error: 'Wrong password.' })
  }
  const token = signToken(SESSION_SECRET, Date.now() + SESSION_TTL_MS)
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, token, { maxAgeMs: SESSION_TTL_MS, secure: isSecure(req) }),
  )
  res.json({ authed: true })
})

app.post('/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, '', { maxAgeMs: 0, secure: isSecure(req) }))
  res.json({ authed: false })
})

/** Gate everything that costs money, touches data, or runs a process. */
function requireAuth(req, res, next) {
  if (authed(req)) return next()
  res.status(401).json({ error: 'Not signed in.' })
}

const ARCHITECT_SYSTEM = `You turn a short description of a software system into a small architecture diagram.

Emit blocks and the directed links between them:
- Pick the smallest set of blocks that honestly represents the system — typically 3 to 8, never more than ${MAX_BLOCKS}. Only include a block the description actually implies; do not pad the diagram with a queue, cache, or auth service that was never mentioned.
- Label each block with the concrete thing it is ("Postgres", "Stripe"), falling back to its role ("API Service") when the description does not name a technology.
- Set "col" to the block's tier: 0 for whatever the user touches first, incrementing rightwards, so backing stores and third-party integrations land on the right. Blocks in the same tier share a "col".
- Link blocks by their index in your "blocks" array, in the direction the request flows. Label a link only when the protocol or payload is not obvious; otherwise use an empty string.
- Keep "note" to one sentence describing what you drew.

Choose the block "kind" that fits: "client" for user-facing entry points, "service" for compute you own, "datastore" for anything that persists state, "queue" for async transport, "external" for third-party APIs, "note" for annotations.`

/** Prompt -> architecture graph, with the reply constrained to ARCHITECTURE_SCHEMA. */
app.post('/architect', requireAuth, async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  if (!prompt) return res.status(400).json({ error: 'prompt is required' })

  const message = await client.messages.create({
    model: ARCHITECT_MODEL,
    max_tokens: 16000,
    system: ARCHITECT_SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: ARCHITECT_EFFORT,
      format: { type: 'json_schema', schema: ARCHITECTURE_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  })

  // Check why generation stopped before trusting content: a refusal returns 200
  // with no usable body, and a truncated reply is invalid JSON rather than a
  // partial graph.
  if (message.stop_reason === 'refusal') {
    return res.status(422).json({ error: 'Claude declined this prompt.' })
  }
  if (message.stop_reason === 'max_tokens') {
    return res.status(502).json({ error: 'Response was truncated before the graph was complete.' })
  }

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return res.status(502).json({ error: 'Claude returned a non-JSON body.' })
  }

  const patch = toPatch(parsed)
  if (patch.blocks.length === 0) {
    return res.status(502).json({ error: 'Claude returned no usable blocks.' })
  }
  // Every prompt costs real money — log the tokens so the spend is visible here
  // rather than only as a surprise on the Console's per-key cost column.
  const { input_tokens: inTok = 0, output_tokens: outTok = 0 } = message.usage ?? {}
  console.log(
    `/architect  ${patch.blocks.length} blocks, ${patch.links.length} links  ` +
      `[${ARCHITECT_MODEL} ${inTok}in/${outTok}out]  "${prompt.slice(0, 50)}"`,
  )
  res.json(patch)
})

// ---- durable architectures -------------------------------------------------

app.get('/architectures', requireAuth, async (_req, res) => {
  res.json({ architectures: await storage.read() })
})

/**
 * Replace the stored set with the client's. The browser owns the canvas state,
 * so this is a whole-list PUT rather than per-architecture writes — which means
 * deletes have to be honoured by pruning whatever is no longer in the payload.
 */
app.put('/architectures', requireAuth, async (req, res) => {
  if (!Array.isArray(req.body?.architectures)) {
    return res.status(400).json({ error: 'architectures must be an array' })
  }
  const list = sanitizeArchitectures(req.body.architectures)
  await storage.write(list)
  console.log(`/architectures  saved ${list.length} to ${storage.describe()}`)
  res.json({ architectures: list })
})

/**
 * Prompt -> `claude -p` in the target directory, streamed back as the
 * newline-delimited {log|status|result|error} objects orchestratorRunner reads.
 *
 * An optional `architecture` is rendered to text and prepended to the prompt,
 * so a diagram Sriram drew ships as context with the request instead of being
 * something only he can see.
 */
app.post('/run', requireAuth, (req, res) => {
  if (!RUN_ENABLED) {
    return res.status(501).json({
      error: 'Claude Code runs are local-only — start the orchestrator on your laptop to use /run.',
    })
  }
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  if (!prompt) return res.status(400).json({ error: 'prompt is required' })

  const arch = req.body?.architecture ? sanitizeArchitecture(req.body.architecture) : null
  const fullPrompt = arch ? `${architectureContext(arch)}\n${prompt}` : prompt

  const requested = typeof req.body?.path === 'string' ? req.body.path : ''
  let cwd = process.cwd()
  if (requested) {
    try {
      if (!statSync(requested).isDirectory()) throw new Error('not a directory')
      cwd = requested
    } catch {
      return res.status(400).json({ error: `Not a directory: ${requested}` })
    }
  }

  res.setHeader('Content-Type', 'application/x-ndjson')
  const send = (obj) => res.write(`${JSON.stringify(obj)}\n`)
  send({ log: `▸ claude -p in ${cwd}` })
  if (arch) send({ log: `▸ context: architecture "${arch.name}" (${arch.blocks.length} blocks)` })

  // No shell: prompt and path are passed as argv entries, so neither can inject
  // a second command however they are quoted. stdin is closed because `claude -p`
  // otherwise waits 3s for piped input that is never coming and warns about it.
  const child = spawn('claude', ['-p', fullPrompt], { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderrTail = ''

  const pump = (stream, onLine) => {
    let buf = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
      buf += chunk
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) onLine(line)
    })
    stream.on('end', () => {
      if (buf.trim()) onLine(buf)
    })
  }
  pump(child.stdout, (line) => {
    stdout += `${line}\n`
    send({ log: line })
  })
  pump(child.stderr, (line) => {
    stderrTail = line
    send({ log: line })
  })

  let settled = false
  const finish = (update) => {
    if (settled) return
    settled = true
    send(update)
    res.end()
  }

  child.on('error', (err) => {
    const hint = err.code === 'ENOENT' ? 'Claude Code CLI not found on PATH.' : err.message
    finish({ status: 'error', error: hint })
  })
  child.on('close', (code, signal) => {
    if (code === 0) finish({ status: 'done', result: stdout.trim() })
    else if (signal) finish({ status: 'error', error: `claude was killed by ${signal}` })
    else finish({ status: 'error', error: stderrTail || `claude exited with code ${code}` })
  })

  // Abort the run if the browser hangs up — but watch `res`, not `req`. Once
  // express.json() has consumed the body, `req` emits 'close' immediately, so
  // killing on that signal shoots the child a few milliseconds after spawning it.
  // `settled` keeps a normal finish from killing an already-dead process.
  res.on('close', () => {
    if (!settled) child.kill()
  })
})

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'goldensyrup-os-orchestrator' }))

// ---- the site itself -------------------------------------------------------
//
// When a build exists, serve it from this same process. One origin means no
// CORS, and it means Sriram opens one Railway URL rather than wiring a separate
// frontend host to a separate API host.
const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url))
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  // SPA fallback: anything not matched above and not an API path is the app.
  // The boundary must be `/` or end-of-path, not \b: \b also matches before a
  // hyphen, so `/architecture-notes` would be read as the API and 404 rather
  // than loading the app.
  app.get(/^(?!\/(architect|architectures|run|health|auth)(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

// Express 5 funnels rejected route promises here. Report the upstream status
// where there is one (401 bad key, 429 rate limit) instead of a blanket 500.
app.use((err, _req, res, _next) => {
  console.error(err)
  const status = err instanceof Anthropic.APIError && err.status ? err.status : 500
  res.status(status).json({ error: err.message ?? 'orchestrator error' })
})

app.listen(PORT, HOST, () => {
  console.log(`orchestrator on http://${HOST}:${PORT}  (origins: ${ALLOWED_ORIGINS.join(', ')})`)
  console.log(`/architect model: ${ARCHITECT_MODEL} (effort ${ARCHITECT_EFFORT})`)
  console.log(`architectures:   ${storage.describe()} (${storage.kind})`)
  console.log(`auth:            ${AUTH_ON ? 'password required' : 'OFF (local only)'}`)
  console.log(`/run:            ${RUN_ENABLED ? 'enabled' : 'disabled (hosted)'}`)
  console.log(`site:            ${existsSync(DIST_DIR) ? 'serving ../dist' : 'not built — API only'}`)
})
