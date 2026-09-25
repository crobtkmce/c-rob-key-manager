CREATE OR REPLACE FUNCTION public.check_booking_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new_end timestamptz := new.start_time + (new.duration_hours || ' hours')::interval;
  v_conflict boolean;
begin
  if new.status in ('pending', 'confirmed') then
    if new.start_time < (now() - interval '5 minutes') then
      raise exception 'Start time cannot be in the past.';
    end if;
  end if;

  if new.status = 'confirmed' then
    select exists (
      select 1 from public.bookings
      where id != new.id
        and status = 'confirmed'
        and start_time < v_new_end
        and (start_time + (duration_hours || ' hours')::interval) > new.start_time
    ) into v_conflict;

    if v_conflict then
      raise exception 'The requested time slot overlaps with an existing confirmed booking.';
    end if;
  end if;

  return new;
end;
$function$;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'expired', 'entry_only'));
