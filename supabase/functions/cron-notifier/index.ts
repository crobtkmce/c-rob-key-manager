import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  try {
    // Only allow authorized cron requests
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    let remindersSent = 0;
    let escalationsSent = 0;
    let otpsGenerated = 0;

    // =============================================================
    // JUST-IN-TIME OTP GENERATION LOGIC & REJECTION LOGIC
    // =============================================================
    // Fetch confirmed or cancelled bookings from the last 24 hours
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: recentBookings, error: recentErr } = await supabaseAdmin
      .from("bookings")
      .select("*, profiles(*)")
      .in("status", ["confirmed", "cancelled"])
      .gte("start_time", oneDayAgo.toISOString());

    if (!recentErr && recentBookings) {
      for (const booking of recentBookings) {
        if (!booking.profiles) continue;

        const startTime = new Date(booking.start_time);
        const validUntil = new Date(startTime.getTime() + 10 * 60000); // 10 minutes from start_time

        if (booking.status === "confirmed") {
          // If the current time is before the start time or past the 10-minute validity window, skip generating an OTP
          if (now < startTime || now > validUntil) {
            continue;
          }

          // Check if an OTP already exists for this booking
          const { data: existingOtp } = await supabaseAdmin
            .from("otps")
            .select("id")
            .eq("booking_id", booking.id)
            .limit(1);

          if (!existingOtp || existingOtp.length === 0) {
            // Generate a cryptographically secure 6-digit OTP
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            const otp = (Math.floor(array[0] % 900000) + 100000).toString();

            // Hash the OTP (SHA-256)
            const encoder = new TextEncoder();
            const data = encoder.encode(otp);
            const hashBuffer = await crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const otp_hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

            // Insert into otps table
            const { error: insertError } = await supabaseAdmin.from("otps").insert({
              booking_id: booking.id,
              otp_hash: otp_hash,
              valid_from: startTime.toISOString(),
              valid_until: validUntil.toISOString(),
            });

            if (!insertError) {
              otpsGenerated++;
              // Format time nicely for the user in IST since TKMCE is in Kerala
              const formattedTime = validUntil.toLocaleTimeString("en-US", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
              });

              // Send email
              const email = booking.profiles.email;
              const msg = `Your C-ROB booking slot has started.<br><br>Your one-time password to unlock the locker is: <strong style="font-size:24px;">${otp}</strong><br><br>It is valid for exactly 10 minutes (until <strong>${formattedTime}</strong>).<br>Do not share this code.`;
              if (RESEND_API_KEY) {
                await sendEmail(email, "Your C-ROB Locker OTP is ready", msg);
              } else {
                console.warn("RESEND_API_KEY not set. OTP generated but not emailed.");
              }
            } else {
              console.error("Failed to insert OTP for booking:", booking.id, insertError);
            }
          }
        } else if (booking.status === "cancelled") {
          // Check if rejection was already sent
          const { data: existingRejection } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("booking_id", booking.id)
            .eq("type", "system")
            .eq("message", "Booking Rejected Notification Sent")
            .limit(1);

          if (!existingRejection || existingRejection.length === 0) {
            const formattedTime = startTime.toLocaleString("en-US", { 
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "short"
            });
            const typeText = booking.booking_type === "team" ? `Team (${booking.team_size} members)` : "Individual";
            const purposeText = booking.purpose ? `- <strong>Purpose:</strong> ${booking.purpose}<br>` : "";
            const msg = `Your C-ROB key locker booking request was rejected by the admin.<br><br>
<strong>Booking Details:</strong><br>
- <strong>Date & Time:</strong> ${formattedTime}<br>
- <strong>Type:</strong> ${typeText}<br>
${purposeText}
<br>If you have any questions, please contact the C-ROB team.`;
            
            await supabaseAdmin.from("notifications").insert({
              user_id: booking.user_id,
              booking_id: booking.id,
              type: "system",
              message: "Booking Rejected Notification Sent",
            });

            if (RESEND_API_KEY) {
              await sendEmail(booking.profiles.email, "Your C-ROB Key Locker Booking Request Was Rejected", msg);
            }
          }
        }
      }
    }

    // =============================================================
    // PENDING BOOKING TIMEOUT LOGIC
    // =============================================================
    // Fetch pending bookings whose start_time has arrived
    const { data: pendingBookings, error: pendingErr } = await supabaseAdmin
      .from("bookings")
      .select("*, profiles(*)")
      .eq("status", "pending")
      .lte("start_time", now.toISOString())
      .gte("start_time", oneDayAgo.toISOString()); // don't process extremely old hanging bookings indefinitely

    if (!pendingErr && pendingBookings && pendingBookings.length > 0) {
      for (const booking of pendingBookings) {
        if (!booking.profiles) continue;

        // Atomically check if timeout notification was already sent to avoid race conditions
        const { data: existingTimeout } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("booking_id", booking.id)
          .eq("type", "system")
          .eq("message", "Booking Timeout Notification Sent")
          .limit(1);

        if (!existingTimeout || existingTimeout.length === 0) {
          // Double-check the status is still pending right before we expire it
          const { data: latestBooking } = await supabaseAdmin
            .from("bookings")
            .select("status")
            .eq("id", booking.id)
            .single();

          if (latestBooking && latestBooking.status === "pending") {
            // Set status to expired
            await supabaseAdmin.from("bookings").update({ status: "expired" }).eq("id", booking.id);

            const startTime = new Date(booking.start_time);
            const formattedTime = startTime.toLocaleString("en-US", { 
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "short"
            });
            const typeText = booking.booking_type === "team" ? `Team (${booking.team_size} members)` : "Individual";
            const purposeText = booking.purpose ? `- <strong>Purpose:</strong> ${booking.purpose}<br>` : "";
            
            const msg = `The requested shift has started while your booking was still pending, so the request has timed out because it was not approved in time.<br><br>
You should not assume that the booking is approved.<br><br>
<strong>Booking Details:</strong><br>
- <strong>Date & Time:</strong> ${formattedTime}<br>
- <strong>Type:</strong> ${typeText}<br>
${purposeText}
<br>Please make a new booking if you still need the key.`;

            await supabaseAdmin.from("notifications").insert({
              user_id: booking.user_id,
              booking_id: booking.id,
              type: "system",
              message: "Booking Timeout Notification Sent",
            });

            if (RESEND_API_KEY) {
              await sendEmail(booking.profiles.email, "C-ROB Key Locker Booking Request Timed Out", msg);
            }
          }
        }
      }
    }

    // =============================================================
    // SESSION NOTIFICATIONS (REMINDERS / ESCALATIONS)
    // =============================================================
    // 1. Fetch active sessions (where status is 'active')
    const { data: activeSessions, error: sessionErr } = await supabaseAdmin
      .from("key_sessions")
      .select("*, bookings(*, profiles(*))")
      .eq("status", "active");

    if (!sessionErr && activeSessions) {
      for (const session of activeSessions) {
        const booking = session.bookings;
        if (!booking || !booking.profiles) continue;

        const startTime = new Date(booking.start_time);
        const endTime = new Date(startTime.getTime() + booking.duration_hours * 3600000);

        const timeRemainingMs = endTime.getTime() - now.getTime();
        const minutesRemaining = timeRemainingMs / 60000;

        // -------------------------------------------------------------
        // REMINDER LOGIC (<= 30 minutes remaining, and > 0)
        // -------------------------------------------------------------
        if (minutesRemaining <= 30 && minutesRemaining >= 0) {
          // Check if reminder was already sent
          const { data: existingReminders } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("booking_id", booking.id)
            .eq("type", "reminder")
            .limit(1);

          if (!existingReminders || existingReminders.length === 0) {
            // Send reminder
            const msg = `Your C-ROB key session ends in ${Math.ceil(minutesRemaining)} minutes. Please return it to the locker soon.`;

            await supabaseAdmin.from("notifications").insert({
              user_id: session.current_holder,
              booking_id: booking.id,
              type: "reminder",
              message: msg,
            });

            // Email
            if (RESEND_API_KEY) {
              await sendEmail(booking.profiles.email, "Reminder: Return C-ROB Key", msg);
            }
            remindersSent++;
          }
        }

        // -------------------------------------------------------------
        // ESCALATION LOGIC (<= -10 minutes remaining / Overdue by 10m)
        // -------------------------------------------------------------
        if (minutesRemaining <= -10) {
          // Check if escalation was already sent
          const { data: existingEscalations } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("booking_id", booking.id)
            .eq("type", "escalation")
            .limit(1);

          if (!existingEscalations || existingEscalations.length === 0) {
            // Send escalation to admins
            const { data: admins } = await supabaseAdmin
              .from("profiles")
              .select("id, email")
              .in("role", ["admin", "execom"]);

            if (admins && admins.length > 0) {
              const msg = `ESCALATION: The key has not been returned by ${booking.profiles.full_name}. It is currently ${Math.abs(Math.floor(minutesRemaining))} minutes overdue.`;

              const notifs = admins.map((admin: any) => ({
                user_id: admin.id,
                booking_id: booking.id,
                type: "escalation",
                message: msg,
              }));

              await supabaseAdmin.from("notifications").insert(notifs);

              if (RESEND_API_KEY) {
                const emails = admins.map((a: any) => a.email).filter(Boolean);
                await sendEmail(emails, "URGENT: C-ROB Key Overdue", msg);
              }
              escalationsSent++;
            }
          }
        }
      }
    }

    // =============================================================
    // HANDOVER EXPIRY LOGIC
    // =============================================================
    const { data: expiredHandovers, error: handoverErr } = await supabaseAdmin
      .from("handovers")
      .select("*")
      .eq("status", "pending_acceptance")
      .lt("expires_at", now.toISOString());

    let handoversExpired = 0;
    if (!handoverErr && expiredHandovers && expiredHandovers.length > 0) {
      for (const handover of expiredHandovers) {
        // Find the booking_id for this session to satisfy the notifications FK
        const { data: session } = await supabaseAdmin
          .from("key_sessions")
          .select("booking_id")
          .eq("id", handover.session_id)
          .single();
        const bookingId = session?.booking_id || handover.session_id; // Fallback, though FK might fail if strict

        // Mark as expired
        await supabaseAdmin.from("handovers").update({ status: "expired" }).eq("id", handover.id);

        // Notify sender and receiver
        if (session) {
          await supabaseAdmin.from("notifications").insert([
            {
              user_id: handover.from_user_id,
              booking_id: bookingId,
              type: "system",
              message: "Your key handover request has expired.",
            },
            {
              user_id: handover.to_user_id,
              booking_id: bookingId,
              type: "system",
              message: "A key handover request sent to you has expired.",
            },
          ]);
        }
        handoversExpired++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, otpsGenerated, remindersSent, escalationsSent, handoversExpired }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

async function sendEmail(to: string | string[], subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // TEMPORARY TESTING SENDER: onboarding@resend.dev bypasses domain verification limits
      // but only works if sending to the verified Resend account owner's email address.
      // MUST REPLACE WITH A VERIFIED DOMAIN BEFORE PRODUCTION!
      from: "onboarding@resend.dev",
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: `<p>${text}</p>`,
    }),
  });
  if (!res.ok) {
    console.error("Resend error:", await res.text());
  }
}
