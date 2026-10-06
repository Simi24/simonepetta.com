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

variable "email_forward_to" {
  description = "Personal inbox that Email Routing forwards to. Cloudflare emails it a verification link."
  type        = string
  default     = "pettasimonepaolo@gmail.com"
}

variable "email_quits_local_part" {
  description = "Local part of the Quits address on the zone (quits@simonepetta.com)."
  type        = string
  default     = "quits"
}
