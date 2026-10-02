# Google Search Console domain verification (SPEC.md §10.3). Created by Google's Cloudflare
# integration when the author added the property on 2026-10-02, then imported here. Removing
# it unverifies the property.
resource "cloudflare_dns_record" "search_console" {
  zone_id = data.cloudflare_zone.site.zone_id
  name    = var.zone_name
  type    = "TXT"
  content = "\"google-site-verification=dq6Gt1M0Xv8Ey9gZ5JvJIYUCztLqrDnXsH-gcykV5Nc\""
  ttl     = 3600
}
