-- Add unique constraint for atomic email notifications
ALTER TABLE public.notifications
ADD CONSTRAINT uq_booking_notification UNIQUE (booking_id, type, message);
