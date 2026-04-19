import { Button } from "@/shared/ui/button"

interface QuantityStepperProps {
  quantity: number
  stockQuantity: number
  onChange: (nextQuantity: number) => void
}

export function QuantityStepper({ quantity, stockQuantity, onChange }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Decrease quantity"
        disabled={quantity <= 0}
        onClick={() => onChange(quantity - 1)}
      >
        −
      </Button>
      <span aria-live="polite" className="min-w-6 text-center text-sm">
        {quantity}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Increase quantity"
        disabled={quantity >= stockQuantity}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </Button>
    </div>
  )
}
