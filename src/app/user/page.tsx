import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import UserLogging from "@/components/UserLogging";

export default async function UserPage() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "user") {
    redirect("/");
  }
  return <UserLogging />;
}
