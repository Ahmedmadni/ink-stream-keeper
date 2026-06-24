
CREATE POLICY "att_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "att_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "att_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "att_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'note-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
