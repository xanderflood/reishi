provider "kubernetes" {
  load_config_file = true
  config_context   = var.kube_context
}
resource "kubernetes_namespace" "reishi" {
  metadata {
    name = "reishi"
  }
}
terraform {
  backend "s3" {
    endpoint                    = "nyc3.digitaloceanspaces.com"
    region                      = "us-west-1"
    workspace_key_prefix        = "reishi"
    key                         = "terraform.tfstate"
    skip_requesting_account_id  = true
    skip_credentials_validation = true
    skip_get_ec2_platforms      = true
    skip_metadata_api_check     = true
  }
}

module "reishi_deployment" {
  source    = "./../modules/deployment"
  name      = "reishi"
  namespace = kubernetes_namespace.reishi.metadata.0.name

  image = "xanderflood/reishi:${var.docker_tag}"

  env = {
    SERVER_IP = var.server_ip
  }
}
