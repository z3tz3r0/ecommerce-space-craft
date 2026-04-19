import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router"
import { useGuestCartStore, useMergeCartMutation } from "@/entities/cart"
import { useLoginMutation } from "@/entities/user"
import { Button } from "@/shared/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form"
import { Input } from "@/shared/ui/input"
import { type LoginValues, loginSchema } from "../model/schema"

export function LoginForm() {
  const navigate = useNavigate()
  const login = useLoginMutation()
  const merge = useMergeCartMutation()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    try {
      await login.mutateAsync(values)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Login failed")
      return
    }
    // Login succeeded — guest cart merge is best-effort, never blocks navigation.
    try {
      const guest = useGuestCartStore.getState()
      if (guest.items.length > 0) {
        await merge.mutateAsync(
          guest.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        )
        guest.clear()
      }
    } catch {
      // Swallow: user is already authenticated, surfacing a merge error here
      // would mislead the UX. Phase 4 polish may add a toast.
    }
    navigate("/")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Logging in…" : "Log in"}
        </Button>
        <p className="text-sm">
          Need an account?{" "}
          <Link to="/signup" className="underline">
            Sign up
          </Link>
        </p>
      </form>
    </Form>
  )
}
