import { LoginForm } from "@/features/auth-login"

export function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1>Log in</h1>
      <LoginForm />
    </main>
  )
}
