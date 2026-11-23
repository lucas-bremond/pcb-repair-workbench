// The viewer's server: lists the scenario folders, serves their files, saves the app's edits to
// scenario.json (after build.py has validated them and regenerated the outputs), appends the
// user's observations, instructions and results to record.json, and serves the built app. It never
// writes plan.json: that is the agent's. Node.js only, no dependencies.
//
// Environment:
//   PORT            port to listen on (8080)
//   HOST            address to listen on (127.0.0.1; 0.0.0.0 in Docker)
//   SCENARIO_ROOTS  folders holding scenario folders, as name=path pairs separated by commas
//                   (scenarios=<repo>/scenarios)
//   STATIC_DIR      the built app to serve (app/web/dist); empty to serve the API only (make dev)
//   PYTHON          the Python with scripts/requirements.txt installed (python3)
import http from "node:http"
import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { spawn } from "node:child_process"
import { formatScenario } from "./scenario-json.mjs"

const APP = path.resolve(import.meta.dirname, "..")
const REPO = path.dirname(APP)
const BUILD = path.join(APP, "scripts", "build.py")
const PYTHON = process.env.PYTHON || "python3"
const STATIC_DIR = process.env.STATIC_DIR ?? path.join(APP, "web", "dist")
const ROOTS = Object.fromEntries(
  (process.env.SCENARIO_ROOTS || `scenarios=${path.join(REPO, "scenarios")}`)
    .split(",").filter(Boolean).map((pair) => {
      const [name, ...rest] = pair.split("=")
      return [name.trim(), path.resolve(rest.join("=").trim())]
    }),
)
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".pdf": "application/pdf", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".kicad_sch": "text/plain; charset=utf-8",
}
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

// ---------------------------------------------------------------- helpers

const send = (res, status, body, headers = {}) => {
  const json = typeof body !== "string" && !Buffer.isBuffer(body)
  res.writeHead(status, { "Content-Type": json ? "application/json" : "text/plain; charset=utf-8", "Cache-Control": "no-cache", ...headers })
  res.end(json ? JSON.stringify(body) : body)
}
const etagOf = (text) => crypto.createHash("sha1").update(text).digest("hex").slice(0, 16)
const readJson = async (file) => JSON.parse(await fsp.readFile(file, "utf8"))
const exists = (file) => fsp.stat(file).then(() => true, () => false)
const mtime = (file) => fsp.stat(file).then((s) => s.mtimeMs, () => 0)

/** The scenario folder for an id ("root/folder"), or null when the id is not one. */
function folderOf(id) {
  const [root, name, ...rest] = String(id).split("/")
  if (rest.length || !ROOTS[root] || !NAME.test(name || "")) return null
  return path.join(ROOTS[root], name)
}

/** Run build.py on a scenario; resolves to its JSON result ({ ok, errors, warnings, summary,
 *  fingerprint, plan }). `input` replaces scenario.json; `record` (with `investigation`) replaces
 *  record.json; `investigation` checks plan.json and record.json only. */
function runBuild(folder, { input, record, investigation } = {}) {
  return new Promise((resolve) => {
    const args = ["-I", BUILD, folder, "--json", ...(input ? ["--input", input] : []),
      ...(investigation ? ["--investigation"] : []), ...(record ? ["--record", record] : [])]
    const p = spawn(PYTHON, args, { env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } })
    let out = "", err = ""
    p.stdout.on("data", (d) => (out += d))
    p.stderr.on("data", (d) => (err += d))
    p.on("error", (e) => resolve({ ok: false, errors: [`could not run ${PYTHON}: ${e.message}`], warnings: [] }))
    p.on("close", () => {
      try { resolve(JSON.parse(out.trim().split("\n").pop())) }
      catch { resolve({ ok: false, errors: [`build.py failed: ${(err || out).trim().split("\n").slice(-3).join(" ")}`], warnings: [] }) }
    })
  })
}

// one operation at a time per scenario (builds and saves)
const queues = new Map()
function serial(folder, fn) {
  const next = (queues.get(folder) || Promise.resolve()).then(fn, fn)
  queues.set(folder, next.catch(() => {}))
  return next
}

