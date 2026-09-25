import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isAfter, isBefore, addHours } from "date-fns";
import { AlertCircle, CheckCircle2, Clock, KeyRound, Loader2, ArrowRightLeft } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export function CurrentSession() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();

  // 1. Fetch if the user currently holds the physical key
  const { data: heldSession, isLoading: loadingHeld } = useQuery({
    queryKey: ["held_session", user?.id],
    queryFn: async () => {
      if (!user || !supabase) return null;
      const { data, error } = await supabase
        .from("key_sessions")
        .select("id, booking_id, started_at, bookings(start_time, duration_hours)")
        .eq("current_holder", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (error) console.error(error);
      return data;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  // 2. Fetch if the user has an upcoming or active booking (but doesn't hold key yet)
  const { data: upcomingBooking, isLoading: loadingUpcoming } = useQuery({
    queryKey: ["upcoming_booking", user?.id],
    queryFn: async () => {
      if (!user || !supabase) return null;
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending", "confirmed"])
        .order("start_time", { ascending: true });

      if (error || !data) return null;
      return data.find((b) => {
        const start = new Date(b.start_time);
        const end = addHours(start, b.duration_hours);
        const tenMinsBefore = new Date(start.getTime() - 10 * 60000);
        return isAfter(now, tenMinsBefore) && isBefore(now, end);
      });
    },
    enabled: !!user && !heldSession,
    refetchInterval: 30000,
  });

  // 3. Fetch OTP status if there is an upcoming booking
  const { data: otpStatus } = useQuery({
    queryKey: ["otp", upcomingBooking?.id],
    queryFn: async () => {
      if (!upcomingBooking || !supabase) return null;
      const { data } = await supabase
        .from("otps")
        .select("used_at, locked_until, valid_until")
        .eq("booking_id", upcomingBooking.id)
        .maybeSingle();
      return data;
    },
    enabled: !!upcomingBooking,
    refetchInterval: 10000,
  });

  // 4. Fetch pending handovers to or from this user
  const { data: pendingHandover } = useQuery({
    queryKey: ["handovers", user?.id],
    queryFn: async () => {
      if (!user || !supabase) return null;
      const { data } = await supabase
        .from("handovers")
        .select("*, from_profile:from_user_id(full_name), to_profile:to_user_id(full_name)")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq("status", "pending_acceptance")
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Handover Mutations
  const [handoverEmail, setHandoverEmail] = useState("");
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [handoverError, setHandoverError] = useState("");

  const initiateHandover = useMutation({
    mutationFn: async () => {
      if (!handoverEmail || !heldSession || !user) throw new Error("Missing data");

      const { data: recipient, error: recErr } = await supabase!
        .from("profiles")
        .select("id")
        .eq("email", handoverEmail.toLowerCase())
        .maybeSingle();

      if (recErr || !recipient) throw new Error("User not found or not registered");
      if (recipient.id === user.id) throw new Error("Cannot hand over to yourself");

      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      const { error: insErr } = await supabase!.from("handovers").insert({
        session_id: heldSession.id,
        from_user_id: user.id,
        to_user_id: recipient.id,
        status: "pending_acceptance",
        expires_at: expiresAt,
      });

      if (insErr) {
        if (insErr.code === "23505")
          throw new Error("A handover is already pending for this session.");
        throw new Error("Failed to initiate handover");
      }
    },
    onSuccess: () => {
      setIsHandoverOpen(false);
      setHandoverEmail("");
      setHandoverError("");
      queryClient.invalidateQueries({ queryKey: ["handovers", user?.id] });
    },
    onError: (e: any) => setHandoverError(e.message),
  });

  const respondToHandover = useMutation({
    mutationFn: async ({
      id,
      action,
      sessionId,
    }: {
      id: string;
      action: "completed" | "rejected" | "cancelled";
      sessionId: string;
    }) => {
      const { error: updErr } = await supabase!
        .from("handovers")
        .update({ status: action })
        .eq("id", id);
      if (updErr) throw updErr;

      if (action === "completed") {
        // Transfer custody
        await supabase!
          .from("key_sessions")
          .update({ current_holder: user!.id })
          .eq("id", sessionId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handovers", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["held_session", user?.id] });
    },
  });

  if (loadingHeld || loadingUpcoming) return null;

  // Render Logic
  if (pendingHandover?.to_user_id === user?.id) {
    return (
      <Alert className="bg-primary/10 border-primary/40 shadow-sm">
        <ArrowRightLeft className="size-5 text-primary" />
        <AlertTitle className="text-primary font-bold text-base">Key Handover Request</AlertTitle>
        <AlertDescription className="mt-2">
          <strong>{(pendingHandover.from_profile as any)?.full_name}</strong> wants to physically
          hand over the C-ROB key to you. Do you accept custody?
          <div className="mt-3 flex gap-3">
            <Button
              size="sm"
              onClick={() =>
                respondToHandover.mutate({
                  id: pendingHandover.id,
                  action: "completed",
                  sessionId: pendingHandover.session_id,
                })
              }
            >
              Accept Key
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                respondToHandover.mutate({
                  id: pendingHandover.id,
                  action: "rejected",
                  sessionId: pendingHandover.session_id,
                })
              }
            >
              Decline
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const activeBooking = heldSession?.bookings || upcomingBooking;

  if (!activeBooking && !heldSession) {
    return null; // Nothing to show
  }

  const start = new Date(activeBooking.start_time);
  const end = addHours(start, activeBooking.duration_hours);
  const timeRemaining = isAfter(now, start)
    ? formatDistanceToNow(end)
    : `Starts in ${formatDistanceToNow(start)}`;

  return (
    <Card className="panel border-primary/40 bg-card/60 shadow-md relative overflow-hidden transition-all duration-300 hover:border-primary/60">
      <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-primary flex items-center gap-2">
              <KeyRound className="size-5" />
              {heldSession
                ? "Active Key Custody"
                : isAfter(now, start)
                  ? "Active Booking"
                  : "Upcoming Booking"}
            </CardTitle>
            <CardDescription className="text-foreground/80 mt-1 flex flex-col gap-1">
              <span>
                {format(start, "h:mm a")} – {format(end, "h:mm a")}
              </span>
              {!heldSession && isAfter(now, start) && (
                <span className="text-xs opacity-80">Please check your spam folder for OTPs.</span>
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight">
              {heldSession || isAfter(now, start) ? "In Progress" : "Soon"}
            </div>
            <div className="text-xs font-medium text-muted-foreground flex items-center justify-end gap-1">
              <Clock className="size-3" />
              {timeRemaining}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {heldSession ? (
            <Alert className="bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400">
              <CheckCircle2 className="size-4" color="currentColor" />
              <AlertTitle>You have the key</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>Please return it to the locker before the session ends.</span>

                {pendingHandover?.from_user_id === user?.id ? (
                  <div className="flex items-center gap-2 bg-background/50 rounded-md p-1.5 border">
                    <span className="text-xs font-medium">
                      Waiting for {(pendingHandover.to_profile as any)?.full_name} to accept...
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive hover:text-destructive"
                      onClick={() =>
                        respondToHandover.mutate({
                          id: pendingHandover.id,
                          action: "cancelled",
                          sessionId: pendingHandover.session_id,
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-background/50 border-green-500/30 hover:bg-green-500/20"
                    onClick={() => setIsHandoverOpen(true)}
                  >
                    <ArrowRightLeft className="mr-2 size-4" />
                    Handover Key
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ) : otpStatus?.used_at ? (
            <Alert className="bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400">
              <CheckCircle2 className="size-4" color="currentColor" />
              <AlertTitle>Locker Unlocked</AlertTitle>
              <AlertDescription>
                Your OTP was used. (Waiting for hardware to confirm key removal...)
              </AlertDescription>
            </Alert>
          ) : otpStatus?.locked_until && new Date(otpStatus.locked_until) > now ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Locker Temporarily Locked</AlertTitle>
              <AlertDescription>
                Too many incorrect PIN attempts. The keypad is locked until{" "}
                {format(new Date(otpStatus.locked_until), "h:mm a")}.
              </AlertDescription>
            </Alert>
          ) : isAfter(now, start) ? (
            <Alert className="bg-primary/10 text-primary border-primary/20">
              <AlertCircle className="size-4" color="currentColor" />
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription>
                Your session has started. Check your college email for the 6-digit OTP to unlock the
                hardware locker.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="text-sm text-muted-foreground">
              Your OTP will be emailed to you when the session begins.
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={isHandoverOpen} onOpenChange={setIsHandoverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Handover Key</DialogTitle>
            <DialogDescription>
              Transfer physical custody of the key to another registered member. They will have 10
              minutes to accept.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Recipient's College Email</Label>
              <Input
                id="email"
                placeholder="student@tkmce.ac.in"
                value={handoverEmail}
                onChange={(e) => setHandoverEmail(e.target.value)}
              />
            </div>
            {handoverError && <p className="text-sm text-destructive">{handoverError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHandoverOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => initiateHandover.mutate()} disabled={initiateHandover.isPending}>
              {initiateHandover.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
