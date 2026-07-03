# Cognito — pool de usuarios para autenticar la API (frontend futuro).
# Provisionado para la Opción A; la app puede validar JWT en rutas protegidas.
# Mientras tanto, la API usa un gate por X-API-Key (ver services/api).

resource "aws_cognito_user_pool" "this" {
  name = "${local.name}-users"

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name            = "${local.name}-web"
  user_pool_id    = aws_cognito_user_pool.this.id
  generate_secret = false # SPA pública

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}
