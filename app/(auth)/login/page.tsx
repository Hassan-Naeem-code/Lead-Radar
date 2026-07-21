import { getSiteSettings } from "@/lib/site-settings.server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const settings = await getSiteSettings();
  return <LoginForm settings={settings} />;
}
