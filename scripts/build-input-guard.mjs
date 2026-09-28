import fs from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { fileURLToPath } from "node:url"

/** Observe successful reads as well as bundler/compiler dependency reports. */
export function observeBuildReads() {
  const reads = new Set()
  const originals = { sync: fs.readFileSync, async: fs.readFile, promise: fs.promises.readFile, openSync: fs.openSync, open: fs.open, promiseOpen: fs.promises.open, stream: fs.createReadStream }
  const record = (file) => {
    if (file instanceof URL) file = fileURLToPath(file)
    if (Buffer.isBuffer(file)) file = file.toString()
    if (typeof file === "string") reads.add(file)
  }
  fs.readFileSync = function(file, ...args) { const result = originals.sync.call(this, file, ...args); record(file); return result }
  fs.readFile = function(file, ...args) {
    const callback = args.pop()
    return originals.async.call(this, file, ...args, (error, data) => { if (!error) record(file); callback(error, data) })
  }
  fs.promises.readFile = async function(file, ...args) { const result = await originals.promise.call(this, file, ...args); record(file); return result }
  const readsContent = flags => typeof flags === "number" ? (flags & 3) !== fs.constants.O_WRONLY : flags === undefined || flags.startsWith("r") || flags.includes("+")
  fs.openSync = function(file, flags, ...args) { const result = originals.openSync.call(this, file, flags, ...args); if (readsContent(flags)) record(file); return result }
  fs.open = function(file, flags, ...args) {
    if (typeof flags === "function") { args.push(flags); flags = undefined }
    const callback = args.pop()
    return originals.open.call(this, file, flags, ...args, (error, descriptor) => { if (!error && readsContent(flags)) record(file); callback(error, descriptor) })
  }
  fs.promises.open = async function(file, flags, ...args) { const result = await originals.promiseOpen.call(this, file, flags, ...args); if (readsContent(flags)) record(file); return result }
  fs.createReadStream = function(file, ...args) { const stream = originals.stream.call(this, file, ...args); stream.once("open", () => record(file)); return stream }
  syncBuiltinESMExports()
  return {
    reads,
    restore() {
      fs.readFileSync = originals.sync; fs.readFile = originals.async; fs.promises.readFile = originals.promise
      fs.openSync = originals.openSync; fs.open = originals.open; fs.promises.open = originals.promiseOpen; fs.createReadStream = originals.stream
      syncBuiltinESMExports()
    },
  }
}