// the last build result per scenario, kept so a page load does not rebuild an up-to-date scenario
const lastStatus = new Map()
let scriptsTime = 0
async function newestScript() {
  if (!scriptsTime) {
    const dir = path.join(APP, "scripts")
    const schemas = (await fsp.readdir(path.join(APP, "schema"))).map((f) => path.join(APP, "schema", f))
    const files = [...(await fsp.readdir(dir)).filter((f) => f.endsWith(".py")).map((f) => path.join(dir, f)), ...schemas]
    scriptsTime = Math.max(...(await Promise.all(files.map(mtime))))
    setTimeout(() => (scriptsTime = 0), 2000) // re-read soon, so edits to the scripts are picked up (make dev)
  }
  return scriptsTime
}

/** Rebuild generated/ when scenario.json or the scripts are newer than it; re-check the
 *  investigation only when plan.json or record.json are newer than the last result. */
async function ensureBuilt(folder) {
  return serial(folder, async () => {
    const built = await mtime(path.join(folder, "generated", "view.json"))
    const checked = await mtime(path.join(folder, "generated", "status.json"))
    const source = Math.max(await mtime(path.join(folder, "scenario.json")), await newestScript())
    const investigation = Math.max(await mtime(path.join(folder, "plan.json")), await mtime(path.join(folder, "record.json")))
    let status
    if (!built || built < source || !checked) status = await runBuild(folder)
    else if (checked < investigation) status = await runBuild(folder, { investigation: true })
    else status = lastStatus.get(folder) || (await readJson(path.join(folder, "generated", "status.json")).catch(() => null))
    if (!status) status = await runBuild(folder)
    lastStatus.set(folder, status)
    return status
  })
}

/** plan.json and record.json as the page needs them, with their versions. */
async function loadInvestigation(folder) {
  const read = async (name) => {
    const text = await fsp.readFile(path.join(folder, name), "utf8").catch(() => null)
    if (text === null) return [null, null]
    try { return [JSON.parse(text), etagOf(text)] } catch { return [null, etagOf(text)] }
  }
  const [plan, planEtag] = await read("plan.json")
  const [record, recordEtag] = await read("record.json")
  return { plan, planEtag, record, recordEtag }
}

async function loadGenerated(folder) {
  const view = await readJson(path.join(folder, "generated", "view.json")).catch(() => null)
  const data3d = await readJson(path.join(folder, "generated", "model3d.json")).catch(() => null)
  return { view, data3d }
}

// ---------------------------------------------------------------- API

async function listScenarios() {
  const scenarios = []
  for (const [root, dir] of Object.entries(ROOTS)) {
    const names = await fsp.readdir(dir).catch(() => [])
    for (const name of names.sort()) {
      if (!NAME.test(name)) continue
      const folder = path.join(dir, name)
      if (!(await exists(path.join(folder, "scenario.json")))) continue
      const id = `${root}/${name}`
      try {
        const doc = await readJson(path.join(folder, "scenario.json"))
        if (!(await exists(path.join(folder, "generated", "view.json")))) ensureBuilt(folder).catch(() => {}) // the thumbnail, for next time
        const thumb = (await exists(path.join(folder, "generated", "photos", "top.jpg"))) ? "generated/photos/top.jpg"
          : (await exists(path.join(folder, "generated", "photos", "bottom.jpg"))) ? "generated/photos/bottom.jpg" : null
        scenarios.push({
          id, root, name, title: doc.board?.title || name, board: doc.board?.name || "", marking: doc.board?.marking || "",
          description: doc.board?.description || "", parts: Object.keys(doc.parts || {}).length, nets: Object.keys(doc.nets || {}).length,
          questions: (doc.open_questions || []).length, thumbnail: thumb, modified: await mtime(path.join(folder, "scenario.json")),
          plan: (await readJson(path.join(folder, "plan.json")).catch(() => null))?.revision ?? null,
        })
      } catch (e) {
        scenarios.push({ id, root, name, title: name, error: `scenario.json: ${e.message}` })
      }
    }
  }
  return { roots: Object.keys(ROOTS), scenarios }
}

