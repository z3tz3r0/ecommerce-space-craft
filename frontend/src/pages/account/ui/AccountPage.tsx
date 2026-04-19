import { useAuth } from "@/entities/user"
import { LogoutButton } from "@/features/auth-logout"
import { RequireAuth } from "@/features/require-auth"
import { Separator } from "@/shared/ui/separator"

function AccountContent() {
  const auth = useAuth()
  if (!auth.data) return null

  const joined = new Date(auth.data.createdAt).toLocaleDateString()
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1>Account</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt>Email</dt>
        <dd>{auth.data.email}</dd>
        <dt>Member since</dt>
        <dd>{joined}</dd>
      </dl>
      <Separator />
      <LogoutButton />
    </main>
  )
}

export function AccountPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  )
}
