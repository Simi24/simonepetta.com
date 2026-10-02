variable "cloudflare_api_token" {
  description = "Cloudflare API token scoped to DNS and Rulesets edit on the zone. Set through TF_VAR_cloudflare_api_token."
  type        = string
  sensitive   = true
}

variable "zone_name" {
  description = "Cloudflare zone the site lives in."
  type        = string
  default     = "simonepetta.com"
}
