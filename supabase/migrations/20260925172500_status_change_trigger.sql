CREATE OR REPLACE FUNCTION public.trigger_status_change_notification()
RETURNS trigger AS $$
DECLARE
  v_secret text;
BEGIN
  -- Fire webhook when pending changes to cancelled, confirmed, or entry_only
  IF OLD.status = 'pending' AND NEW.status IN ('cancelled', 'confirmed', 'entry_only') THEN
    
    IF NEW.status = 'cancelled' AND auth.uid() = OLD.user_id AND NOT public.is_staff(auth.uid()) THEN
      -- If it's the user cancelling their own booking, insert a dummy notification
      INSERT INTO public.notifications (user_id, booking_id, type, message)
      VALUES (OLD.user_id, OLD.id, 'system', 'Booking Rejected Notification Sent')
      ON CONFLICT ON CONSTRAINT uq_booking_notification DO NOTHING;
    ELSE
      -- Fetch secret and trigger cron-notifier
      SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
      
      IF v_secret IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://pnyzzqppfqauybmpqalm.supabase.co/functions/v1/cron-notifier',
          body := '{}'::jsonb,
          params := '{}'::jsonb,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_booking_rejected ON public.bookings;
DROP TRIGGER IF EXISTS on_booking_status_change ON public.bookings;

CREATE TRIGGER on_booking_status_change
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_status_change_notification();
