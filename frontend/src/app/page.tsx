import { redirect } from "next/navigation";

/** Middleware sends signed-out visitors to /login; everyone else lands here. */
export default function RootPage() {
  redirect("/notes");
}
