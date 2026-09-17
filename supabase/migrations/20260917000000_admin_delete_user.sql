-- ====================================================================
-- C-ROB Smart Key Locker
-- Migration: Secure RPC for Admin Delete User
-- ====================================================================

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_role TEXT;
  booking_count INT;
BEGIN
  -- 1. Get the caller's role from their profile
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  -- 2. Verify caller is an admin
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete users.';
  END IF;

  -- 3. Prevent deleting own account
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You cannot delete your own account.';
  END IF;
  
  -- 4. Prevent deleting another admin account
  IF (SELECT role FROM public.profiles WHERE id = target_user_id) = 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: You cannot delete another admin account.';
  END IF;

  -- 5. Verify the target profile exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Target user profile not found.';
  END IF;

  -- 6. Check for existing bookings to prevent cascade deletion of historical records
  SELECT COUNT(*) INTO booking_count FROM public.bookings WHERE user_id = target_user_id;
  IF booking_count > 0 THEN
    RAISE EXCEPTION 'Deletion blocked: This user has % existing booking(s). Deleting them would destroy historical booking records.', booking_count;
  END IF;

  -- 7. Delete from auth.users (cascades to public.profiles)
  DELETE FROM auth.users WHERE id = target_user_id;

  -- 8. Insert an audit log
  BEGIN
    INSERT INTO public.logs (event_type, description, metadata)
    VALUES (
      'user_deleted',
      'User account deleted by Admin',
      jsonb_build_object(
        'target_user', target_user_id, 
        'admin', auth.uid()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Secure execution permissions
REVOKE EXECUTE ON FUNCTION admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;
