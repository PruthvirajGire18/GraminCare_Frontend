import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main className="content-width not-found">
      <h1>Page not found</h1>
      <p>This address is not part of the current project foundation.</p>
      <Link to="/">Return to FieldSync</Link>
    </main>
  )
}

export default NotFoundPage
