resource "aws_budgets_budget" "monthly" {
  name         = "simonepetta-com-monthly"
  budget_type  = "COST"
  limit_amount = "5"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = {
      actual_50    = { threshold = 50, type = "ACTUAL" }
      actual_80    = { threshold = 80, type = "ACTUAL" }
      actual_100   = { threshold = 100, type = "ACTUAL" }
      forecast_100 = { threshold = 100, type = "FORECASTED" }
    }

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value.type
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }
}
