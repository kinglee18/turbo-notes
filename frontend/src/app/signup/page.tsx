import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <AuthForm
      mode="signup"
      heading="Yay, New Friend!"
      submitLabel="Sign Up"
      illustration={{
        src: "/illustrations/sleeping-cat.png",
        alt: "A sleeping cat",
        width: 220,
        height: 157,
      }}
      altLink={{ href: "/login", label: "We're already friends!" }}
    />
  );
}