async function getScenario(id) {
  const folder = folderOf(id)
  if (!folder || !(await exists(path.join(folder, "scenario.json")))) return [404, { error: `no scenario ${id}` }]
  const status = await ensureBuilt(folder)
  const text = await fsp.readFile(path.join(folder, "scenario.json"), "utf8")
  let doc
  try { doc = JSON.parse(text) } catch (e) { return [422, { error: `scenario.json: ${e.message}`, status }] }
  return [200, { id, doc, etag: etagOf(text), status, ...(await loadGenerated(folder)), ...(await loadInvestigation(folder)) }]
}

/** The versions of the three files, for the page to notice what changed on disk (the agent). */
async function getEtags(id) {
  const folder = folderOf(id)
  if (!folder || !(await exists(path.join(folder, "scenario.json")))) return [404, { error: `no scenario ${id}` }]
  const hash = async (name) => fsp.readFile(path.join(folder, name), "utf8").then(etagOf, () => null)
  return [200, { scenario: await hash("scenario.json"), plan: await hash("plan.json"), record: await hash("record.json") }]
}

const LISTS = { observations: "O", instructions: "I", results: "R" }
const today = () => new Date().toISOString().slice(0, 10)

/** Add an entry to record.json (the server numbers it) or void one; build.py checks the result
 *  before it replaces the file. Body: { op: "add", list, entry } or { op: "void", list, id, reason }. */
async function changeRecord(id, body) {
  const folder = folderOf(id)
  if (!folder || !(await exists(path.join(folder, "scenario.json")))) return [404, { error: `no scenario ${id}` }]
  if (!body || !LISTS[body.list] || !["add", "void"].includes(body.op)) return [400, { error: "expected { op: add|void, list: observations|instructions|results, ... }" }]
  return serial(folder, async () => {
    const file = path.join(folder, "record.json")
    const record = (await readJson(file).catch(() => null)) || { format: "pcb-record", version: 2 }
    const list = record[body.list] || (record[body.list] = [])
    let entry
    if (body.op === "add") {
      if (!body.entry || typeof body.entry !== "object") return [400, { error: "expected an entry" }]
      const prefix = LISTS[body.list]
      const n = Math.max(0, ...list.map((e) => +String(e.id).slice(1) || 0)) + 1
      entry = { id: "", date: today(), ...body.entry }
      entry.id = prefix + n // the server numbers entries, always (first in the object, as in the file)
      delete entry.void
      list.push(entry)
    } else {
      entry = list.find((e) => e.id === body.id)
      if (!entry) return [404, { error: `no ${body.id} in ${body.list}` }]
      if (entry.void) return [409, { error: `${body.id} is already void` }]
      if (!String(body.reason || "").trim()) return [400, { error: "give a reason" }]
      entry.void = { date: body.date || today(), reason: String(body.reason).trim() }
    }
    for (const k of Object.keys(LISTS)) record[k] ||= []
    const text = formatScenario({ format: record.format, version: record.version, observations: record.observations, instructions: record.instructions, results: record.results }) + "\n"
    const tmp = path.join(folder, `.record.json.${process.pid}.saving`)
    await fsp.writeFile(tmp, text)
    const status = await runBuild(folder, { investigation: true, record: tmp })
    if (!status.ok) {
      await fsp.rm(tmp, { force: true })
      return [422, { error: "not saved: the record has problems", status }]
    }
    await fsp.rename(tmp, file)
    const now = new Date()
    await fsp.utimes(path.join(folder, "generated", "status.json"), now, now).catch(() => {}) // it describes this record
    lastStatus.set(folder, status)
    return [200, { entry, record: JSON.parse(text), recordEtag: etagOf(text), status }]
  })
}

