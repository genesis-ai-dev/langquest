CREATE POLICY "Allow all operations" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'local'::text));

CREATE POLICY "Enable insert for all users" ON "storage"."objects" FOR INSERT WITH CHECK (true);

ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;