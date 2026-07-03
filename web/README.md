# Web (Vite + React + Tailwind)

Interfaz de TCG Intelligence. v1: explorar + ficha de carta con gráfico.

## Local

```bash
cd web
cp .env.example .env
# edita VITE_API_URL con la URL de la API (output api_url del terraform)
npm install
npm run dev
```

Abre http://localhost:5173. Consume la API pública (reads abiertos + CORS).

## Stack

- Vite + React + TypeScript + Tailwind
- Gráficos: lightweight-charts (TradingView)
- Rutas: react-router

## Pendiente

- Hosting: S3 privado + CloudFront (Terraform) y CI de build/deploy.
- Auth Cognito (cuando se cierre el acceso).
- Watchlist / portfolio (v2).
