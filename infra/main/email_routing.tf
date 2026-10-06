# Cloudflare Email Routing for quits@ (SPEC.md §10.3). Enabling it on the zone makes Cloudflare
# add its MX, SPF and DKIM records at the apex name; none of them touches the apex A/AAAA/CNAME.
resource "cloudflare_email_routing_dns" "site" {
  zone_id = data.cloudflare_zone.site.zone_id
  name    = var.zone_name
}

# Account-level destination. Creating it makes Cloudflare email a verification link to the
# address: the rule only forwards after the owner clicks it.
resource "cloudflare_email_routing_address" "owner" {
  account_id = data.cloudflare_zone.site.account.id
  email      = var.email_forward_to
}

resource "cloudflare_email_routing_rule" "quits" {
  zone_id = data.cloudflare_zone.site.zone_id
  name    = "quits to owner inbox"
  enabled = true

  matchers = [{
    type  = "literal"
    field = "to"
    value = "${var.email_quits_local_part}@${var.zone_name}"
  }]

  actions = [{
    type  = "forward"
    value = [cloudflare_email_routing_address.owner.email]
  }]

  depends_on = [cloudflare_email_routing_dns.site]
}
