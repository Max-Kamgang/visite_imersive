terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # État distant — À DÉCOMMENTER une fois le bucket d'état créé (voir DEPLOY.md).
  # Tant qu'il est local, l'état vit dans infra/terraform.tfstate : suffisant pour
  # travailler seul, dangereux dès qu'on est deux ou qu'on déploie depuis la CI.
  #
  # backend "s3" {
  #   bucket       = "musea-tfstate"
  #   key          = "musea/terraform.tfstate"
  #   region       = "eu-west-3"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "musea"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront n'accepte QUE des certificats hébergés en us-east-1, quelle que soit
# la région où vit le reste de l'infrastructure. Ce n'est pas un choix, c'est une
# contrainte du service — d'où ce second fournisseur.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "musea"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
