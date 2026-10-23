# RCPT frontend

React 18 + TypeScript + Vite, plain CSS. See the repository root `README.md` for the full project.

```bash
npm install
npm run dev      # http://localhost:5173, proxies /api to http://127.0.0.1:5000
npm run build    # type-check + production build into dist/
```

For a deployed build set `VITE_API_URL` to the API origin (for example `https://your-api.onrender.com`, no trailing slash).
