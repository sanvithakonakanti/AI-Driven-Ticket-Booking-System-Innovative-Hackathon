import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { MovieGrid } from '@/components/movie-grid'
import { Movie } from '@/lib/types'

export default async function HomePage() {
  const supabase = await createClient()
  
  const { data: movies, error } = await supabase
    .from('movies')
    .select('*')
    .order('release_date', { ascending: false })

  if (error) {
    console.error('Error fetching movies:', error)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            <span className="text-balance">Book Your Cinema Experience</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            <span className="text-pretty">
              Select your favorite movie, choose the perfect seats, and enjoy the show. 
              Real-time seat availability ensures you never miss out.
            </span>
          </p>
        </section>

        {/* Now Showing */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">Now Showing</h2>
          </div>
          <MovieGrid movies={(movies as Movie[]) || []} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>CineBook - Your Premium Movie Ticket Booking Experience</p>
        </div>
      </footer>
    </div>
  )
}