async function saveScenario(id, body) {
  const folder = folderOf(id)
  if (!folder || !(await exists(path.join(folder, "scenario.json")))) return [404, { error: `no scenario ${id}` }]
  if (!body || typeof body.doc !== "object") return [400, { error: "expected { doc, etag }" }]
  return serial(folder, async () => {
    const file = path.join(folder, "scenario.json")
    const current = await fsp.readFile(file, "utf8")
    if (body.etag && body.etag !== etagOf(current)) return [409, { error: "scenario.json changed on disk since it was loaded", etag: etagOf(current) }]
    const text = formatScenario(body.doc) + "\n"
    if (text === current) return [200, { etag: etagOf(text), status: lastStatus.get(folder) || { ok: true, errors: [], warnings: [] }, unchanged: true }]
    const tmp = path.join(folder, `.scenario.json.${process.pid}.saving`)
    await fsp.writeFile(tmp, text)
    const status = await runBuild(folder, { input: tmp })
    if (!status.ok) {
      await fsp.rm(tmp, { force: true })
      return [422, { error: "not saved: the scenario has problems", status }]
    }
    await fsp.rename(tmp, file)
    lastStatus.set(folder, status)
    return [200, { etag: etagOf(text), status, ...(await loadGenerated(folder)) }]
  })
}

async function readBody(req, limit = 20e6) {
  let size = 0
  const chunks = []
  for await (const c of req) {
    size += c.length
    if (size > limit) throw new Error("body too large")
    chunks.push(c)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null")
}

// ---------------------------------------------------------------- files

async function sendFile(res, file, cache) {
  const stat = await fsp.stat(file).catch(() => null)
  if (!stat?.isFile()) return false
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": stat.size, "Cache-Control": cache })
  fs.createReadStream(file).pipe(res)
  return true
}

/** A path inside base, or null when rel climbs out of it. */
function inside(base, rel) {
  const file = path.resolve(base, "." + path.posix.normalize("/" + rel))
  return file === base || file.startsWith(base + path.sep) ? file : null
}

// ---------------------------------------------------------------- routes

async function handle(req, res) {
  const url = new URL(req.url, "http://x")
  const p = decodeURIComponent(url.pathname)
  if (p === "/api/scenarios" && req.method === "GET") return send(res, 200, await listScenarios())
  let m = p.match(/^\/api\/scenarios\/([^/]+\/[^/]+)$/)
  if (m && req.method === "GET") { const [s, b] = await getScenario(m[1]); return send(res, s, b) }
  if (m && req.method === "PUT") {
    let body
    try { body = await readBody(req) } catch (e) { return send(res, 400, { error: e.message }) }
    const [s, b] = await saveScenario(m[1], body)
    return send(res, s, b)
  }
  m = p.match(/^\/api\/scenarios\/([^/]+\/[^/]+)\/etags$/)
  if (m && req.method === "GET") { const [s, b] = await getEtags(m[1]); return send(res, s, b) }
  m = p.match(/^\/api\/scenarios\/([^/]+\/[^/]+)\/record$/)
  if (m && req.method === "POST") {
    let body
    try { body = await readBody(req) } catch (e) { return send(res, 400, { error: e.message }) }
    const [s, b] = await changeRecord(m[1], body)
    return send(res, s, b)
  }
  if (p.startsWith("/api/")) return send(res, 404, { error: "not found" })
  m = p.match(/^\/files\/([^/]+\/[^/]+)\/(.+)$/)
  if (m && req.method === "GET") {
    const folder = folderOf(m[1])
    const file = folder && inside(folder, m[2])
    if (file && !path.basename(file).startsWith(".") && (await sendFile(res, file, "no-cache"))) return
    return send(res, 404, "not found")
  }
  if (STATIC_DIR && req.method === "GET") {
    const file = inside(STATIC_DIR, p === "/" ? "index.html" : p.slice(1))
    const cache = p.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache"
    if (file && (await sendFile(res, file, cache))) return
    if (await sendFile(res, path.join(STATIC_DIR, "index.html"), "no-cache")) return // the app routes itself
  }
  send(res, 404, "not found")
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error(e); if (!res.headersSent) send(res, 500, { error: e.message }) })
})
const port = +(process.env.PORT || 8080), host = process.env.HOST || "127.0.0.1"
server.listen(port, host, () => {
  console.log(`Scenario server on http://${host === "0.0.0.0" ? "localhost" : host}:${server.address().port}`)
  for (const [name, dir] of Object.entries(ROOTS)) console.log(`  ${name}: ${dir}${fs.existsSync(dir) ? "" : " (missing)"}`)
})
export default server
