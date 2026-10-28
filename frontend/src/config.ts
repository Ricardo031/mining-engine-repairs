/** API base URLs. Defined at build time through VITE_* variables (see .env.example). */
export const config = {
  authApiUrl: import.meta.env.VITE_AUTH_API_URL ?? 'http://localhost:3001/api/v1',
  repairsApiUrl: import.meta.env.VITE_REPAIRS_API_URL ?? 'http://localhost:8000/api/v1',
};
