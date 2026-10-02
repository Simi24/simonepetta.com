provider "aws" {
  region              = "eu-south-1"
  profile             = "personale"
  allowed_account_ids = ["209556027092"]

  default_tags {
    tags = {
      terraform   = "true"
      environment = "prod"
      project     = "personal"
      subproject  = "simonepetta-com"
    }
  }
}

# The token comes from TF_VAR_cloudflare_api_token.
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
