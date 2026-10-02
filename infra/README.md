# infra

Terraform for simonepetta.com (SPEC.md §10). Two independent configs, applied **by hand from the author's Mac**. The loop and CI never run `plan`, `apply`, `import` or `destroy`; CI only runs `scripts/ci/infra-check.sh` (`fmt -check` and `init -backend=false` + `validate`, no credentials).

> **Warning: never use the `default` AWS profile.** On this machine it is a different account. Both configs pin `profile = "personale"` and `allowed_account_ids = ["209556027092"]`, so a wrong profile fails instead of applying. Do not remove the pin and do not export `AWS_PROFILE=default`.

| Config | Creates | State |
|---|---|---|
| `bootstrap/` | S3 state bucket (versioned, SSE-S3, public access blocked); AWS Budget of $5/month with alerts at 50%, 80%, 100% actual and 100% forecast | local file `bootstrap/terraform.tfstate` (gitignored; keep it) |
| `main/` | Cloudflare `www` record (proxied `AAAA 100::`) and the redirect rule `www` to the apex, path and query preserved | S3 bucket above, key `main/terraform.tfstate`, native lockfile (`use_lockfile`, no DynamoDB) |

The apex record is owned by the site Worker's Custom Domain and is never managed here. `vault.` and `tripla.` are not touched.

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `TF_VAR_budget_alert_email` | bootstrap | alert address; never committed, no `.tfvars` with real values |
| `TF_VAR_cloudflare_api_token` | main | token with DNS edit and Rulesets (zone) edit on `simonepetta.com` |

AWS credentials come from the `personale` profile (`aws sso login --profile personale` or your usual login).

## Apply order

1. Bootstrap, once:
   ```sh
   cd infra/bootstrap
   export TF_VAR_budget_alert_email=you@example.com
   terraform init
   terraform plan
   terraform apply
   ```
   Confirm the budget's email subscription if AWS asks.
2. Main:
   ```sh
   cd infra/main
   export TF_VAR_cloudflare_api_token=...
   terraform init
   terraform plan
   terraform apply
   terraform plan   # must report no changes
   ```

## Check before the first main apply

- The `cloudflare_ruleset` owns the zone's whole `http_request_dynamic_redirect` entrypoint. If the zone already has redirect rules (Redirect Rules or Bulk Redirects in the dashboard), `plan` will show them being replaced: stop and add them to the config first.
- The zone must have no existing `www` record, or `apply` fails with a conflict: delete it or `terraform import` it first.
- Verify: `curl -sI https://www.simonepetta.com/x` answers `301` with `location: https://simonepetta.com/x`.

Provider versions are pinned in `versions.tf` and locked in `.terraform.lock.hcl` (committed, `darwin_arm64` and `linux_amd64`).
