// The local server has no deployment meta tag and keeps its existing API routes.
export const base = document.querySelector('meta[name="gameref-base"]')?.content || '/';
export const isStatic = base !== '/';
export function siteURL(value) {
  return isStatic && value.startsWith('/') && !value.startsWith(base) ? base + value.slice(1) : value;
}
export function routePath(value) {
  return (isStatic && value.startsWith(base) ? '/' + value.slice(base.length) : value).replace(/\/$/, '') || '/';
}
