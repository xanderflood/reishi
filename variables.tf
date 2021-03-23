variable "server_ip" {
  type = string
}
variable "kube_context" {
  type = string
}
variable "docker_tag" {
  type    = string
  default = "refactor-test"
}
