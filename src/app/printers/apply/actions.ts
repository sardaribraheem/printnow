"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/auth/server";
const schema = z
  .object({
    name: z.string().trim().min(2).max(100),
    type: z.enum(["shop", "home"]),
    contact: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .min(7)
      .max(25)
      .regex(/^[+\d\s()-]+$/),
    address: z.string().trim().min(5).max(1000),
    pickup: z.boolean(),
    delivery: z.boolean(),
    consent: z.boolean(),
  })
  .refine((v) => v.pickup || v.delivery)
  .refine((v) => !v.pickup || v.consent);
export async function applyAsProvider(form: FormData) {
  const client = await createClient();
  if (!client)
    redirect(
      "/printers/apply?message=Authentication%20is%20not%20connected%20yet.",
    );
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login?next=/printers/apply");
  const parsed = schema.safeParse({
    name: form.get("name"),
    type: form.get("type"),
    contact: form.get("contact"),
    phone: form.get("phone"),
    address: form.get("address"),
    pickup: form.get("pickup") === "on",
    delivery: form.get("delivery") === "on",
    consent: form.get("consent") === "on",
  });
  if (!parsed.success)
    redirect(
      "/printers/apply?message=Check%20all%20fields%2C%20choose%20a%20fulfillment%20method%20and%20confirm%20pickup%20address%20consent%20if%20needed.",
    );
  const p = parsed.data;
  const { error } = await client.rpc("apply_as_provider", {
    p_display_name: p.name,
    p_business_type: p.type,
    p_responsible_contact: p.contact,
    p_contact_phone: p.phone,
    p_production_address: p.address,
    p_pickup_enabled: p.pickup,
    p_delivery_enabled: p.delivery,
    p_pickup_consent: p.consent,
  });
  if (error)
    redirect(
      "/printers/apply?message=Application%20could%20not%20be%20submitted.%20It%20may%20already%20exist%2C%20or%20the%20service%20may%20be%20unavailable.",
    );
  redirect("/printers/apply");
}
