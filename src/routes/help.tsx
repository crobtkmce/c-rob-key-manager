import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeading } from "@/components/AppShell";
import { AnimatedSection } from "@/components/crob";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PhoneCall } from "lucide-react";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

function HelpPage() {
  return (
    <AppShell>
      <PageHeading
        title="Help & Support"
        subtitle="Need assistance with the C-ROB Key Locker? Contact an administrator."
      />
      <AnimatedSection animation="fade-in" delay={100}>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="panel glow-subtle border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="size-5 text-primary" /> Admin 1
              </CardTitle>
              <CardDescription>Primary Contact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">Name: [ADMIN 1 NAME]</p>
              <a
                href="tel:[ADMIN 1 MOBILE NUMBER]"
                className="text-sm text-primary hover:underline block"
              >
                Mobile: [ADMIN 1 MOBILE NUMBER]
              </a>
            </CardContent>
          </Card>

          <Card className="panel glow-subtle border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="size-5 text-primary" /> Admin 2
              </CardTitle>
              <CardDescription>Secondary Contact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">Name: [ADMIN 2 NAME]</p>
              <a
                href="tel:[ADMIN 2 MOBILE NUMBER]"
                className="text-sm text-primary hover:underline block"
              >
                Mobile: [ADMIN 2 MOBILE NUMBER]
              </a>
            </CardContent>
          </Card>
        </div>
      </AnimatedSection>
    </AppShell>
  );
}
