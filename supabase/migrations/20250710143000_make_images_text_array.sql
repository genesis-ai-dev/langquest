-- Migration: Change 'images' column in 'asset' table from text to text[] 
alter table asset
alter column images TYPE text[] using case
  when images is null then null
  when images::text ~ '^\s*\[' then string_to_array(
    trim(
      both '[]'
      from
        images::text
    ),
    ','
  )
  else array[images]
end;