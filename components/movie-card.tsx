import Link from 'next/link'
import Image from 'next/image'
import { Movie } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Star } from 'lucide-react'

interface MovieCardProps {
  movie: Movie
}

export function MovieCard({ movie }: MovieCardProps) {
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[:'’]+/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const posterSrc = movie.poster_url && movie.poster_url.startsWith('/')
    ? movie.poster_url
    : `/posters/${slugify(movie.title)}.svg`

  return (
    <Link href={`/movies/${movie.id}`}>
      <Card className="group overflow-hidden bg-card transition-all hover:ring-2 hover:ring-primary/50">
        <div className="relative aspect-[2/3] overflow-hidden">
          <Image
            src={posterSrc}
            alt={movie.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <Badge variant="secondary" className="mb-2">
              {movie.genre}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4">
          <h3 className="mb-2 line-clamp-1 text-lg font-semibold text-foreground">
            {movie.title}
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {movie.duration_minutes} min
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-accent text-accent" />
              {movie.rating}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
