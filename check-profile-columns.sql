-- Query to check columns in profiles and leetcode_profiles
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND table_name IN ('profiles', 'leetcode_profiles');
