# S3 gateway endpoint: las tareas Fargate corren en subredes públicas SIN NAT.
# Este endpoint (gratis) permite que lleguen a S3 por routing privado (imágenes
# de cartas, data lake). El resto de internet (tcgapi) sale por la IP pública de
# la tarea.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = data.aws_vpc.default.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = data.aws_route_tables.default.ids
}
