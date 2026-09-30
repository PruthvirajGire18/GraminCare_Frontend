export function dashboardPathForRole(role) {
  const paths = {
    ADMIN: '/admin',
    ASHA_WORKER: '/asha',
    DOCTOR: '/doctor',
  }
  return paths[role] || '/login'
}
