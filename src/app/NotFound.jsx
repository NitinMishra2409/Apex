import { Link } from 'react-router-dom'

export default function NotFound() {
    return (
        <div className="not-found">
            <p className="not-found-code">404</p>
            <h1>Page not found</h1>
            <p className="not-found-description">
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link to="/dashboard" className="btn-primary">
                ← Back to Dashboard
            </Link>
        </div>
    )
}
