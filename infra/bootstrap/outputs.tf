output "state_bucket" {
  description = "Bucket name to put in the backend block of infra/main."
  value       = aws_s3_bucket.state.id
}
