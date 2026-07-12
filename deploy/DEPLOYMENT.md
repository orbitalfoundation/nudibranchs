# Nudibranchs — deployment reference

Audience: humans **and** Claude instances. This is a **purely static site** (a
bundled `dist/`: `index.html` + `app.js`). It will run on any static host; we use
exe.dev because it's the house standard and one command to share. Source of truth is
the git repo — `npm run build` regenerates `dist/`. Sibling of the `fish/` project;
the exhaustive exe.dev model lives in `fish/deploy/DEPLOYMENT.md`.

## What's deployed

- **Repo:** https://github.com/orbitalfoundation/nudisophores (public)
- **VM:** `nudis` (exe.dev, region `lax`), login user `exedev`.
- **URL:** https://nudis.exe.xyz (public).
- **Serving:** a `caddy:2` Docker container named `nudi`, `-p 8000:80`,
  bind-mounting `/srv/site` (the build) and `/srv/Caddyfile` read-only.

## The path (from a box whose SSH key is registered with exe.dev)

The exe.dev **gateway SSH** is the control plane here (no API token needed — the
key is authorized). Keepalives turn an occasional hang into a fast failure.

```sh
ssh -o ServerAliveInterval=5 exe.dev new --name nudis   # create the VM
deploy/provision.sh nudis                               # /srv, Caddyfile, run Caddy :8000
deploy/deploy.sh   nudis                                # npm run build + rsync dist/ → /srv/site
ssh -o ServerAliveInterval=5 exe.dev share port nudis 8000
ssh -o ServerAliveInterval=5 exe.dev share set-public nudis
```

VM SSH (`ssh exedev@nudis.exe.xyz`) works from anywhere; that's what the scripts use.
A freshly-created VM takes ~30–60 s to accept SSH — retry provision if the first
attempt closes the connection.

## Continuous deployment (push = deploy)

`deploy/setup-autodeploy.sh nudis` installs an on-VM systemd timer
(`nudis-autodeploy.timer`) that polls GitHub `main` every ~2 min and, when the SHA
moves, pulls + `npm ci` + `npm run build` + rsyncs `dist/` into `/srv/site`. Caddy
serves the new files immediately. **Once installed, pushing to `main` is the deploy;**
`deploy/deploy.sh` remains a manual override.

Watch it: `ssh exedev@nudis.exe.xyz journalctl -u nudis-autodeploy -f`

## Verify

```sh
curl -sS -o /dev/null -w "%{http_code}\n" https://nudis.exe.xyz/                     # 200 when public
ssh exedev@nudis.exe.xyz 'curl -s -o /dev/null -w "%{http_code}\n" localhost:8000/'  # always 200 if Caddy is up
# End-to-end (actually renders WebGL, not just HTTP): URL=https://nudis.exe.xyz/ npm run render
```

## Quick recovery

- **Down after reboot:** `ssh exedev@nudis.exe.xyz 'sudo systemctl enable --now docker; docker start nudi'`
- **`Host key verification failed`:** VM reprovisioned — `ssh-keygen -R nudis.exe.xyz` (scripts pass `accept-new`).
- **VM gone:** `ssh exe.dev new --name nudis` → `provision.sh` → `deploy.sh` → re-run the public step → `setup-autodeploy.sh`. Everything is in this repo.
