import { Toaster as SonnerToaster, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  return <SonnerToaster position="top-right" richColors {...props} />
}

export { Toaster }
