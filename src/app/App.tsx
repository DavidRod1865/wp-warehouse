import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Providers } from './providers'
import { router } from './routes'

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <span className="loading loading-spinner loading-lg" />
    </div>
  )
}

export default function App() {
  return (
    <Providers>
      <Suspense fallback={<LoadingFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </Providers>
  )
}
