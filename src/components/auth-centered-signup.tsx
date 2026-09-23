import { type FormEvent, useMemo, useState } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Strength = "empty" | "weak" | "ok" | "strong";

function computeStrength(password: string): Strength {
  if (!password) return "empty";
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^\w\s]/.test(password);
  if (password.length >= 12 || (password.length >= 8 && hasDigit && hasSymbol)) {
    return "strong";
  }
  if (password.length >= 8 && (hasDigit || hasSymbol)) {
    return "ok";
  }
  return "weak";
}

const STRENGTH_META: Record<
  Strength,
  { label: string; segments: number; color: string; text: string }
> = {
  empty: {
    label: "",
    segments: 0,
    color: "bg-border",
    text: "text-muted-foreground",
  },
  weak: {
    label: "Weak",
    segments: 1,
    color: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  ok: {
    label: "OK",
    segments: 2,
    color: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  strong: {
    label: "Strong",
    segments: 3,
    color: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
};

export function AuthCenteredSignupShowcasePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false);

  const strength = useMemo(() => computeStrength(password), [password]);
  const meta = STRENGTH_META[strength];

  const canSubmit =
    terms && name.trim() !== "" && email.trim() !== "" && password !== "";

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    window.setTimeout(() => setPending(false), 800);
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <PageBackdrop />
      <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-12">
        <BenefitPills />

        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="mb-3 flex justify-center">
              <BrandMark />
            </div>
            <CardTitle className="font-heading text-2xl tracking-tight">
              Create your account
            </CardTitle>
            <CardDescription>It only takes a minute.</CardDescription>
          </CardHeader>

          <CardPanel className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="outline" size="lg" type="button">
                <GitHubIcon />
                GitHub
              </Button>
              <Button variant="outline" size="lg" type="button">
                <GoogleIcon />
                Google
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
                Or sign up with email
              </span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="signup-name">Full name</FieldLabel>
                <Input
                  id="signup-name"
                  type="text"
                  required
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  nativeInput
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                <Input
                  id="signup-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  nativeInput
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="signup-password"
                    type={reveal ? "text" : "password"}
                    required
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    nativeInput
                  />
                  <InputGroupAddon align="inline-end">
                    <button
                      type="button"
                      onClick={() => setReveal((v) => !v)}
                      aria-label={reveal ? "Hide password" : "Show password"}
                      className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {reveal ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </InputGroupAddon>
                </InputGroup>

                <div className="mt-1 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i < meta.segments ? meta.color : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`min-w-[3.5rem] text-right font-mono text-[10px] uppercase tracking-[0.2em] ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                </div>
              </Field>

              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="signup-terms"
                  checked={terms}
                  onCheckedChange={(v) => setTerms(v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="signup-terms"
                  className="text-muted-foreground text-sm leading-snug"
                >
                  I agree to the{" "}
                  <a
                    href="#"
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    Terms
                  </a>{" "}
                  and{" "}
                  <a
                    href="#"
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    Privacy
                  </a>
                </Label>
              </div>

              <Button
                type="submit"
                size="lg"
                loading={pending}
                disabled={!canSubmit}
                className="mt-1 w-full"
              >
                Create account
              </Button>
            </form>
          </CardPanel>

          <CardFooter className="justify-center">
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <a
                href="#"
                className="text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </a>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function BenefitPills() {
  const items = ["Free for 14 days", "No credit card", "Cancel anytime"];
  return (
    <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
      {items.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] backdrop-blur-sm"
        >
          <CheckIcon className="size-3 text-emerald-500" />
          {label}
        </span>
      ))}
    </div>
  );
}

function PageBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute top-[-10%] left-[-10%] size-[40rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute right-[-10%] bottom-[-10%] size-[40rem] rounded-full bg-accent/15 blur-3xl" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent), transparent 70%)",
        }}
      />
    </div>
  );
}

function BrandMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className="size-9"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <rect
        width="64"
        height="64"
        rx="14"
        className="fill-foreground/[0.06]"
        stroke="currentColor"
        strokeOpacity="0.12"
      />
      <g transform="translate(32 32) rotate(-25)">
        <path
          d="M -22 0 A 22 8 0 0 1 22 0"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <circle cx="32" cy="32" r="11" className="fill-foreground" />
      <g transform="translate(32 32) rotate(-25)">
        <path
          d="M 22 0 A 22 8 0 0 1 -22 0"
          stroke="currentColor"
          strokeOpacity="0.85"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor">
      <path d="M12 .5C5.7.5.6 5.6.6 11.9c0 5 3.3 9.3 7.8 10.8.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.5-.3-5.2-1.3-5.2-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.2 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.5-1.5 7.8-5.8 7.8-10.8C23.4 5.6 18.3.5 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#EA4335"
        d="M12 5c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.5 15 .5 12 .5 7.3.5 3.3 3.2 1.4 7.1l3.8 3c.9-2.8 3.5-4.6 6.8-4.6Z"
      />
      <path
        fill="#34A853"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.6Z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1l-3.8-3C.5 8.7 0 10.3 0 12s.5 3.3 1.4 4.7l3.8-2.6Z"
      />
      <path
        fill="#4285F4"
        d="M12 23.5c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.3 0-6-2-6.9-4.6l-3.8 3C3.3 20.8 7.3 23.5 12 23.5Z"
      />
    </svg>
  );
}
