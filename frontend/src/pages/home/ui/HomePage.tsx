import { useProducts } from "@/entities/product"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"

export function HomePage() {
  const { data, isLoading, error } = useProducts()

  return (
    <main className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Spacecraft Store — Phase 0 Demo</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading products…</p>}
          {error && <p>Error: {error.message}</p>}
          {data && <p>Loaded {data.length} products</p>}
        </CardContent>
      </Card>
    </main>
  )
}
