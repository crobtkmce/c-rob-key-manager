CREATE TABLE IF NOT EXISTS public.handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.key_sessions(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending_acceptance',
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_status CHECK (status IN ('pending_acceptance', 'completed', 'rejected', 'cancelled', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_handovers_session_id ON public.handovers (session_id);
CREATE INDEX IF NOT EXISTS idx_handovers_to_user_id ON public.handovers (to_user_id);
CREATE INDEX IF NOT EXISTS idx_handovers_from_user_id ON public.handovers (from_user_id);

ALTER TABLE public.handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view handovers involving them" ON public.handovers;
CREATE POLICY "Users can view handovers involving them" ON public.handovers
FOR SELECT TO authenticated
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Explicitly deny direct inserts/updates to normal users
DROP POLICY IF EXISTS "Users cannot insert handovers" ON public.handovers;
CREATE POLICY "Users cannot insert handovers" ON public.handovers
FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "Users cannot update handovers" ON public.handovers;
CREATE POLICY "Users cannot update handovers" ON public.handovers
FOR UPDATE TO authenticated
USING (false);

-- RPC for atomic accept handover
CREATE OR REPLACE FUNCTION accept_key_handover(
    p_handover_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_handover RECORD;
    v_session RECORD;
    v_end_time TIMESTAMPTZ;
BEGIN
    -- 1. Lock the handover row
    SELECT * INTO v_handover
    FROM public.handovers
    WHERE id = p_handover_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Handover not found');
    END IF;

    IF v_handover.to_user_id != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not the target of this handover');
    END IF;

    IF v_handover.status != 'pending_acceptance' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Handover is no longer pending');
    END IF;

    -- 2. Lock the session row
    SELECT ks.id, ks.current_holder, ks.booking_id, b.start_time, b.duration_hours
    INTO v_session
    FROM public.key_sessions ks
    JOIN public.bookings b ON b.id = ks.booking_id
    WHERE ks.id = v_handover.session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found');
    END IF;

    v_end_time := v_session.start_time + (v_session.duration_hours || ' hours')::INTERVAL;
    IF now() >= v_end_time THEN
        UPDATE public.handovers SET status = 'expired', updated_at = now() WHERE id = p_handover_id;
        RETURN jsonb_build_object('success', false, 'error', 'Booking has ended');
    END IF;

    IF v_session.current_holder != v_handover.from_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'The sender is no longer the key holder');
    END IF;

    -- 3. Check cooldown
    IF EXISTS (
        SELECT 1 FROM public.handovers 
        WHERE session_id = v_session.id 
        AND status = 'completed' 
        AND completed_at IS NOT NULL
        AND completed_at + interval '3 minutes' > now()
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cooldown active. Try again later.');
    END IF;

    -- 4. Execute atomic updates
    UPDATE public.key_sessions 
    SET current_holder = p_user_id 
    WHERE id = v_session.id;

    UPDATE public.handovers 
    SET status = 'completed', completed_at = now(), updated_at = now() 
    WHERE id = p_handover_id;

    RETURN jsonb_build_object(
        'success', true, 
        'booking_id', v_session.booking_id,
        'from_user_id', v_handover.from_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
