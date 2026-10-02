terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.67"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.26"
    }
  }

  # Created by infra/bootstrap. Backend blocks cannot use variables.
  backend "s3" {
    bucket       = "simonepetta-terraform-state-209556027092"
    key          = "main/terraform.tfstate"
    region       = "eu-south-1"
    profile      = "personale"
    encrypt      = true
    use_lockfile = true
  }
}
