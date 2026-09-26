# Independent hosting preparation — Version 22

This app remains on Vinext, React, Vite and Cloudflare Workers. Standard Wrangler configuration replaces ChatGPT Sites configuration. R2 retains the existing `REPORTS` binding; no page, styling, scoring, report, MLB or direct Fantrax code was changed. The repository-root collector and `public/fantasygm.json` pipeline remain separate and unchanged.

## Local use

From `apps/fantasygm2027-v22`, use Node >=22.13 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm dev
# Production build and local preview:
pnpm build
pnpm start
```

The existing `start` script runs the generated Worker locally, not a public deployment. Local R2 state is separate from production and starts empty. Do not use remote bindings for this preparation step. No Cloudflare account is required for a local build.

## Sites dependency inventory

| Previous dependency | Independent configuration |
| --- | --- |
| `@openai/sites-vite-plugin` in package, lockfile and Vite plugin list | Removed; retained pinned Vinext and Cloudflare plugins |
| `.openai/hosting.json` and its Sites project ID | Removed from this revision; preserved in the Version 22 Git history |
| Sites-generated R2 bucket configuration (`site-creator-r2`) | Standard `wrangler.jsonc`, binding `REPORTS`, proposed bucket `fantasygm2027-reports` |
| Unused Sites D1 placeholder (`d1: null`) | Removed; no database dependency introduced |
| Codex Seatbelt preview-specific polling | Removed from Vite configuration |
| Sites publication/version service and managed domain | No longer needed to build; future hosting/domain setup is still pending |
| Sites private-access gateway | Not implemented in app code; equivalent external access protection is required before publication |
| Existing Sites-owned report objects and any external capture schedules | Not transferred or recreated in this step |

There are no remaining active ChatGPT Sites imports or configuration dependencies. `cloudflare:workers` is the standard Workers runtime API, retained intentionally. No runtime or package versions were upgraded.

## REPORTS behavior retained

The unchanged server routes use `env.REPORTS.get`, `put`, `delete`, and conditional writes. Existing keys remain `daily/current.json`, `weeks/YYYY-MM-DD.json`, `evidence/fantrax.json`, and `evidence/roster.json`. Daily cache expiry, evidence validation/expiry and write-once Monday baselines retain their current behavior. Migration step 4 now reads the published GitHub snapshot for overlapping league data and continues MLB enrichment. See DATA-SOURCES.md for retained manual evidence and refresh behavior.

## Before a later deployment

Provision a user-controlled Workers application and R2 bucket, confirm the bucket name, and configure a private domain with access protection for pages and all API routes. The current application relies on the former gateway for authentication; same-origin checks alone are not authentication. `workers_dev` and preview URLs are disabled, and no public route is configured here. These settings do not themselves create an authentication system.

REPORTS data migration remains pending. Without it, historical baselines and captured evidence will be absent. Inspect and recreate any desired external capture schedule separately; none is provisioned here. No account resources, schedules, data or deployments were created by this change.

Reference: https://developers.cloudflare.com/workers/vite-plugin/get-started/

## Step 3 verification

On 2026-09-26, a frozen-lockfile installation succeeded and one `pnpm build` completed successfully without the Sites plugin or `.openai/hosting.json`. The build emitted all five page routes and four API routes. Vinext reported its existing static route-classification limitation; this was informational and the build exited successfully. No runtime, browser, data-fetch or deployment tests were run. Production access protection, bucket provisioning and REPORTS migration remain unverified and pending.
