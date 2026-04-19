// FSD cross-import public API for entities/cart.
// The cart facade composes auth state with cart state to route between
// guest and server modes. This is the canonical FSD escape hatch for
// same-layer composition — exposes exactly what entities/cart needs and
// nothing more.
export { useAuth } from "../api"
