import { z } from "zod";
const settings = z.object({
  external: z.object({
    email: z.boolean().optional(),
    google: z.boolean().optional(),
  }),
  disable_signup: z.boolean(),
});
export const unavailableAuthMethods = {
  reachable: false,
  email: false,
  google: false,
  signup: false,
} as const;
export function parseAuthMethods(value: unknown) {
  const parsed = settings.safeParse(value);
  if (!parsed.success) return unavailableAuthMethods;
  return {
    reachable: true,
    email: parsed.data.external.email === true,
    google: parsed.data.external.google === true,
    signup: !parsed.data.disable_signup,
  };
}
