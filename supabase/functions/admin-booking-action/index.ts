import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    // 1. Authenticate user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user: " + (userError?.message || "No user object") }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify admin role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "execom")) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse request
    const { id, action } = await req.json();
    if (!id || !["confirmed", "entry_only", "cancelled"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch booking and resolve recipient email
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select("*, profiles(*)")
      .eq("id", id)
      .single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.status !== "pending") {
      return new Response(JSON.stringify({ error: "Booking is not pending" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientEmail = booking.profiles?.email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "No recipient email found for this booking" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Update booking status
    // This triggers the Postgres BEFORE UPDATE constraint natively
    const { error: updateErr } = await supabaseClient
      .from("bookings")
      .update({ status: action })
      .eq("id", id);

    if (updateErr) {
      console.error("Database update error:", updateErr.message);
      return new Response(JSON.stringify({ error: updateErr.message || "Failed to update booking" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Send Email and Insert Notification for idempotency
    let subject = "";
    let body = "";
    let notifMessage = "";

    if (action === "confirmed") {
      subject = "CROB Booking Confirmed";
      body = `Your CROB booking request has been confirmed.<br><br>An OTP will be sent to you at the start time of your booking.`;
      notifMessage = "Booking Approved Notification Sent";
    } else if (action === "entry_only") {
      subject = "CROB Booking Request - Entry Allowed";
      body = `Your CROB booking request was denied by the admin because the requested slot overlaps with an existing booking.<br><br>You can however enter the CROB room and do your project. The key will be handled by another team/individual.`;
      notifMessage = "Booking Entry Only Notification Sent";
    } else if (action === "cancelled") {
      subject = "CROB Booking Request Rejected";
      body = `Your CROB booking request has been rejected by the admin.<br><br>Entry to the CROB room has been denied.<br><br>Please contact the admin for further questions.`;
      notifMessage = "Booking Rejected Notification Sent";
    }

    let emailSent = false;
    let smtpError = null;
    
    if (gmailUser && gmailAppPassword) {
      console.log(`Sending email to ${recipientEmail} with subject: ${subject}`);
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: gmailUser,
            pass: gmailAppPassword,
          },
        });

        const info = await transporter.sendMail({
          from: `"C-ROB Key Locker" <${gmailUser}>`,
          to: recipientEmail,
          subject: subject,
          html: `<p>${body}</p>`,
        });
        
        emailSent = true;
        console.log("Email sent successfully. MessageId:", info.messageId);
      } catch (err: any) {
        smtpError = err.message;
        console.error("Nodemailer failed:", err.message);
      }
    } else {
      console.warn("GMAIL_USER or GMAIL_APP_PASSWORD is not set.");
      smtpError = "Missing Google SMTP Credentials";
    }

    // Insert idempotency notification
    await supabaseAdmin.from("notifications").insert({
      user_id: booking.user_id,
      booking_id: booking.id,
      type: "system",
      message: notifMessage,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      emailSent,
      smtpError: smtpError ? "See edge function logs for safe error details" : null
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
