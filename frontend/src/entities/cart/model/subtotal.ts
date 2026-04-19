interface PricedLine {
  priceCents: number
  quantity: number
}

// subtotalCents sums the (priceCents * quantity) of every line. It accepts
// any cart-shaped line — both guest and server items satisfy it.
export function subtotalCents(items: readonly PricedLine[]): number {
  return items.reduce((acc, line) => acc + line.priceCents * line.quantity, 0)
}
