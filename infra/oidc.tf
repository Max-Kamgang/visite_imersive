# ============================================================================
# Déploiement depuis GitHub — SANS clé AWS permanente
# ----------------------------------------------------------------------------
# La méthode répandue consiste à créer un utilisateur IAM et à coller sa clé
# secrète dans les secrets GitHub. Cette clé ne périme jamais, se copie sans
# trace, et fuite tôt ou tard.
#
# Ici, GitHub prouve son identité à AWS par un jeton OIDC signé, valable
# quelques minutes. Aucun secret durable n'existe nulle part — et le rôle est
# verrouillé sur UN dépôt précis : un autre dépôt présentant un jeton valide
# se voit refuser l'accès.
# ============================================================================

locals {
  deploiement_actif = var.github_repository != ""
}

# Le fournisseur OIDC est unique PAR COMPTE, pas par projet. Un compte neuf n'en
# a pas ; un compte qui déploie déjà autre chose depuis GitHub en a forcément un,
# et le recréer échouerait (EntityAlreadyExists). D'où l'interrupteur.
resource "aws_iam_openid_connect_provider" "github" {
  count = local.deploiement_actif && var.create_github_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # Empreinte de l'autorité de certification de GitHub. AWS ne la vérifie plus
  # depuis 2023 pour les fournisseurs qu'il connaît, mais le champ reste exigé.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_openid_connect_provider" "github_existant" {
  count = local.deploiement_actif && !var.create_github_oidc_provider ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  github_oidc_arn = local.deploiement_actif ? (
    var.create_github_oidc_provider
    ? aws_iam_openid_connect_provider.github[0].arn
    : data.aws_iam_openid_connect_provider.github_existant[0].arn
  ) : null
}

data "aws_iam_policy_document" "confiance_github" {
  count = local.deploiement_actif ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # C'est CETTE condition qui restreint le rôle au dépôt. Sans elle, tout
    # dépôt GitHub du monde pourrait déployer sur votre compte.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

resource "aws_iam_role" "deploiement" {
  count = local.deploiement_actif ? 1 : 0

  name               = "musea-${var.environment}-deploiement"
  description        = "Assumé par GitHub Actions pour publier le site"
  assume_role_policy = data.aws_iam_policy_document.confiance_github[0].json
}

# Droits volontairement étroits : écrire dans CE bucket, invalider CETTE
# distribution. Rien d'autre. Un jeton dérobé ne permettrait pas de créer des
# ressources ni de lire d'autres services.
data "aws_iam_policy_document" "droits_deploiement" {
  count = local.deploiement_actif ? 1 : 0

  statement {
    sid       = "ListerLeBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }

  statement {
    sid    = "PublierLesFichiers"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:PutObjectAcl",
      "s3:GetObject",
      "s3:DeleteObject"
    ]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  statement {
    sid       = "PurgerLeCache"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "deploiement" {
  count = local.deploiement_actif ? 1 : 0

  name   = "musea-${var.environment}-deploiement"
  role   = aws_iam_role.deploiement[0].id
  policy = data.aws_iam_policy_document.droits_deploiement[0].json
}
