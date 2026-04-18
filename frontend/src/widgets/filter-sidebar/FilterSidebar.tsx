import { CATEGORIES } from "@/entities/product"
import { useCategoryFilter } from "@/features/catalog-filter"
import { Checkbox } from "@/shared/ui/checkbox"

export function FilterSidebar() {
  const { isSelected, toggle } = useCategoryFilter()

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-60">
      <h2>Categories</h2>
      <ul className="flex flex-col gap-3">
        {CATEGORIES.map((cat) => {
          const id = `cat-${cat.replace(/\s+/g, "-").toLowerCase()}`
          return (
            <li key={cat} className="flex items-center gap-2">
              <Checkbox id={id} checked={isSelected(cat)} onCheckedChange={() => toggle(cat)} />
              <label htmlFor={id}>{cat}</label>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
