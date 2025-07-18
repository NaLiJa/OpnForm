export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated } = useIsAuthenticated()
  const { user } = useAuth()
  const { data: userData } = user()
  
  if (isAuthenticated.value && !userData.value?.admin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
})
