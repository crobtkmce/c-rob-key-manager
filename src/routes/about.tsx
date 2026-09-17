import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeading } from "@/components/AppShell";
import { AnimatedSection, GradientText } from "@/components/crob";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <AppShell>
      <PageHeading title="About Us" subtitle="Learn more about the C-ROB Smart Key Locker." />
      <AnimatedSection animation="fade-in" delay={100}>
        <div className="max-w-3xl space-y-6 rounded-xl border border-border/50 bg-card/60 p-6 md:p-8 shadow-sm backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold mb-3">
              <GradientText>C-ROB Smart Key Locker</GradientText>
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              C-ROB Smart Key Locker replaces the traditional sign-out register with a secure
              hardware locker and an automated booking system. It is designed to provide role-based
              booking and access control for the C-ROB lab key at TKMCE.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">How it works</h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Members reserve a time slot in advance and unlock the locker using a secure One-Time
              Password (OTP). Execom members have direct fingerprint access. Every handover is
              logged in real time, ensuring strict accountability and key custody tracking.
            </p>
          </div>

          <div className="pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground font-medium">
              Developed for C-ROB · TKMCE Centre for Robotics
            </p>
          </div>
        </div>
      </AnimatedSection>
    </AppShell>
  );
}
