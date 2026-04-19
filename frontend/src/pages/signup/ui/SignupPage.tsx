import { SignupForm } from "@/features/auth-signup"

export function SignupPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1>Sign up</h1>
      <SignupForm />
    </main>
  )
}
