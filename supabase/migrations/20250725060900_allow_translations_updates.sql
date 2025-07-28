-- Drop the policy if it already exists to avoid conflicts
DROP POLICY IF EXISTS "Enable translation updates only by translation creator" ON public.translation;

-- Create the policy for translation updates
CREATE POLICY "Enable translation updates only by translation creator"
ON public.translation
FOR UPDATE
USING (
  creator_id = auth.uid()
);