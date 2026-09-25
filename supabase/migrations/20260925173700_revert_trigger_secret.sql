CREATE OR REPLACE FUNCTION public.handle_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url text;
    v_secret text;
    v_request_id bigint;
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status != OLD.status) AND (NEW.status IN ('confirmed', 'cancelled', 'entry_only')) THEN
        -- Get the secret from vault
        SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
        
        IF v_secret IS NOT NULL THEN
            -- Use pg_net to make an asynchronous POST request to our edge function
            v_url := 'https://pnyzzqppfqauybmpqalm.supabase.co/functions/v1/cron-notifier';
            
            SELECT net.http_post(
                url := v_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || v_secret
                )
            ) INTO v_request_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;
