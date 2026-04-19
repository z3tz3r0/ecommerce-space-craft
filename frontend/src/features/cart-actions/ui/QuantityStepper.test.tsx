import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { QuantityStepper } from "./QuantityStepper"

describe("QuantityStepper", () => {
  it("calls onChange(+1) when + is clicked and not at stock ceiling", async () => {
    const onChange = vi.fn()
    render(<QuantityStepper quantity={2} stockQuantity={5} onChange={onChange} />)
    await userEvent.click(screen.getByRole("button", { name: /increase/i }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it("disables + at the stock ceiling", () => {
    render(<QuantityStepper quantity={5} stockQuantity={5} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: /increase/i })).toBeDisabled()
  })

  it("calls onChange(-1) when - is clicked", async () => {
    const onChange = vi.fn()
    render(<QuantityStepper quantity={3} stockQuantity={5} onChange={onChange} />)
    await userEvent.click(screen.getByRole("button", { name: /decrease/i }))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it("onChange(0) when decrementing from 1 (parent treats 0 as remove)", async () => {
    const onChange = vi.fn()
    render(<QuantityStepper quantity={1} stockQuantity={5} onChange={onChange} />)
    await userEvent.click(screen.getByRole("button", { name: /decrease/i }))
    expect(onChange).toHaveBeenCalledWith(0)
  })
})
