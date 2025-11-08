# Environment Variables Setup

## Required Environment Files

Create the following files in the `client` directory:

### `.env.development`
```
VITE_API_BASE_URL=http://localhost:5000
```

### `.env.production`
```
VITE_API_BASE_URL=https://api.example.com
```

**Note:** Replace `https://api.example.com` with your actual production API URL.

## Important Notes

1. **VITE_ Prefix**: All environment variables must be prefixed with `VITE_` for Vite to expose them to the client-side code.

2. **Build Time**: Environment variables are injected at build time. Make sure to:
   - Restart the Vite dev server after creating/updating `.env` files
   - Set the environment variable in your CI/CD pipeline before running `vite build` for production

3. **Git Ignore**: These files are typically gitignored. You may want to create `.env.example` files as templates:
   - `.env.development.example`
   - `.env.production.example`

## Usage

The API base URL is now centralized in `src/lib/api.js` and used throughout the application via:
- `api` (axios instance) for axios calls
- `apiFetch` (fetch helper) for fetch calls

All API calls now use relative paths (e.g., `/api/leads` instead of `http://localhost:5000/api/leads`).

