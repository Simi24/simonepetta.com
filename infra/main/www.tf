# Looked up by name, so the zone ID is not in the repo.
data "cloudflare_zone" "site" {
  filter = {
    name = var.zone_name
  }
}

# Never the apex record (the Worker's Custom Domain creates it), never vault. or tripla.
# 100:: is the discard prefix: the record only exists so the proxy answers and the rule redirects.
resource "cloudflare_dns_record" "www" {
  zone_id = data.cloudflare_zone.site.zone_id
  name    = "www"
  type    = "AAAA"
  content = "100::"
  ttl     = 1
  proxied = true
  comment = "Redirected to the apex by the www_to_apex rule"
}

resource "cloudflare_ruleset" "www_to_apex" {
  zone_id = data.cloudflare_zone.site.zone_id
  name    = "www to apex"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules = [{
    description = "Redirect www to the apex, keeping path and query"
    action      = "redirect"
    expression  = "(http.host eq \"www.${var.zone_name}\")"
    enabled     = true
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = true
        target_url = {
          expression = "concat(\"https://${var.zone_name}\", http.request.uri.path)"
        }
      }
    }
  }]
}
