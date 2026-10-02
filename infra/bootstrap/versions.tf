terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.67"
    }
  }
}

# The state of this config stays local (terraform.tfstate, gitignored): it creates the bucket
# that holds the state of everything else. Keep the file after the one apply.
provider "aws" {
  region              = "eu-south-1"
  profile             = "personale"
  allowed_account_ids = ["209556027092"]

  default_tags {
    tags = {
      terraform   = "true"
      environment = "shared"
      project     = "personal"
      subproject  = "simonepetta-com"
    }
  }
}
