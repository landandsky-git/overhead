// Runs the automatic checks with Node. The GitHub workflow runs this before publishing; any failed
// check stops the site from being updated. Usage: node tests/run-node.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");

// A bare browser-like global: the checked files only need these at load time.
const saved = {};
const context = {
  console,
  localStorage: { getItem: k => (k in saved ? saved[k] : null), setItem: (k, v) => { saved[k] = String(v); }, removeItem: k => { delete saved[k]; } },
  document: { getElementById: () => null },
};
context.window = context; context.self = context;
vm.createContext(context);
for (const file of ["lib/satellite.min.js", "js/i18n.js", "codes.js", "sky-data.js", "js/state.js", "js/data.js", "js/astro.js", "js/skyguide.js", "tests/pass-reference.js", "tests/checks.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const results = vm.runInContext("runChecks()", context);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
