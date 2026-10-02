#!/usr/bin/env bash
# fmt and validate for both Terraform configs. No backend, no credentials, no network beyond
# the provider download: never plan or apply from here.
set -euo pipefail
unset AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY CLOUDFLARE_API_TOKEN

cd "$(dirname "$0")/../.."
terraform fmt -check -recursive infra
for dir in infra/bootstrap infra/main; do
  terraform -chdir="$dir" init -backend=false -input=false
  terraform -chdir="$dir" validate
done
