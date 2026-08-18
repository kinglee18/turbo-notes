import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <AuthForm
      mode="login"
      heading="Yay, You're Back!"
      submitLabel="Login"
      illustration={{
        src: "/illustrations/cactus.png",
        alt: "A smiling cactus in a pot",
        width: 145,
        height: 173,
      }}
      altLink={{ href: "/signup", label: "Oops! I've never been here before" }}
    />
  );
}
