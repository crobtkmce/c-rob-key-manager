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

    // Authed client for verifying user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // Service role client for privileged updates
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reqBody = await req.json();
    const { action, target_email, session_id, handover_id } = reqBody;

    let transporter;
    if (gmailUser && gmailAppPassword) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailAppPassword },
      });
    }
    const siteUrl = Deno.env.get("VITE_PUBLIC_SITE_URL") || "https://crob-key-manager.vercel.app";

    if (action === "initiate") {
      if (!target_email || !session_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check current session
      const { data: session, error: sessErr } = await supabaseAdmin
        .from("key_sessions")
        .select("id, booking_id, current_holder, status, bookings(start_time, duration_hours, status)")
        .eq("id", session_id)
        .eq("status", "active")
        .single();

      if (sessErr || !session) {
        return new Response(JSON.stringify({ error: "Active session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (session.current_holder !== user.id) {
        return new Response(JSON.stringify({ error: "You are not the current key holder" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (session.bookings.status !== 'confirmed') {
        return new Response(JSON.stringify({ error: "Booking is not approved/confirmed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Ensure booking not ended
      const end_time = new Date(session.bookings.start_time);
      end_time.setHours(end_time.getHours() + session.bookings.duration_hours);
      if (new Date() >= end_time) {
        return new Response(JSON.stringify({ error: "Booking has ended" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Normalize email
      const normalizedEmail = target_email.toLowerCase().trim();
      if (!normalizedEmail.endsWith("@tkmce.ac.in")) {
        return new Response(JSON.stringify({ error: "Only @tkmce.ac.in addresses are allowed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: targetProfile, error: targetErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .eq("email", normalizedEmail)
        .single();
        
      if (targetErr || !targetProfile) {
        return new Response(JSON.stringify({ error: "Target user not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (targetProfile.id === user.id) {
        return new Response(JSON.stringify({ error: "Cannot handover to yourself" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Cooldown logic: get the latest completed handover for this session
      const { data: latestHandover } = await supabaseAdmin
        .from("handovers")
        .select("completed_at")
        .eq("session_id", session_id)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestHandover && latestHandover.completed_at) {
        const cooldownEnd = new Date(latestHandover.completed_at).getTime() + 3 * 60 * 1000;
        if (Date.now() < cooldownEnd) {
          return new Response(JSON.stringify({ error: "Cooldown active. Try again later." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Check if already pending
      const { data: pending } = await supabaseAdmin
        .from("handovers")
        .select("id")
        .eq("session_id", session_id)
        .eq("status", "pending_acceptance")
        .maybeSingle();

      if (pending) {
        return new Response(JSON.stringify({ error: "A handover request is already pending" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      const { data: insertData, error: insErr } = await supabaseAdmin
        .from("handovers")
        .insert({
          session_id: session_id,
          from_user_id: user.id,
          to_user_id: targetProfile.id,
          status: "pending_acceptance",
          expires_at: expiresAt,
        }).select().single();

      if (insErr) {
        return new Response(JSON.stringify({ error: "Failed to create handover request", details: insErr }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: fromProfile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).single();

      // Email target user
      if (transporter) {
        try {
          await transporter.sendMail({
            from: `"CROB Key Manager" <${gmailUser}>`,
            to: targetProfile.email,
            subject: "C-ROB Key Handover Request",
            text: `Hello ${targetProfile.full_name},\n\n${fromProfile?.full_name} has requested to physically hand over the CROB key to you. \n\nPlease log in to accept or reject this request: ${siteUrl}/member \n\nRegards,\nC-ROB Key Manager`,
          });
        } catch (emailErr) {
          console.error("Email send failed:", emailErr);
        }
      }
      
      // Audit log
      await supabaseAdmin.from("audit_logs").insert({
        action_type: "handover_requested",
        user_id: user.id,
        target_id: targetProfile.id,
        booking_id: session.booking_id,
        description: `${fromProfile?.full_name} initiated a key handover request to ${targetProfile.full_name}.`,
      });
      
      // Add a notification for the target user
      await supabaseAdmin.from("notifications").insert({
        user_id: targetProfile.id,
        type: "system",
        message: `${fromProfile?.full_name} requested a key handover. Check your active session.`,
        is_read: false
      });

      return new Response(JSON.stringify({ success: true, data: insertData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "accept" || action === "reject") {
      if (!handover_id) {
        return new Response(JSON.stringify({ error: "Missing handover_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action === "accept") {
        // Atomic RPC approach
        const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("accept_key_handover", {
          p_handover_id: handover_id,
          p_user_id: user.id
        });

        if (rpcErr || !rpcResult?.success) {
           return new Response(JSON.stringify({ error: rpcResult?.error || rpcErr?.message || "Failed to transfer responsibility" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { from_user_id, booking_id } = rpcResult;
        const { data: fromProfile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", from_user_id).single();
        const { data: toProfile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).single();

        // Audit log
        await supabaseAdmin.from("audit_logs").insert({
          action_type: "handover_accepted",
          user_id: user.id,
          target_id: from_user_id,
          booking_id: booking_id,
          description: `${fromProfile?.full_name} handed over key responsibility to ${toProfile?.full_name}.`,
        });

        // Email first user
        if (transporter && fromProfile?.email) {
          try {
            await transporter.sendMail({
              from: `"CROB Key Manager" <${gmailUser}>`,
              to: fromProfile.email,
              subject: "C-ROB Key Handover Accepted",
              text: `Hello ${fromProfile.full_name},\n\nThe handover request was accepted by ${toProfile?.full_name}. Responsibility for the key has now transferred to that person.\n\nRegards,\nC-ROB Key Manager`,
            });
          } catch (emailErr) {
            console.error("Email send failed:", emailErr);
          }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action === "reject") {
        const { data: handover, error: handErr } = await supabaseAdmin
          .from("handovers")
          .select("*, key_sessions(booking_id), from_profile:profiles!from_user_id(full_name, email), to_profile:profiles!to_user_id(full_name, email)")
          .eq("id", handover_id)
          .single();

        if (handErr || !handover) return new Response(JSON.stringify({ error: "Handover not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (handover.to_user_id !== user.id) return new Response(JSON.stringify({ error: "You are not the target" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (handover.status !== "pending_acceptance") return new Response(JSON.stringify({ error: "Handover is no longer pending" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        await supabaseAdmin.from("handovers").update({ 
          status: "rejected", 
          updated_at: new Date().toISOString() 
        }).eq("id", handover_id);

        // Audit log
        await supabaseAdmin.from("audit_logs").insert({
          action_type: "handover_rejected",
          user_id: user.id,
          target_id: handover.from_user_id,
          booking_id: handover.key_sessions?.booking_id,
          description: `${handover.from_profile.full_name} initiated a key handover request to ${handover.to_profile.full_name}, but the request was rejected.`,
        });

        // Email first user
        if (transporter && handover.from_profile?.email) {
          try {
            await transporter.sendMail({
              from: `"CROB Key Manager" <${gmailUser}>`,
              to: handover.from_profile.email,
              subject: "C-ROB Key Handover Rejected",
              text: `Hello ${handover.from_profile.full_name},\n\n${handover.to_profile.full_name} has declined your request to handover the key.\n\nYou remain as the person responsible for the key. If you think this happened by mistake, you can initiate a request again.\n\nRegards,\nC-ROB Key Manager`,
            });
          } catch (emailErr) {
            console.error("Email send failed:", emailErr);
          }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "cancel") {
      if (!handover_id) {
        return new Response(JSON.stringify({ error: "Missing handover_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: handover, error: handErr } = await supabaseAdmin
        .from("handovers")
        .select("*")
        .eq("id", handover_id)
        .single();

      if (handErr || !handover) {
        return new Response(JSON.stringify({ error: "Handover not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (handover.from_user_id !== user.id) {
        return new Response(JSON.stringify({ error: "You are not the creator of this handover" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      if (handover.status !== "pending_acceptance") {
        return new Response(JSON.stringify({ error: "Handover is no longer pending" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseAdmin.from("handovers").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", handover_id);
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
