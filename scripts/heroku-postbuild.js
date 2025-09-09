const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function run(cmd, cwd = process.cwd()) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd });
}

console.log("==> Building frontend for Heroku…");

// Detect frontend location (subfolder vs root)
const FRONTEND_DIR = fs.existsSync(path.join("frontend", "package.json")) ? "frontend" : ".";

// Build
run("npm ci", FRONTEND_DIR);
run("npm run build", FRONTEND_DIR);

// Determine where Flask serves static from. This app uses ./dist (see main.py)
const TARGET_STATIC = path.join(".", "dist");
const BUILD_DIST = path.join(FRONTEND_DIR, "dist");

if (!fs.existsSync(BUILD_DIST)) {
  console.error(`Build output not found at ${BUILD_DIST}`);
  process.exit(1);
}

// If building at repo root, the output is already in TARGET_STATIC; no copy needed
if (path.resolve(BUILD_DIST) === path.resolve(TARGET_STATIC)) {
  console.log(`Build output already at ${TARGET_STATIC}. Skipping copy.`);
} else {
  // Clean and copy into target static dir
  run(`rm -rf ${TARGET_STATIC}`);
  run(`mkdir -p ${TARGET_STATIC}`);
  run(`cp -R ${BUILD_DIST}/. ${TARGET_STATIC}/`);
}

console.log("==> Frontend built and staged to static dir ✅");
