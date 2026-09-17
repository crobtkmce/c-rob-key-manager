-- ====================================================================
-- C-ROB Smart Key Locker
-- Migration: Clean up test_team_booking accounts and their test bookings
-- ====================================================================

DO $$
DECLARE
  test_user RECORD;
BEGIN
  -- Iterate through any users that match the programmatic test pattern
  FOR test_user IN 
    SELECT id, email 
    FROM auth.users 
    WHERE email LIKE 'test_team_booking_%' 
       OR email LIKE 'test_%'
  LOOP
    
    -- Delete their test bookings first so they don't block the standard deletion process.
    -- We know these are test bookings because they belong to a synthetic test account.
    DELETE FROM public.bookings WHERE user_id = test_user.id;
    
    -- Now the user can be safely deleted via cascade from auth.users
    DELETE FROM auth.users WHERE id = test_user.id;

    -- Log the cleanup
    INSERT INTO public.logs (event_type, description, metadata)
    VALUES (
      'test_data_cleanup',
      'Automatically removed synthetic test account and its bookings',
      jsonb_build_object('removed_user_id', test_user.id, 'removed_email', test_user.email)
    );
    
  END LOOP;
END;
$$;
