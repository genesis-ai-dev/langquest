CREATE POLICY "Enable translation updates only by translation creator"
ON public.translation
FOR UPDATE
USING (
  creator_id = auth.uid()
);