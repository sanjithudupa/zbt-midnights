import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import AdminDashboard from "@/components/AdminDashboard";

export default async function AdminPage() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    redirect("/");
  }
  return <AdminDashboard />;
}
