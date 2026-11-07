export function mapRoute(pathname) {
  return pathname.replace(/\/+$/, '') === '/cyberpunk' ? 'cyberpunk' : 'coastal';
}
