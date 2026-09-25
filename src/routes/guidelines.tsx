import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeading } from "@/components/AppShell";
import { AnimatedSection } from "@/components/crob";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/guidelines")({
  component: GuidelinesPage,
});

function GuidelinesPage() {
  const steps = [
    {
      title: "1. Book a Key",
      description: "Go to the Book Key section and provide the required booking information.",
    },
    {
      title: "2. Wait for Admin Approval",
      description: "After submitting the request, it will be forwarded to the administrator for approval.",
    },
    {
      title: "3. Booking Confirmation",
      description: "If the administrator accepts the request, a confirmation email will be sent to the registered email address.",
    },
    {
      title: "4. OTP at Session Start",
      description: "At the time the session starts, the OTP required for key access will be sent to the registered email address which is valid for 10 minutes.",
    },
    {
      title: "5. Collect the Key",
      description: "Use the provided OTP/authentication method at the key locker to access and collect the assigned key.",
    },
    {
      title: "6. Return the Key",
      description: "After the session ends, return the key to the designated key locker.",
    },
    {
      title: "7. Return Within 10 Minutes",
      description: "The key must be returned within 10 minutes after the session ends.",
    },
  ];

  return (
    <AppShell>
      <PageHeading title="User Guidelines" subtitle="Follow these steps to book and access a key." />

      <AnimatedSection animation="fade-in" delay={100} className="pb-10 max-w-3xl mx-auto">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <Card key={index} className="bg-card/40 border-border/50 hover:bg-card/60 transition-colors">
              <CardContent className="p-5">
                <h3 className="font-semibold text-base mb-2 text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </AnimatedSection>
    </AppShell>
  );
}
