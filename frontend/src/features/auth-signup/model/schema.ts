import { z } from "zod"

export const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export type SignupValues = z.infer<typeof signupSchema>
