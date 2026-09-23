# Optional custom domain (ADR-0041). Disabled by default: with
# var.custom_domain null the stack behaves exactly as before, and on
# LocalStack (no CloudFront) the variable is ignored entirely.

locals {
  custom_domain_enabled = local.use_cdn && var.custom_domain != null
}

# The zone must already exist in this account: registering the domain through
# Route53 creates it automatically. Terraform never creates the zone, so a
# typo fails fast here instead of half-building DNS.
data "aws_route53_zone" "custom" {
  count = local.custom_domain_enabled ? 1 : 0
  name  = var.custom_domain
}

# CloudFront only accepts certificates from us-east-1, hence the aliased
# provider - the same reason the Lambda@Edge signer lives there (ADR-0019).
resource "aws_acm_certificate" "custom" {
  count             = local.custom_domain_enabled ? 1 : 0
  provider          = aws.useast1
  domain_name       = var.custom_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = local.custom_domain_enabled ? {
    for dvo in aws_acm_certificate.custom[0].domain_validation_options : dvo.domain_name => dvo
  } : {}

  allow_overwrite = true
  name            = each.value.resource_record_name
  records         = [each.value.resource_record_value]
  ttl             = 60
  type            = each.value.resource_record_type
  zone_id         = data.aws_route53_zone.custom[0].zone_id
}

resource "aws_acm_certificate_validation" "custom" {
  count                   = local.custom_domain_enabled ? 1 : 0
  provider                = aws.useast1
  certificate_arn         = aws_acm_certificate.custom[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Apex records must be aliases: a CNAME cannot sit at the zone apex, and only
# Route53 alias records can point an apex at CloudFront. Alias queries to
# CloudFront are free, so DNS adds nothing to the bill.
resource "aws_route53_record" "custom_a" {
  count   = local.custom_domain_enabled ? 1 : 0
  zone_id = data.aws_route53_zone.custom[0].zone_id
  name    = var.custom_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web[0].domain_name
    zone_id                = aws_cloudfront_distribution.web[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "custom_aaaa" {
  count   = local.custom_domain_enabled ? 1 : 0
  zone_id = data.aws_route53_zone.custom[0].zone_id
  name    = var.custom_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.web[0].domain_name
    zone_id                = aws_cloudfront_distribution.web[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# A CloudFront Function, not Lambda@Edge and not the app: it runs on
# viewer-request (before the cache), costs $0.10/M requests inside a 2M/month
# free tier, and the app cannot do this itself because the origin request
# policy deliberately withholds the viewer Host header from the origin
# (ADR-0009).
resource "aws_cloudfront_function" "canonical_host" {
  count   = local.custom_domain_enabled ? 1 : 0
  name    = "${local.name_prefix}-canonical-host"
  runtime = "cloudfront-js-2.0"
  publish = true
  code = templatefile("${path.module}/cloudfront/canonical-host.js", {
    canonical_host = var.custom_domain
  })
}
