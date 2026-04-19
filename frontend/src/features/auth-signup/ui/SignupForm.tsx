import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router"
import { useGuestCartStore, useMergeCartMutation } from "@/entities/cart"
import { useSignupMutation } from "@/entities/user"
import { Button } from "@/shared/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form"
import { Input } from "@/shared/ui/input"
import { type SignupValues, signupSchema } from "../model/schema"

export function SignupForm() {
  const navigate = useNavigate()
  const signup = useSignupMutation()
  const merge = useMergeCartMutation()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: SignupValues) {
    setServerError(null)
    try {
      await signup.mutateAsync(values)
      const guest = useGuestCartStore.getState()
      if (guest.items.length > 0) {
        await merge.mutateAsync(
          guest.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        )
        guest.clear()
      }
      navigate("/")
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Signup failed")
    }
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
                <Input type="password" autoComplete="new-password" {...field} />
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
        <Button type="submit" disabled={signup.isPending}>
          {signup.isPending ? "Creating account…" : "Sign up"}
        </Button>
        <p className="text-sm">
          Already have an account?{" "}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </p>
      </form>
    </Form>
  )
}
