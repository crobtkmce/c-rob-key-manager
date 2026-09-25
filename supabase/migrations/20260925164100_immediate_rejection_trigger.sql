-- Trigger to immediately notify when a booking is rejected
CREATE OR REPLACE FUNCTION public.trigger_rejection_notification()
RETURNS trigger AS $$
DECLARE
  v_secret text;
BEGIN
  -- We only trigger for rejections (which the frontend marks as 'cancelled')
  IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    
    -- If it's the user cancelling their own booking, insert a dummy notification
    -- so that the cron-notifier doesn't send them an "admin rejected" email
    IF auth.uid() = OLD.user_id AND NOT public.is_staff(auth.uid()) THEN
      -- Use a generic insert.
      -- ON CONFLICT DO NOTHING prevents errors if the dummy notification is already there.
      INSERT INTO public.notifications (user_id, booking_id, type, message)
      VALUES (OLD.user_id, OLD.id, 'system', 'Booking Rejected Notification Sent')
      ON CONFLICT ON CONSTRAINT uq_booking_notification DO NOTHING;
    ELSE
      -- It was an admin who rejected it. Try to get the cron secret.
      SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
      
      IF v_secret IS NOT NULL THEN
        -- In development, pg_net might not be perfectly configured but in production this will fire instantly.
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

-- Drop just in case it exists
DROP TRIGGER IF EXISTS on_booking_rejected ON public.bookings;

CREATE TRIGGER on_booking_rejected
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_rejection_notification();
