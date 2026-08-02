output "bucket_site" {
  description = "Nom du bucket S3 — à reporter dans le secret GitHub S3_BUCKET."
  value       = aws_s3_bucket.site.id
}

output "cloudfront_distribution_id" {
  description = "Identifiant de la distribution — secret GitHub CLOUDFRONT_DISTRIBUTION_ID."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domaine" {
  description = "Adresse technique de CloudFront. Sert à tester le site AVANT que le DNS ne soit délégué."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "role_deploiement_arn" {
  description = "Rôle à assumer par GitHub Actions — secret GitHub AWS_ROLE_ARN. Vide si github_repository n'a pas été renseigné."
  value       = local.deploiement_actif ? aws_iam_role.deploiement[0].arn : ""
}

output "serveurs_de_noms" {
  description = <<-EOT
    À RECOPIER CHEZ LE REGISTRAR du domaine, faute de quoi rien ne répondra sur
    musea.space. C'est l'étape manuelle incontournable, et la validation du
    certificat ACM en dépend : elle restera bloquée tant que la délégation n'est
    pas effective (comptez de quelques minutes à quelques heures de propagation).
  EOT
  value       = var.create_hosted_zone ? aws_route53_zone.principale[0].name_servers : []
}

output "adresses_du_site" {
  description = "Ce que le visiteur tapera une fois le DNS en place."
  value = {
    plateforme           = "https://${var.domain}"
    exemple_organisation = "https://bandjoun.${var.domain}"
  }
}

output "rappel_supabase" {
  description = "Étape manuelle à ne pas oublier côté Supabase."
  value = join(" ", [
    "Supabase → Authentication → URL Configuration :",
    "poser Site URL = https://${var.domain}",
    "et ajouter aux Redirect URLs https://${var.domain}/** ainsi que https://*.${var.domain}/**.",
    "Sans cela, la connexion Google et les liens e-mail renverront vers localhost."
  ])
}
