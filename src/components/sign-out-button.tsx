"use client";
import { ArrowUpRight } from "lucide-react";
import { signOut } from "@/app/login/actions";
export function SignOutButton() {
  return (
    <form
      action={signOut}
      onSubmit={() => {
        sessionStorage.removeItem("printnow-onboarding");
      }}
    >
      <button className="account-link" type="submit">
        Sign out <ArrowUpRight size={16} />
      </button>
    </form>
  );
}
