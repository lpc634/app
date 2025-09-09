const { execSync } = require("node:child_process");

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

console.log("==> Building frontend for Heroku…");
// Frontend is at repo root using Vite
run("npm ci");
run("npm run build");

// Copy built assets into dist/ for Flask to serve (main.py serves from ./dist)
run("mkdir -p dist");
run("cp -R ./dist/* ./dist/");
