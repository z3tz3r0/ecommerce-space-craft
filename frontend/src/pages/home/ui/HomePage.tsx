import { FeaturedSection } from "@/widgets/featured-section"

export function HomePage() {
  return (
    <main className="flex flex-col gap-12 p-8">
      <section className="flex flex-col gap-4">
        <h1>Spacecraft Store</h1>
        <p>Browse our catalog of starfighters, freighters, and more.</p>
      </section>
      <FeaturedSection />
    </main>
  )
}
