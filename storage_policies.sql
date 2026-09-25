-- Enable RLS for storage.objects (if not already enabled)
alter table storage.objects enable row level security;

-- Policy to allow anyone to read files from the kyc-documents bucket (since it's public)
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access"
on storage.objects for select
to public
using (bucket_id = 'kyc-documents');

-- Policy to allow authenticated users to upload files to kyc-documents bucket
drop policy if exists "Authenticated users can upload" on storage.objects;
create policy "Authenticated users can upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'kyc-documents');

-- Policy to allow authenticated users to update their own uploads
drop policy if exists "Users can update their own uploads" on storage.objects;
create policy "Users can update their own uploads"
on storage.objects for update
to authenticated
using (bucket_id = 'kyc-documents' and auth.uid() = owner);

-- Policy to allow authenticated users to delete their own uploads
drop policy if exists "Users can delete their own uploads" on storage.objects;
create policy "Users can delete their own uploads"
on storage.objects for delete
to authenticated
using (bucket_id = 'kyc-documents' and auth.uid() = owner);
