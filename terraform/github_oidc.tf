# Rol de IAM que GitHub Actions asume vía OIDC (sin claves de acceso largas).

# Proveedor OIDC de GitHub. Si ya existe en la cuenta, importar en vez de crear:
#   terraform import aws_iam_openid_connect_provider.github <arn>
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["ffffffffffffffffffffffffffffffffffffffff"] # AWS ignora el valor para GitHub OIDC
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Limita el rol a ESTE repo (cualquier rama/entorno).
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${local.name}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
  description        = "Rol asumido por GitHub Actions para desplegar infra/servicios"
}

# Permisos del rol. Para el MVP damos PowerUser (todo menos IAM/organizations).
# TODO(seguridad): sustituir por una política a medida de mínimo privilegio.
resource "aws_iam_role_policy_attachment" "github_actions_power" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

# Terraform necesita gestionar IAM (crear roles de Lambda, etc.). Permiso acotado.
data "aws_iam_policy_document" "github_iam" {
  statement {
    effect = "Allow"
    actions = [
      "iam:GetRole", "iam:PassRole", "iam:CreateRole", "iam:DeleteRole",
      "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:PutRolePolicy",
      "iam:DeleteRolePolicy", "iam:GetRolePolicy", "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies", "iam:TagRole", "iam:UntagRole"
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project}-*"]
  }
}

resource "aws_iam_role_policy" "github_iam" {
  name   = "${local.name}-iam-management"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_iam.json
}
